/**
 * ChatGPT product feed: one item per therapist and session type, with the
 * therapist's next open timeslots.
 *
 * Everything here comes from what pleso.me already publishes to any visitor:
 * the catalog (see catalog.ts) and the slots endpoint its booking widget calls.
 * Field names follow OpenAI's product feed schema
 * (https://developers.openai.com/commerce/specs/file-upload/products).
 */

import { PLESO_BASE, type Region, type RegionCatalog, type Therapist, type TherapyType } from './catalog.js';

export const SLOTS_API = `${PLESO_BASE}/api/core_api/v5/available_slots/default/`;

/** Service name as the slots endpoint and therapist records spell it. */
const SLOT_SERVICE: Record<TherapyType, string> = { individual: 'personal', couple: 'couple' };
/** Price string key in the catalog bundle. */
export const SESSION_MINUTES: Record<TherapyType, number> = { individual: 50, couple: 80 };

export const REGION_MARKET: Record<Region, { country: string; currency: string; timeZone: string; locale: string }> = {
  en: { country: 'GB', currency: 'GBP', timeZone: 'Europe/London', locale: 'en-GB' },
  ua: { country: 'UA', currency: 'UAH', timeZone: 'Europe/Kyiv', locale: 'uk-UA' },
  pl: { country: 'PL', currency: 'PLN', timeZone: 'Europe/Warsaw', locale: 'pl-PL' },
  ro: { country: 'RO', currency: 'RON', timeZone: 'Europe/Bucharest', locale: 'ro-RO' },
};

export interface FeedOptions {
  /** `summary`: one row per therapist + session type, slots listed in the description.
   *  `variants`: additionally one row per open slot, grouped under the therapist. */
  slotMode: 'summary' | 'variants';
  /** How many upcoming slots to list (summary) or emit (variants) per therapist + session type. */
  maxSlots: number;
  storeCountry: string;
  now: Date;
}

export const DEFAULT_OPTIONS: FeedOptions = { slotMode: 'summary', maxSlots: 12, storeCountry: 'PL', now: new Date() };

export interface FeedItem {
  item_id: string;
  title: string;
  description: string;
  url: string;
  brand: string;
  seller_name: string;
  seller_url: string;
  image_url: string;
  availability: 'in_stock' | 'out_of_stock';
  price: string;
  target_countries: string[];
  store_country: string;
  product_category: string;
  seller_privacy_policy: string;
  seller_tos: string;
  additional_image_urls?: string[];
  group_id?: string;
  listing_has_variations?: boolean;
  variant_dict?: Record<string, string>;
}

/**
 * therapist id → session type → slot start times.
 * Slots are wall-clock times in the region's own time zone (the site shows them
 * unconverted, e.g. "Ukrainian time"). They are held as ISO strings with a "Z"
 * only so they sort and format easily; they are never converted between zones.
 */
export type SlotMap = Map<string, Partial<Record<TherapyType, string[]>>>;

// ---------------------------------------------------------------------------
// Slots
// ---------------------------------------------------------------------------

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'PlesoFeed/0.1 (+https://pleso.me)', Accept: 'application/json' },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`GET ${url.slice(0, 120)}… → HTTP ${res.status}`);
  return res.json();
}

/** Normalise the endpoint's naive local timestamp ("2026-11-18T15:00:00"). */
export function parseSlot(raw: string): string | null {
  const m = raw.match(/^\d{4}-\d\d-\d\dT\d\d:\d\d(:\d\d)?/);
  if (!m) return null;
  const d = new Date(`${m[0]}Z`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** The current wall-clock time in a region, in the same form as parseSlot's output. */
export function regionNow(now: Date, region: Region): string {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: REGION_MARKET[region].timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(now)
      .map((x) => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}.000Z`;
}

export async function fetchSlots(
  region: Region,
  therapists: Therapist[],
  fetcher: (url: string) => Promise<unknown> = fetchJson,
  batchSize = 25,
): Promise<SlotMap> {
  const out: SlotMap = new Map();
  for (const type of Object.keys(SLOT_SERVICE) as TherapyType[]) {
    const ids = therapists.filter((t) => t.therapyTypes.includes(type)).map((t) => t.id);
    for (let i = 0; i < ids.length; i += batchSize) {
      const params = new URLSearchParams({ config_id: region, service_name: SLOT_SERVICE[type] });
      for (const id of ids.slice(i, i + batchSize)) params.append('worker_id', id);
      const rows = await fetcher(`${SLOTS_API}?${params}`);
      if (!Array.isArray(rows)) throw new Error(`slots response for region "${region}" has an unexpected shape`);
      for (const row of rows) {
        const id = typeof row?.worker_id === 'string' ? row.worker_id.toLowerCase() : null;
        if (!id || !Array.isArray(row.slots_start_time)) continue;
        const slots = (row.slots_start_time as unknown[])
          .map((s) => (typeof s === 'string' ? parseSlot(s) : null))
          .filter((s): s is string => s !== null)
          .sort();
        out.set(id, { ...out.get(id), [type]: slots });
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Items (pure)
// ---------------------------------------------------------------------------

/** "from £59 / session" → "59.00 GBP"; "Звичайна ціна - 1690 грн/сеанс" → "1690.00 UAH" (first amount wins). */
export function parsePrice(text: string | undefined, currency: string): string | null {
  const m = text?.replace(/[\s ](?=\d{3}\b)/g, '').match(/\d+(?:[.,]\d{1,2})?/);
  if (!m) return null;
  const n = Number(m[0].replace(',', '.'));
  return n > 0 ? `${n.toFixed(2)} ${currency}` : null;
}

export function formatSlot(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC', // slots are already local wall-clock times; print them as they are
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso));
}

function clip(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max - 1).trimEnd()}…`;
}

function topLabels(t: Therapist, prefix: string, labels: Record<string, string>, min: number, max: number): string[] {
  return Object.entries(t.scores)
    .filter(([code, level]) => code.startsWith(prefix) && level >= min && labels[code])
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([code]) => labels[code] as string);
}

export function feedUrl(region: Region, id: string): string {
  return `${PLESO_BASE}/${region}/therapists?psychologist_id=${encodeURIComponent(id)}&utm_source=chatgpt&utm_medium=product_feed&utm_campaign=pleso_feed`;
}

function describe(
  t: Therapist,
  type: TherapyType,
  catalog: RegionCatalog,
  upcoming: string[],
  total: number,
  price: string,
  bundlePrice: string | null,
): string {
  const { timeZone } = REGION_MARKET[t.region];
  const servicePrefix = type === 'couple' ? 'pair' : 'personal';
  const parts: string[] = [];
  parts.push(
    `${SESSION_MINUTES[type]}-minute online video ${type === 'couple' ? 'couples' : 'individual'} therapy session with ${t.name} on Pleso Therapy.`,
  );
  const facts: string[] = [];
  if (t.experienceYears) facts.push(`${t.experienceYears} years of experience`);
  const langs = t.languages.map((c) => catalog.labels[c]).filter(Boolean);
  if (langs.length) facts.push(`works in ${langs.join(', ')}`);
  if (t.gender === 'female' || t.gender === 'male') facts.push(`${t.gender} therapist`);
  if (facts.length) parts.push(`${facts.join('; ')}.`.replace(/^./, (c) => c.toUpperCase()));
  const concerns = topLabels(t, `issue.${servicePrefix}.`, catalog.labels, 4, 10);
  if (concerns.length) parts.push(`Main expertise: ${concerns.join(', ')}.`);
  const alsoConcerns = topLabels(t, `issue.${servicePrefix}.`, catalog.labels, 3, 30).filter((l) => !concerns.includes(l));
  if (alsoConcerns.length) parts.push(`Also works with: ${alsoConcerns.slice(0, 15).join(', ')}.`);
  const methods = topLabels(t, `modality.${servicePrefix}.`, catalog.labels, 1, 10);
  if (methods.length) parts.push(`Methods: ${methods.join(', ')}.`);
  // Some group labels are phrased as intake questions; those don't read as a client group.
  const groups = topLabels(t, `group.${servicePrefix}.`, catalog.labels, 3, 8).filter((l) => !l.includes('?'));
  if (groups.length) parts.push(`Experienced with: ${groups.join(', ')}.`);
  const education = t.diplomas
    .slice(0, 5)
    .map((d) => [d.title, d.description.replace(/\s*\n\s*/g, ', ')].filter(Boolean).join(' ('))
    .map((s) => (s.includes(' (') ? `${s})` : s));
  if (education.length) parts.push(`Education: ${education.join('; ')}.`);
  if (t.videoUrl) parts.push(`Video introduction: ${t.videoUrl}`);
  parts.push(
    `Price: ${price} per session.` +
      (bundlePrice ? ` With a session bundle the price starts from ${bundlePrice} per session.` : ''),
  );
  parts.push(
    upcoming.length
      ? `Next available sessions (${timeZone} time): ${upcoming.map((s) => formatSlot(s)).join('; ')}.` +
          (total > upcoming.length ? ` ${total} open slots in total.` : '') +
          ' Times are a daily snapshot; pick the exact slot on the booking page.'
      : 'No open slots right now; check the profile for new availability.',
  );
  const head = parts.join('\n');
  const about = t.descriptions
    .map((d) => [d.title, d.description].filter(Boolean).join(': '))
    .join('\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[ \t]+/g, ' ');
  return clip(about ? `${head}\n\n${about}` : head, 5000);
}

export interface BuildResult {
  items: FeedItem[];
  skipped: { id: string; reason: string }[];
}

export function buildFeedItems(catalog: RegionCatalog, slots: SlotMap, options: Partial<FeedOptions> = {}): BuildResult {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const market = REGION_MARKET[catalog.region];
  const items: FeedItem[] = [];
  const skipped: BuildResult['skipped'] = [];
  const localNow = regionNow(opts.now, catalog.region);
  for (const t of catalog.therapists) {
    for (const type of t.therapyTypes) {
      // `price` must be what one session costs on the landing page; the "from" price is the bundle rate.
      const fromPrice = parsePrice(catalog.prices[type], market.currency);
      const price = parsePrice(catalog.regularPrices?.[type], market.currency) ?? fromPrice;
      const bundlePrice = fromPrice && price && parseFloat(fromPrice) < parseFloat(price) ? fromPrice : null;
      if (!price) {
        skipped.push({ id: t.id, reason: `no ${type} price published for region ${catalog.region}` });
        continue;
      }
      if (!t.photoUrl) {
        skipped.push({ id: t.id, reason: 'no photo' });
        continue;
      }
      const future = (slots.get(t.id)?.[type] ?? []).filter((s) => s > localNow);
      const upcoming = future.slice(0, opts.maxSlots);
      const base: FeedItem = {
        item_id: `${catalog.region}-${t.id}-${type}`,
        title: clip(
          `${t.name}: online ${type === 'couple' ? 'couples' : 'individual'} therapy session (${SESSION_MINUTES[type]} min)`,
          150,
        ),
        description: describe(t, type, catalog, upcoming, future.length, price, bundlePrice),
        url: feedUrl(catalog.region, t.id),
        brand: 'Pleso Therapy',
        seller_name: 'Pleso Therapy',
        seller_url: `${PLESO_BASE}/${catalog.region}`,
        image_url: t.photoUrl,
        availability: future.length ? 'in_stock' : 'out_of_stock',
        price,
        target_countries: [market.country],
        store_country: opts.storeCountry,
        product_category: 'Health & Wellness > Mental Health > Online Therapy',
        seller_privacy_policy: `${PLESO_BASE}/${catalog.region}/legal/privacy-policy`,
        seller_tos: `${PLESO_BASE}/${catalog.region}/terms-of-service`,
        ...(t.extraPhotoUrl ? { additional_image_urls: [t.extraPhotoUrl] } : {}),
      };
      if (opts.slotMode === 'variants' && upcoming.length) {
        for (const s of upcoming) {
          const label = formatSlot(s);
          items.push({
            ...base,
            item_id: `${base.item_id}-${s.slice(0, 16).replace(/[-:T]/g, '')}`,
            title: clip(`${base.title}, ${label}`, 150),
            group_id: base.item_id,
            listing_has_variations: true,
            variant_dict: { session_time: `${label} (${market.timeZone})` },
          });
        }
      } else {
        items.push(base);
      }
    }
  }
  return { items, skipped };
}

// ---------------------------------------------------------------------------
// Validation + serialisation
// ---------------------------------------------------------------------------

const REQUIRED: (keyof FeedItem)[] = [
  'item_id', 'title', 'description', 'url', 'brand', 'seller_name', 'image_url',
  'availability', 'price', 'target_countries', 'store_country',
];

export function validateItems(items: FeedItem[]): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const it of items) {
    for (const k of REQUIRED) {
      const v = it[k];
      if (v === undefined || v === '' || (Array.isArray(v) && !v.length)) errors.push(`${it.item_id}: missing ${k}`);
    }
    if (seen.has(it.item_id)) errors.push(`${it.item_id}: duplicate item_id`);
    seen.add(it.item_id);
    if (it.title.length > 150) errors.push(`${it.item_id}: title over 150 characters`);
    if (it.description.length > 5000) errors.push(`${it.item_id}: description over 5000 characters`);
    if (!/^\d+\.\d{2} [A-Z]{3}$/.test(it.price)) errors.push(`${it.item_id}: bad price "${it.price}"`);
    for (const k of ['url', 'image_url'] as const) {
      if (!/^https:\/\/\S+$/.test(it[k])) errors.push(`${it.item_id}: ${k} is not an https URL`);
    }
    if (it.group_id && it.group_id === it.item_id) errors.push(`${it.item_id}: group_id equals item_id`);
  }
  return errors;
}

export function toJsonl(items: FeedItem[]): string {
  return items.map((i) => JSON.stringify(i)).join('\n') + '\n';
}
