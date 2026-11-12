/**
 * Catalog source: reads Pleso's public therapist catalog.
 *
 * Today this reads the server-rendered `__NEXT_DATA__` JSON of the public
 * catalog pages (`https://pleso.me/{region}/therapists/all?page=N`), which is the
 * same published data any visitor sees. It is wrapped behind `CatalogSource` so it
 * can be swapped for a first-party JSON endpoint from the Pleso backend without
 * touching the matching logic or the MCP tools.
 *
 * No user data ever leaves the server through this module: requests to pleso.me
 * carry only the region and page number.
 */

export const REGIONS = ['en', 'ua', 'pl', 'ro'] as const;
export type Region = (typeof REGIONS)[number];

export const REGION_INFO: Record<Region, { name: string; audience: string; therapy_types: TherapyType[] }> = {
  en: {
    name: 'English',
    audience: 'English-language online therapy for clients anywhere in the world.',
    therapy_types: ['individual'],
  },
  ua: {
    name: 'Ukrainian',
    audience: 'Ukrainian-speaking therapists (many also speak Russian/English) for Ukrainians at home and abroad.',
    therapy_types: ['individual', 'couple'],
  },
  pl: {
    name: 'Polish',
    audience: 'Polish-language online therapy (Poland and Polish speakers abroad).',
    therapy_types: ['individual', 'couple'],
  },
  ro: {
    name: 'Romanian',
    audience: 'Romanian-language online therapy (Romania, Moldova and Romanian speakers abroad).',
    therapy_types: ['individual'],
  },
};

export type TherapyType = 'individual' | 'couple';
/** Pleso's internal service keys: catalog config uses `pair`, therapist records use `couple`. */
const SERVICE_CONFIG_KEY: Record<TherapyType, string> = { individual: 'personal', couple: 'pair' };
const SERVICE_RECORD_KEY: Record<TherapyType, string> = { individual: 'personal', couple: 'couple' };

export const PLESO_BASE = process.env.PLESO_BASE_URL ?? 'https://pleso.me';

export interface FacetOption {
  code: string; // e.g. issue.personal.anxiety_fear
  slug: string; // e.g. anxiety-fear
  label: string; // English label when known, else local label, else humanized code
  local_label?: string; // label in the region's language when it differs
}

export interface Facets {
  concerns: FacetOption[];
  methods: FacetOption[];
  client_groups: FacetOption[];
}

export interface Therapist {
  id: string;
  name: string;
  region: Region;
  gender: string | null;
  birthYear: number | null;
  experienceYears: number | null;
  educationType: string | null;
  city: string | null;
  photoUrl: string | null;
  videoUrl: string | null;
  therapyTypes: TherapyType[];
  /** issue.* / modality.* / group.* codes → numeric level as published (issues 1–5, others 0–3). */
  scores: Record<string, number>;
  /** language.* codes the therapist works in. */
  languages: string[];
  descriptions: { title: string; description: string }[];
  diplomas: { title: string; description: string }[];
}

export interface RegionCatalog {
  region: Region;
  fetchedAt: string;
  therapists: Therapist[];
  facets: Partial<Record<TherapyType, Facets>>;
  /** Every code → label we know (English first). */
  labels: Record<string, string>;
  /** Local-language labels from this region's bundle. */
  localLabels: Record<string, string>;
  /** Price strings exactly as Pleso publishes them for this region. */
  prices: Partial<Record<TherapyType, string>>;
}

export interface CatalogSource {
  getCatalog(region: Region): Promise<RegionCatalog>;
}

// ---------------------------------------------------------------------------
// Parsing (pure)
// ---------------------------------------------------------------------------

/* eslint-disable @typescript-eslint/no-explicit-any */

export function readNextData(html: string): any | null {
  const m = html.match(/<script id="__NEXT_DATA__" type="application\/json"[^>]*>([\s\S]*?)<\/script>/);
  if (!m?.[1]) return null;
  try {
    return JSON.parse(m[1]);
  } catch {
    return null;
  }
}

export function humanize(code: string): string {
  const suffix = code.split('.').pop() ?? code;
  const s = suffix.replace(/_/g, ' ').trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : code;
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

function yearsSince(date: unknown, now = new Date()): number | null {
  const s = str(date);
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  const years = (now.getTime() - d.getTime()) / (365.25 * 24 * 3600 * 1000);
  return years >= 0 ? Math.floor(years) : null;
}

export function parseTherapist(raw: any, region: Region, now = new Date()): Therapist | null {
  const id = str(raw?.worker_id) ?? str(raw?.worker_key);
  const name = str(raw?.worker_name_long) ?? str(raw?.worker_name);
  if (!id || !name) return null;
  const scores: Record<string, number> = {};
  const languages: string[] = [];
  for (const [code, value] of Object.entries(raw?.specialization ?? {})) {
    const n = Number(value);
    if (!Number.isFinite(n)) continue;
    if (code.startsWith('language.')) {
      if (n >= 1) languages.push(code);
    } else {
      scores[code] = n;
    }
  }
  const services: string[] = Array.isArray(raw?.active_services) ? raw.active_services : [];
  const therapyTypes = (Object.keys(SERVICE_RECORD_KEY) as TherapyType[]).filter((t) =>
    services.includes(SERVICE_RECORD_KEY[t]),
  );
  const birth = str(raw?.birthdate);
  const birthYear = birth ? Number(birth.slice(0, 4)) || null : null;
  const textBlocks = (arr: any): { title: string; description: string }[] =>
    Array.isArray(arr)
      ? arr
          .map((d: any) => ({ title: str(d?.title) ?? '', description: str(d?.description) ?? '' }))
          .filter((d: { title: string; description: string }) => d.title || d.description)
      : [];
  return {
    id: id.toLowerCase(),
    name,
    region,
    gender: str(raw?.gender),
    birthYear,
    experienceYears: yearsSince(raw?.experience_start_date, now),
    educationType: str(raw?.education_type),
    city: str(raw?.city),
    photoUrl: str(raw?.half_length_photo) ?? str(raw?.bust_photo),
    videoUrl: str(raw?.video_introduction_url),
    therapyTypes,
    scores,
    languages,
    descriptions: textBlocks(raw?.descriptions),
    diplomas: textBlocks(raw?.diplomas),
  };
}

function facetList(options: any, labels: Record<string, string>, local: Record<string, string>): FacetOption[] {
  if (!Array.isArray(options)) return [];
  return options
    .map((o: any) => {
      const code = str(o?.title);
      if (!code) return null;
      const label = labels[code] ?? local[code] ?? humanize(code);
      const localLabel = local[code];
      const opt: FacetOption = { code, slug: str(o?.url_title) ?? code, label };
      if (localLabel && localLabel !== label) opt.local_label = localLabel;
      return opt;
    })
    .filter((o: FacetOption | null): o is FacetOption => o !== null)
    .sort((a: FacetOption, b: FacetOption) => a.label.localeCompare(b.label));
}

export interface ParsedPage {
  therapists: Therapist[];
  totalCount: number;
  pageSize: number;
  configs: Record<string, any>;
  localLabels: Record<string, string>;
  priceStrings: Record<string, string>;
}

export function parseCatalogPage(html: string, region: Region, now = new Date()): ParsedPage {
  const data = readNextData(html);
  const pp = data?.props?.pageProps;
  if (!pp || !Array.isArray(pp.therapistsData)) {
    throw new Error(`Pleso catalog page for region "${region}" has an unexpected shape`);
  }
  const resources = pp.__i18n?.resources ?? {};
  const bundle = (Object.values(resources)[0] ?? {}) as any;
  const localLabels: Record<string, string> = {};
  for (const [k, v] of Object.entries(bundle.workerSkills ?? {})) if (typeof v === 'string') localLabels[k] = v;
  const priceStrings: Record<string, string> = {};
  for (const [k, v] of Object.entries(bundle.catalogPage ?? {})) {
    if (typeof v === 'string' && /price/i.test(k)) priceStrings[k] = v;
  }
  const therapists = pp.therapistsData
    .map((t: any) => parseTherapist(t, region, now))
    .filter((t: Therapist | null): t is Therapist => t !== null);
  return {
    therapists,
    totalCount: Number(pp.therapistsCount) || therapists.length,
    pageSize: pp.therapistsData.length || 20,
    configs: pp.api_catalog_config ?? {},
    localLabels,
    priceStrings,
  };
}

export function buildCatalog(
  region: Region,
  pages: ParsedPage[],
  englishLabels: Record<string, string>,
  now = new Date(),
): RegionCatalog {
  const first = pages[0];
  if (!first) throw new Error('no pages');
  const localLabels = first.localLabels;
  const labels: Record<string, string> = { ...localLabels, ...englishLabels };
  const seen = new Set<string>();
  const therapists: Therapist[] = [];
  for (const p of pages) {
    for (const t of p.therapists) {
      if (seen.has(t.id)) continue;
      seen.add(t.id);
      therapists.push(t);
    }
  }
  const facets: Partial<Record<TherapyType, Facets>> = {};
  const prices: Partial<Record<TherapyType, string>> = {};
  for (const type of Object.keys(SERVICE_CONFIG_KEY) as TherapyType[]) {
    const cfg = first.configs[SERVICE_CONFIG_KEY[type]];
    if (!cfg) continue;
    facets[type] = {
      concerns: facetList(cfg.requests, englishLabels, localLabels),
      methods: facetList(cfg.methods, englishLabels, localLabels),
      client_groups: facetList(cfg.groups, englishLabels, localLabels),
    };
    const price = first.priceStrings[`${SERVICE_CONFIG_KEY[type]}_price_min`];
    if (price) prices[type] = price;
  }
  return { region, fetchedAt: now.toISOString(), therapists, facets, labels, localLabels, prices };
}

// ---------------------------------------------------------------------------
// Fetching + caching
// ---------------------------------------------------------------------------

const TTL_MS = Number(process.env.CATALOG_TTL_SECONDS ?? 1800) * 1000;
const FETCH_TIMEOUT_MS = 15_000;
const MAX_PAGES = 40;
const CONCURRENCY = 6;
const MAX_ROUNDS = Number(process.env.CATALOG_MAX_ROUNDS ?? 6);

export function catalogPageUrl(region: Region, page: number): string {
  return `${PLESO_BASE}/${region}/therapists/all${page > 1 ? `?page=${page}` : ''}`;
}

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'PlesoMCP/0.1 (+https://pleso.me)', Accept: 'text/html' },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`GET ${url} → HTTP ${res.status}`);
  return res.text();
}

export class PlesoWebCatalog implements CatalogSource {
  private cache = new Map<Region, { data: RegionCatalog; expires: number }>();
  private inflight = new Map<Region, Promise<RegionCatalog>>();

  constructor(private readonly fetcher: (url: string) => Promise<string> = fetchHtml) {}

  /** Load every region (resolves when all have loaded or failed). */
  async warmUp(): Promise<void> {
    await Promise.all(
      REGIONS.map((r) =>
        this.getCatalog(r).then(
          (c) => console.log(`[pleso-mcp] warm-up ${r}: ${c.therapists.length} therapists`),
          (e) => console.warn(`[pleso-mcp] warm-up ${r} failed: ${(e as Error).message}`),
        ),
      ),
    );
  }

  async getCatalog(region: Region): Promise<RegionCatalog> {
    const hit = this.cache.get(region);
    if (hit && hit.expires > Date.now()) return hit.data;
    if (hit) {
      // Stale-while-revalidate: answer instantly, refresh in the background.
      if (!this.inflight.has(region)) void this.refresh(region, hit).catch(() => undefined);
      return hit.data;
    }
    const pending = this.inflight.get(region);
    if (pending) return pending;
    return this.refresh(region, hit);
  }

  private refresh(region: Region, hit: { data: RegionCatalog; expires: number } | undefined): Promise<RegionCatalog> {
    const p = this.load(region)
      .then((data) => {
        this.cache.set(region, { data, expires: Date.now() + TTL_MS });
        return data;
      })
      .catch((err) => {
        // Serve stale data rather than failing the user if pleso.me hiccups.
        if (hit) return hit.data;
        throw err;
      })
      .finally(() => this.inflight.delete(region));
    this.inflight.set(region, p);
    return p;
  }

  private async load(region: Region): Promise<RegionCatalog> {
    const first = parseCatalogPage(await this.fetcher(catalogPageUrl(region, 1)), region);
    const pageCount = Math.min(MAX_PAGES, Math.max(1, Math.ceil(first.totalCount / Math.max(1, first.pageSize))));
    const pages: ParsedPage[] = [first];
    const ids = new Set(first.therapists.map((t) => t.id));
    // pleso.me's default sort is partly randomised per request, so pages overlap.
    // Re-read pages and merge until every therapist is seen (bounded).
    for (let round = 0; round < MAX_ROUNDS && ids.size < first.totalCount && pageCount > 1; round++) {
      const remaining = Array.from({ length: pageCount - 1 }, (_, i) => i + 2);
      while (remaining.length) {
        const batch = remaining.splice(0, CONCURRENCY);
        const results = await Promise.all(
          batch.map((n) => this.fetcher(catalogPageUrl(region, n)).then((h) => parseCatalogPage(h, region))),
        );
        for (const r of results) r.therapists.forEach((t) => ids.add(t.id));
        pages.push(...results);
      }
    }
    if (ids.size < first.totalCount) {
      console.warn(`[pleso-mcp] region=${region}: loaded ${ids.size}/${first.totalCount} therapists`);
    }
    let englishLabels: Record<string, string> = {};
    if (region === 'en') englishLabels = first.localLabels;
    else {
      try {
        englishLabels = (await this.getCatalog('en')).localLabels;
      } catch {
        // English labels are a nicety; fall back to local labels.
      }
    }
    return buildCatalog(region, pages, englishLabels);
  }
}

// ---------------------------------------------------------------------------
// Links
// ---------------------------------------------------------------------------

const UTM = 'utm_source=ai_assistant&utm_medium=mcp&utm_campaign=pleso_mcp';

export function profileUrl(region: Region, id: string): string {
  return `${PLESO_BASE}/${region}/therapists?psychologist_id=${encodeURIComponent(id)}&${UTM}`;
}
export function catalogUrl(region: Region): string {
  return `${PLESO_BASE}/${region}/therapists/all?${UTM}`;
}
export function quizUrl(region: Region): string {
  return `${PLESO_BASE}/${region}/quiz-start?${UTM}`;
}
