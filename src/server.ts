import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import {
  REGIONS,
  REGION_INFO,
  type CatalogSource,
  type Region,
  type RegionCatalog,
  type Therapist,
  type TherapyType,
  catalogUrl,
  profileUrl,
  quizUrl,
} from './catalog.js';
import { DISCLAIMER, SAFETY_NOTE, crisisResources } from './crisis.js';
import { ageRangeOf, levelWord, rankTherapists, resolveLanguage, resolveTerms } from './match.js';

export const SERVER_NAME = 'pleso-therapist-finder';
export const SERVER_VERSION = '0.1.0';

const INSTRUCTIONS = `Pleso (https://pleso.me) is an online therapy platform with vetted therapists offering 50-minute video sessions in English, Ukrainian, Polish and Romanian.

Tools:
- search_therapists: ranked therapist matches for up to 5 concerns (plain words like "anxiety", "burnout", "breakup" or codes from list_concerns), with optional filters.
- list_concerns: the concerns, therapy methods and client groups available in a region.
- get_therapist_profile: full public profile of one therapist.
- get_pleso_info: prices, how sessions work, regions and booking links.
- get_crisis_resources: emergency and crisis-line contacts by country.

Regions: "en" (English, worldwide), "ua" (Ukrainian), "pl" (Polish), "ro" (Romanian). Pick the region from the language the person wants therapy in.

Safety: ${SAFETY_NOTE}

Booking happens on pleso.me through the returned profile_url; these tools never book or collect personal data.`;

const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } as const;

const regionSchema = z
  .enum(REGIONS)
  .default('en')
  .describe('Pleso region = therapy language: en (English, worldwide), ua (Ukrainian), pl (Polish), ro (Romanian).');
const therapyTypeSchema = z
  .enum(['individual', 'couple'])
  .default('individual')
  .describe('individual therapy, or couple therapy (couple available in ua and pl).');

function ok(structured: Record<string, unknown>): CallToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(structured, null, 2) }],
    structuredContent: structured,
  };
}

function fail(message: string): CallToolResult {
  return { isError: true, content: [{ type: 'text', text: message }] };
}

function snippet(text: string, max = 360): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  return `${cut.slice(0, Math.max(cut.lastIndexOf('. ') + 1, cut.lastIndexOf(' ')))}…`;
}

function mainBio(t: Therapist): string {
  return (t.descriptions.find((d) => d.description)?.description ?? '').trim();
}

function topCodes(t: Therapist, prefix: string, min: number, limit: number, cat: RegionCatalog) {
  return Object.entries(t.scores)
    .filter(([code, level]) => code.startsWith(prefix) && level >= min)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([code]) => cat.labels[code] ?? code);
}

function languagesOf(t: Therapist, cat: RegionCatalog) {
  return t.languages.map((code) => cat.labels[code] ?? code.split('.').pop()!);
}

function facetsFor(cat: RegionCatalog, type: TherapyType) {
  const f = cat.facets[type];
  if (!f) {
    const available = Object.keys(cat.facets).join(', ');
    throw new UserError(`${type} therapy is not offered in region "${cat.region}". Available: ${available}.`);
  }
  return f;
}

class UserError extends Error {}

async function withCatalog<T>(source: CatalogSource, region: Region, fn: (cat: RegionCatalog) => T): Promise<CallToolResult> {
  try {
    const cat = await source.getCatalog(region);
    return ok(fn(cat) as Record<string, unknown>);
  } catch (err) {
    if (err instanceof UserError) return fail(err.message);
    // Never log request arguments (privacy notice promises search filters are not logged).
    console.error('[pleso-mcp] catalog error:', (err as Error).message);
    return fail(
      `The Pleso therapist catalog is temporarily unavailable. The person can browse therapists directly at ${catalogUrl(region)} or take the matching quiz at ${quizUrl(region)}.`,
    );
  }
}

export function createServer(source: CatalogSource): McpServer {
  const server = new McpServer(
    { name: SERVER_NAME, title: 'Pleso Therapy', version: SERVER_VERSION, websiteUrl: 'https://pleso.me' },
    { instructions: INSTRUCTIONS },
  );

  // ---------------------------------------------------------------- search
  server.registerTool(
    'search_therapists',
    {
      title: 'Find a Pleso therapist',
      description:
        'Search Pleso therapists and rank them by how strongly they work with the given concerns. ' +
        'Concerns can be short plain-language terms (e.g. "anxiety", "burnout", "grief", "panic attacks", "breakup") or codes from list_concerns. ' +
        'Returns up to 10 therapists with match score, matching specialties, methods, languages, a short bio and a profile/booking link on pleso.me.',
      inputSchema: {
        region: regionSchema,
        concerns: z
          .array(z.string().min(2).max(60))
          .max(5)
          .default([])
          .describe('Up to 5 short concern terms or codes. Do not pass personal narratives or identifying details.'),
        therapy_type: therapyTypeSchema,
        methods: z
          .array(z.string().min(2).max(60))
          .max(3)
          .optional()
          .describe('Preferred therapy methods, e.g. "CBT", "EMDR", "Gestalt", "psychoanalysis" (ranking bonus, not a filter).'),
        client_groups: z
          .array(z.string().min(2).max(60))
          .max(3)
          .optional()
          .describe('Relevant client groups, e.g. "LGBTQ+", "veterans", "expats", "students", "new parents" (ranking bonus).'),
        therapist_gender: z.enum(['male', 'female']).optional().describe('Only if the person states a preference.'),
        therapist_age: z.enum(['30-', '30-40', '40+']).optional().describe('Therapist age range preference.'),
        language: z.string().max(30).optional().describe('Language the therapist must speak, e.g. "English", "Ukrainian", "Russian".'),
        limit: z.number().int().min(1).max(10).default(5),
      },
      annotations: { title: 'Find a Pleso therapist', ...READ_ONLY },
    },
    async (args) =>
      withCatalog(source, args.region, (cat) => {
        const facets = facetsFor(cat, args.therapy_type);
        const concerns = resolveTerms(args.concerns, facets.concerns);
        const methods = resolveTerms(args.methods ?? [], facets.methods, 1);
        const groups = resolveTerms(args.client_groups ?? [], facets.client_groups, 1);
        let languageCode: string | undefined;
        const notes: string[] = [];
        if (args.language) {
          languageCode = resolveLanguage(args.language, cat) ?? undefined;
          if (!languageCode) notes.push(`No Pleso therapists in region "${cat.region}" list the language "${args.language}"; language filter ignored.`);
        }
        const ranked = rankTherapists(cat.therapists, {
          therapyType: args.therapy_type,
          concerns: concerns.resolved.map((r) => r.code),
          methods: methods.resolved.map((r) => r.code),
          clientGroups: groups.resolved.map((r) => r.code),
          gender: args.therapist_gender,
          ageRange: args.therapist_age,
          language: languageCode,
        });
        const unmatched = [...concerns.unmatched, ...methods.unmatched, ...groups.unmatched];
        if (unmatched.length) notes.push(`Not recognised (see list_concerns for valid options): ${unmatched.join(', ')}.`);
        if (!ranked.length) notes.push('No therapists match these filters. Try removing gender, age or language filters.');

        return {
          region: cat.region,
          therapy_type: args.therapy_type,
          interpreted_as: {
            concerns: concerns.resolved.map(({ code, label }) => ({ code, label })),
            methods: methods.resolved.map(({ code, label }) => ({ code, label })),
            client_groups: groups.resolved.map(({ code, label }) => ({ code, label })),
            language: languageCode ? (cat.labels[languageCode] ?? languageCode) : null,
          },
          total_matching_therapists: ranked.length,
          therapists: ranked.slice(0, args.limit).map((r) => {
            const t = r.therapist;
            return {
              id: t.id,
              name: t.name,
              match_score: r.score,
              matching_specialties: r.concernLevels
                .filter((c) => c.level > 0)
                .map((c) => ({ concern: cat.labels[c.code] ?? c.code, level: levelWord(c.level) })),
              matched_methods: r.matchedMethods.map((c) => cat.labels[c] ?? c),
              matched_client_groups: r.matchedGroups.map((c) => cat.labels[c] ?? c),
              main_methods: topCodes(t, 'modality.', 2, 4, cat),
              years_of_experience: t.experienceYears,
              gender: t.gender,
              languages: languagesOf(t, cat),
              therapy_types: t.therapyTypes,
              bio_excerpt: snippet(mainBio(t)),
              photo_url: t.photoUrl,
              intro_video_url: t.videoUrl,
              profile_url: profileUrl(cat.region, t.id),
            };
          }),
          price: cat.prices[args.therapy_type] ?? null,
          browse_all_url: catalogUrl(cat.region),
          matching_quiz_url: quizUrl(cat.region),
          notes,
          disclaimer: DISCLAIMER,
          safety: SAFETY_NOTE,
        };
      }),
  );

  // ---------------------------------------------------------------- profile
  server.registerTool(
    'get_therapist_profile',
    {
      title: 'Get a Pleso therapist profile',
      description:
        "Full public profile of one Pleso therapist by id (from search_therapists): bio, education/diplomas, experience, languages, methods, client groups, all specialties by level, intro video and booking link.",
      inputSchema: {
        therapist_id: z.string().min(8).max(64).describe('Therapist id from search_therapists.'),
        region: regionSchema,
      },
      annotations: { title: 'Get a Pleso therapist profile', ...READ_ONLY },
    },
    async ({ therapist_id, region }) =>
      withCatalog(source, region, (cat) => {
        const t = cat.therapists.find((x) => x.id === therapist_id.trim().toLowerCase());
        if (!t) throw new UserError(`No therapist with id "${therapist_id}" in region "${region}". Use search_therapists to get valid ids.`);
        const byLevel = (prefix: string, min: number) =>
          Object.entries(t.scores)
            .filter(([c, l]) => c.startsWith(prefix) && l >= min)
            .sort((a, b) => b[1] - a[1])
            .map(([c, l]) => ({ name: cat.labels[c] ?? c, level: levelWord(prefix.startsWith('issue') ? l : l + 2) }));
        return {
          id: t.id,
          name: t.name,
          region: t.region,
          gender: t.gender,
          age_range: ageRangeOf(t),
          years_of_experience: t.experienceYears,
          languages: languagesOf(t, cat),
          therapy_types: t.therapyTypes,
          about: t.descriptions.map((d) => ({ title: d.title || null, text: d.description })),
          education: t.diplomas.map((d) => ({ title: d.title, details: d.description || null })),
          specialties: byLevel('issue.', 3),
          methods: byLevel('modality.', 1).map((m) => m.name),
          client_groups: byLevel('group.', 2).map((g) => g.name),
          photo_url: t.photoUrl,
          intro_video_url: t.videoUrl,
          profile_url: profileUrl(cat.region, t.id),
          price: t.therapyTypes.map((tt) => ({ therapy_type: tt, price: cat.prices[tt] ?? null })),
          disclaimer: DISCLAIMER,
        };
      }),
  );

  // ---------------------------------------------------------------- taxonomy
  server.registerTool(
    'list_concerns',
    {
      title: 'List concerns, methods and client groups',
      description:
        'The concerns (issues), therapy methods and client groups Pleso therapists in a region can be searched by, with codes usable in search_therapists.',
      inputSchema: { region: regionSchema, therapy_type: therapyTypeSchema },
      annotations: { title: 'List concerns, methods and client groups', ...READ_ONLY },
    },
    async ({ region, therapy_type }) =>
      withCatalog(source, region, (cat) => {
        const f = facetsFor(cat, therapy_type);
        const strip = (o: { code: string; label: string; local_label?: string }) =>
          o.local_label ? { code: o.code, label: o.label, local_label: o.local_label } : { code: o.code, label: o.label };
        return {
          region,
          therapy_type,
          therapist_count: cat.therapists.filter((t) => t.therapyTypes.includes(therapy_type)).length,
          concerns: f.concerns.map(strip),
          methods: f.methods.map(strip),
          client_groups: f.client_groups.map(strip),
          languages: [...new Set(cat.therapists.flatMap((t) => t.languages))].map((c) => cat.labels[c] ?? c),
        };
      }),
  );

  // ---------------------------------------------------------------- info
  server.registerTool(
    'get_pleso_info',
    {
      title: 'About Pleso: prices, regions and how it works',
      description:
        'How Pleso online therapy works: regions/languages, therapist counts, session format, current starting prices per region, and links to browse therapists or take the matching quiz.',
      inputSchema: { region: z.enum(REGIONS).optional().describe('Limit to one region (en, ua, pl, ro); omit for all regions.') },
      annotations: { title: 'About Pleso', ...READ_ONLY },
    },
    async ({ region }) => {
      const regions = region ? [region] : [...REGIONS];
      const out = await Promise.all(
        regions.map(async (r) => {
          try {
            const cat = await source.getCatalog(r);
            return {
              region: r,
              language: REGION_INFO[r].name,
              audience: REGION_INFO[r].audience,
              therapy_types: Object.keys(cat.facets),
              therapists: cat.therapists.length,
              prices: cat.prices,
              browse_url: catalogUrl(r),
              matching_quiz_url: quizUrl(r),
            };
          } catch {
            return { region: r, language: REGION_INFO[r].name, audience: REGION_INFO[r].audience, browse_url: catalogUrl(r), matching_quiz_url: quizUrl(r) };
          }
        }),
      );
      return ok({
        about:
          'Pleso is an online psychotherapy platform. Therapists are vetted for education and experience; sessions are 50-minute video calls booked and paid on pleso.me. Clients can switch therapist at any time.',
        how_to_start: [
          'Pick a therapist (search_therapists) or take the free matching quiz.',
          "Open the therapist's profile_url on pleso.me, choose a time slot, and pay for a single session or a bundle.",
          'Join the video session from the Pleso account at the booked time.',
        ],
        regions: out,
        website: 'https://pleso.me',
        safety: SAFETY_NOTE,
      });
    },
  );

  // ---------------------------------------------------------------- crisis
  server.registerTool(
    'get_crisis_resources',
    {
      title: 'Crisis and emergency contacts',
      description:
        'Emergency numbers and free crisis/suicide-prevention lines for a country (UA, PL, RO, GB, IE, US, CA, DE; others get the international directory). For situations where someone may be in danger or thinking about suicide or self-harm.',
      inputSchema: {
        country: z.string().max(40).optional().describe('ISO country code or country name, e.g. "PL", "Ukraine". Omit if unknown.'),
      },
      annotations: { title: 'Crisis and emergency contacts', ...READ_ONLY },
    },
    async ({ country }) => {
      const r = crisisResources(country);
      return ok({
        message:
          'If you are in immediate danger, call your local emergency number now. You do not have to go through this alone — these services are free and confidential.',
        country: r.resources?.country ?? country ?? null,
        emergency_number: r.resources?.emergency_number ?? '112 (EU/UK) · 911 (US/Canada) · or your local emergency number',
        crisis_lines: [...(r.resources?.lines ?? []), r.fallback],
        note: 'Pleso therapists can help with ongoing support, but Pleso is not an emergency service.',
      });
    },
  );

  // ---------------------------------------------------------------- prompt
  server.registerPrompt(
    'find_a_therapist',
    {
      title: 'Find a therapist on Pleso',
      description: 'Guided conversation to find a suitable Pleso therapist.',
      argsSchema: {
        what_is_going_on: z.string().optional().describe('A few words about what the person wants help with.'),
        language: z.string().optional().describe('Language for therapy (English, Ukrainian, Polish, Romanian).'),
      },
    },
    ({ what_is_going_on, language }) => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text:
              `Help me find a therapist on Pleso.${what_is_going_on ? ` What I'd like help with: ${what_is_going_on}.` : ''}${language ? ` Preferred language: ${language}.` : ''}\n\n` +
              'Ask me briefly about anything missing (main concerns, language, individual or couple therapy, any preference for therapist gender or method), then use search_therapists and show the top 3 matches with why each fits and their profile links. ' +
              'If anything I say suggests I might be in danger, show crisis resources first.',
          },
        },
      ],
    }),
  );

  return server;
}
