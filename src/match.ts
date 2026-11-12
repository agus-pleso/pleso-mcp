/**
 * Matching: turn short concern terms ("anxiety", "burnout", "issue.personal.sleep")
 * into Pleso taxonomy codes, then rank therapists by how strongly they work with
 * those concerns. Pure functions — no I/O — so they are unit-tested directly.
 */
import type { FacetOption, RegionCatalog, Therapist, TherapyType } from './catalog.js';

/** Extra plain-language phrases per code suffix (English). Labels/slugs are matched too. */
export const SYNONYMS: Record<string, string[]> = {
  // individual concerns
  anxiety_fear: ['anxiety', 'anxious', 'worry', 'worries', 'worrying', 'fear', 'nervous', 'overthinking'],
  mood_disorders: ['depression', 'depressed', 'bipolar', 'low mood', 'sadness', 'seasonal affective', 'sad'],
  stress_related_disorders: ['ptsd', 'post-traumatic', 'post traumatic', 'acute stress', 'flashbacks', 'cptsd'],
  traumatic_events: ['trauma', 'childhood trauma', 'past trauma', 'traumatic', 'childhood'],
  work_life_balance: ['burnout', 'burn out', 'burned out', 'exhaustion', 'exhausted', 'motivation', 'overwork', 'work-life'],
  stress: ['stress', 'stressed', 'pressure', 'tension'],
  relationships_partner: ['relationship', 'relationships', 'partner', 'boyfriend', 'girlfriend', 'husband', 'wife', 'marriage', 'romantic'],
  partner_search: ['dating', 'single', 'finding a partner', 'looking for love'],
  loss_grief: ['grief', 'grieving', 'bereavement', 'loss', 'death', 'mourning', 'lost someone'],
  self_esteem: ['self-esteem', 'self esteem', 'confidence', 'self-worth', 'self worth', 'insecurity', 'insecure'],
  sleep: ['insomnia', 'sleep', 'nightmares', "can't sleep"],
  addiction: ['alcohol', 'drinking', 'drugs', 'smoking', 'substance', 'addiction', 'addicted'],
  addiction_gaming: ['gambling', 'gaming', 'porn', 'pornography', 'behavioral addiction', 'behavioural addiction'],
  addiction_family: ['alcoholic parent', 'addicted partner', 'family addiction'],
  behavioural_disorders: ['eating disorder', 'anorexia', 'bulimia', 'binge eating', 'self-harm', 'self harm', 'tourette'],
  neurodiversity: ['autism', 'autistic', 'asd', 'asperger', 'neurodivergent'],
  adhd: ['adhd', 'attention deficit', 'hyperactivity'],
  divorce: ['breakup', 'break-up', 'break up', 'divorce', 'separation', 'separated'],
  emigration: ['immigration', 'emigration', 'moving abroad', 'expat', 'migrant'],
  adaptation: ['adapting', 'adjusting', 'new country', 'relocation', 'relocating', 'life change'],
  loneliness: ['lonely', 'loneliness', 'isolation', 'isolated', 'no friends'],
  anger: ['anger', 'angry', 'rage', 'irritability', 'temper'],
  panic_attacks: ['panic', 'panic attack', 'panic attacks'],
  phobias: ['phobia', 'phobias', 'fear of flying', 'social phobia'],
  obsessive_compulsive_disorder: ['ocd', 'obsessive', 'compulsive', 'intrusive thoughts'],
  procrastination: ['procrastination', 'procrastinate', 'putting things off'],
  perfectionism: ['perfectionism', 'perfectionist'],
  guilt_shame: ['guilt', 'shame', 'ashamed', 'guilty'],
  codependency: ['codependency', 'codependent', 'co-dependency'],
  personal_boundaries: ['boundaries', 'people pleasing', 'people-pleasing', "can't say no"],
  communication: ['conflict', 'arguments', 'communication'],
  parenting_pregnancy: ['pregnancy', 'pregnant', 'postpartum', 'postnatal', 'parenting', 'new parent', 'baby', 'motherhood', 'fatherhood'],
  child_loss: ['miscarriage', 'abortion', 'stillbirth', 'child loss', 'lost a child'],
  involuntary_childlessness: ['infertility', 'ivf', 'childlessness', "can't have children"],
  intimate_life: ['sex', 'sexual', 'intimacy', 'libido'],
  gender_identity: ['transgender', 'trans', 'non-binary', 'nonbinary', 'gender identity', 'gender dysphoria'],
  career_development_management: ['career', 'work problems', 'job', 'leadership'],
  dismissal_and_job_search: ['job loss', 'lost my job', 'fired', 'laid off', 'layoff', 'unemployed', 'unemployment', 'job search'],
  finances: ['money', 'debt', 'financial', 'finances'],
  psychosomatics: ['psychosomatic', 'somatic', 'chronic pain', 'body symptoms'],
  serious_diseases: ['cancer', 'oncology', 'chronic illness', 'serious illness', 'diagnosis'],
  life_meaning: ['meaning', 'purpose', 'existential', 'meaningless'],
  self_reflection: ['personal growth', 'self-development', 'self development', 'self-discovery', 'self discovery', 'self-awareness'],
  apathy: ['apathy', 'no energy', 'unmotivated', 'numb', 'emptiness'],
  emotional_confusion: ['overwhelmed', 'emotional turmoil', 'confused', 'mixed feelings'],
  age_crisis: ['midlife crisis', 'mid-life', 'quarter-life', 'age crisis', 'ageing', 'aging'],
  trust: ['trust', 'trust issues'],
  jealousy: ['jealousy', 'jealous'],
  betrayal: ['infidelity', 'cheating', 'cheated', 'affair', 'betrayal', 'betrayed'],
  abuse: ['abuse', 'violence', 'assault', 'rape', 'sexual abuse', 'domestic abuse'],
  relationships_abuse: ['abusive relationship', 'domestic violence', 'toxic relationship', 'narcissist', 'narcissistic', 'gaslighting'],
  bullying: ['bullying', 'bullied', 'harassment', 'mobbing'],
  stalking: ['stalking', 'stalker'],
  memory_concentration: ['focus', 'concentration', 'memory', 'brain fog'],
  learning_difficulties: ['dyslexia', 'learning difficulties', 'learning disability'],
  personality_disorders: ['bpd', 'borderline', 'personality disorder', 'npd'],
  paranoia: ['paranoia', 'paranoid'],
  race_culture: ['racism', 'race', 'cultural identity', 'ethnicity', 'discrimination'],
  faith_spirituality: ['religion', 'religious', 'faith', 'spiritual', 'spirituality'],
  relationships_family: ['family', 'parents', 'mother', 'father', 'siblings', 'in-laws', 'children'],
  // couple concerns (issue.pair.*)
  brink_divorce: ['on the brink', 'considering divorce', 'thinking about divorce', 'save our marriage'],
  conflict: ['fighting', 'fights', 'arguments', 'arguing', 'conflict'],
  long_distance: ['long distance', 'long-distance'],
  child_lose: ['miscarriage', 'child loss', 'lost a child'],
  // methods
  cbt: ['cbt', 'cognitive behavioral', 'cognitive behavioural'],
  behavioural_therapy: ['dbt', 'dialectical'],
  emdr: ['emdr'],
  ifs: ['ifs', 'internal family systems', 'parts work'],
  systemic_therapy: ['family therapy', 'systemic'],
  psychoanalysis: ['psychoanalysis', 'psychoanalytic', 'analyst'],
  psychodynamics: ['psychodynamic'],
  person_centered_therapy: ['person-centred', 'person-centered', 'humanistic', 'rogerian'],
  sexology: ['sex therapy', 'sexology', 'psychosexual'],
  // client groups
  lgbt: ['lgbt', 'lgbtq', 'gay', 'lesbian', 'bisexual', 'queer', 'trans'],
  relationships_lgbt: ['lgbt', 'lgbtq', 'gay', 'lesbian', 'same-sex', 'queer'],
  veterans: ['veteran', 'veterans', 'military', 'soldier', 'service member'],
  war: ['war'],
  war_persecution_displacement: ['war', 'refugee', 'displaced', 'persecution'],
  immigrants_expats: ['expat', 'expats', 'immigrant', 'immigrants', 'migrant'],
  students_young_adults: ['student', 'students', 'young adult', 'university', 'college'],
  elderly: ['older adult', 'senior', 'elderly', 'retired'],
  pregnant_women_mothers: ['pregnant', 'new mother', 'new parent', 'expecting'],
  parents_caregivers: ['parent', 'caregiver', 'carer'],
  suicidal_thoughts: ['suicidal', 'suicide', 'self-harm', 'self harm'],
};

const STOPWORDS = new Set([
  'and', 'the', 'with', 'for', 'incl', 'including', 'issues', 'problems', 'disorders', 'people', 'their', 'from', 'about', 'related',
]);

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}\p{N}+\s'-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function containsPhrase(haystack: string, phrase: string): boolean {
  if (!phrase) return false;
  const esc = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^\\p{L}\\p{N}])${esc}([^\\p{L}\\p{N}]|$)`, 'u').test(haystack);
}

const stem = (w: string) => w.slice(0, 5);

export interface ResolvedTerm {
  term: string;
  code: string;
  label: string;
}

/**
 * Resolve user/LLM-supplied terms to facet codes. Accepts exact codes, slugs,
 * English labels, common synonyms, or (as a last resort) shared word stems.
 * A single phrase such as "anxiety and insomnia" can resolve to several codes.
 */
export function resolveTerms(
  terms: string[],
  options: FacetOption[],
  maxPerTerm = 3,
): { resolved: ResolvedTerm[]; unmatched: string[] } {
  const resolved: ResolvedTerm[] = [];
  const unmatched: string[] = [];
  const seen = new Set<string>();
  const push = (term: string, o: FacetOption) => {
    if (seen.has(o.code)) return;
    seen.add(o.code);
    resolved.push({ term, code: o.code, label: o.label });
  };

  for (const rawTerm of terms) {
    const term = rawTerm.trim();
    if (!term) continue;
    const n = normalize(term);
    // 1. exact code / slug / suffix / label
    const exact = options.find(
      (o) =>
        o.code.toLowerCase() === term.toLowerCase() ||
        normalize(o.slug) === n ||
        normalize(o.slug.replace(/-/g, ' ')) === n ||
        normalize(o.code.split('.').pop()!.replace(/_/g, ' ')) === n ||
        normalize(o.label) === n ||
        (o.local_label !== undefined && normalize(o.local_label) === n),
    );
    if (exact) {
      push(term, exact);
      continue;
    }
    // 2. phrase match: synonyms + label phrases contained in the term
    const hits: { o: FacetOption; weight: number }[] = [];
    for (const o of options) {
      const suffix = o.code.split('.').pop()!;
      const phrases = [
        ...(SYNONYMS[suffix] ?? []),
        normalize(o.label.replace(/\(.*?\)/g, '')),
        suffix.replace(/_/g, ' '),
      ].map(normalize);
      let best = 0;
      for (const p of phrases) {
        if (p.length >= 3 && containsPhrase(n, p)) best = Math.max(best, p.length);
      }
      // the term is a sub-phrase of a label, e.g. "insomnia" in "Sleep Problems and Insomnia"
      const labelN = normalize(o.label);
      if (!best && n.length >= 4 && containsPhrase(labelN, n)) best = n.length;
      if (best) hits.push({ o, weight: best });
    }
    if (hits.length) {
      hits.sort((a, b) => b.weight - a.weight);
      hits.slice(0, maxPerTerm).forEach((h) => push(term, h.o));
      continue;
    }
    // 3. stem overlap with label words (handles "depressive", "phobic", etc.)
    const termStems = new Set(
      n.split(' ').filter((w) => w.length >= 4 && !STOPWORDS.has(w)).map(stem),
    );
    const stemHits = options.filter((o) =>
      normalize(o.label)
        .split(' ')
        .some((w) => w.length >= 4 && !STOPWORDS.has(w) && termStems.has(stem(w))),
    );
    if (stemHits.length) stemHits.slice(0, maxPerTerm).forEach((o) => push(term, o));
    else unmatched.push(term);
  }
  return { resolved, unmatched };
}

export function resolveLanguage(term: string, catalog: RegionCatalog): string | null {
  const n = normalize(term);
  const codes = new Set(catalog.therapists.flatMap((t) => t.languages));
  for (const code of codes) {
    const suffix = code.split('.').pop()!;
    const label = catalog.labels[code] ?? suffix;
    if (n === suffix || n === normalize(label) || (n.length >= 2 && suffix.startsWith(n))) return code;
  }
  const iso: Record<string, string> = {
    en: 'english', uk: 'ukrainian', ua: 'ukrainian', pl: 'polish', ro: 'romanian', ru: 'russian', de: 'german',
    es: 'spanish', fr: 'french', pt: 'portuguese', ar: 'arabic', tr: 'turkish', hi: 'hindi',
  };
  const mapped = iso[n];
  return mapped && codes.has(`language.${mapped}`) ? `language.${mapped}` : null;
}

export type AgeRange = '30-' | '30-40' | '40+';

export function ageRangeOf(t: Therapist, now = new Date()): AgeRange | null {
  if (!t.birthYear) return null;
  const age = now.getFullYear() - t.birthYear;
  return age < 30 ? '30-' : age <= 40 ? '30-40' : '40+';
}

export interface SearchCriteria {
  therapyType: TherapyType;
  concerns: string[]; // resolved codes
  methods: string[]; // resolved codes
  clientGroups: string[]; // resolved codes
  gender?: 'male' | 'female';
  ageRange?: AgeRange;
  language?: string; // language.* code
}

export interface RankedTherapist {
  therapist: Therapist;
  score: number; // 0–100
  concernLevels: { code: string; level: number }[];
  matchedMethods: string[];
  matchedGroups: string[];
}

const ISSUE_MAX = 5;

/**
 * Rank therapists. Hard filters: therapy type, gender, age range, language.
 * Concerns drive the score (mean published level, with a penalty for any
 * concern the therapist works with at a low level). Preferred methods and client
 * groups add a bonus but never exclude anyone.
 */
export function rankTherapists(therapists: Therapist[], c: SearchCriteria, now = new Date()): RankedTherapist[] {
  const pool = therapists.filter(
    (t) =>
      t.therapyTypes.includes(c.therapyType) &&
      (!c.gender || t.gender === c.gender) &&
      (!c.ageRange || ageRangeOf(t, now) === c.ageRange) &&
      (!c.language || t.languages.includes(c.language)),
  );
  const ranked = pool.map((t, index) => {
    const concernLevels = c.concerns.map((code) => ({ code, level: t.scores[code] ?? 0 }));
    let concernScore = 0.5; // neutral when no concerns given
    if (concernLevels.length) {
      const mean = concernLevels.reduce((s, x) => s + Math.min(x.level, ISSUE_MAX), 0) / (concernLevels.length * ISSUE_MAX);
      const weak = concernLevels.filter((x) => x.level < 3).length / concernLevels.length;
      concernScore = Math.max(0, mean - 0.25 * weak);
    }
    const matchedMethods = c.methods.filter((m) => (t.scores[m] ?? 0) >= 1);
    const matchedGroups = c.clientGroups.filter((g) => (t.scores[g] ?? 0) >= 2);
    const methodBonus = c.methods.length ? (matchedMethods.length / c.methods.length) * 0.1 : 0;
    const groupBonus = c.clientGroups.length ? (matchedGroups.length / c.clientGroups.length) * 0.1 : 0;
    const score = Math.round(Math.min(1, concernScore + methodBonus + groupBonus) * 100);
    return { therapist: t, score, concernLevels, matchedMethods, matchedGroups, index };
  });
  ranked.sort(
    (a, b) =>
      b.score - a.score ||
      (b.therapist.experienceYears ?? 0) - (a.therapist.experienceYears ?? 0) ||
      a.index - b.index,
  );
  return ranked.map(({ index: _i, ...r }) => r);
}

export function levelWord(level: number): string {
  if (level >= 5) return 'core specialty';
  if (level >= 4) return 'extensive experience';
  if (level >= 3) return 'experienced';
  if (level >= 1) return 'some experience';
  return 'not listed';
}
