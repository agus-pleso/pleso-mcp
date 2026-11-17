/**
 * Scrape pleso.me's public catalog + open timeslots and write the ChatGPT
 * product feed to feed/pleso-therapists.jsonl(.gz).
 *
 *   npm run feed:build
 *
 * Env: FEED_REGIONS=en,ua,pl,ro  FEED_SLOT_MODE=summary|variants  FEED_MAX_SLOTS=12
 *      FEED_STORE_COUNTRY=PL     FEED_MIN_COVERAGE=0.9
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import type { Region } from '../src/catalog.js';
import type { FeedItem } from '../src/feed.js';

// The catalog's shuffled pagination needs extra passes to reach every therapist;
// a daily batch job can afford more of them than the live MCP server.
process.env.CATALOG_MAX_ROUNDS ??= '20';
const { PlesoWebCatalog, REGIONS } = await import('../src/catalog.js');
const { buildFeedItems, fetchSlots, toJsonl, validateItems } = await import('../src/feed.js');

export const FEED_DIR = 'feed';
export const FEED_FILE = 'pleso-therapists.jsonl.gz';

const regions = (process.env.FEED_REGIONS?.split(',').map((r) => r.trim()) ?? [...REGIONS]).filter(
  (r): r is Region => (REGIONS as readonly string[]).includes(r),
);
const slotMode = process.env.FEED_SLOT_MODE === 'variants' ? 'variants' : 'summary';
const maxSlots = Number(process.env.FEED_MAX_SLOTS ?? 12);
const storeCountry = process.env.FEED_STORE_COUNTRY ?? 'PL';
const minCoverage = Number(process.env.FEED_MIN_COVERAGE ?? 0.9);

const source = new PlesoWebCatalog();
const now = new Date();
const items: FeedItem[] = [];
let failed = false;

for (const region of regions) {
  const catalog = await source.getCatalog(region);
  const slots = await fetchSlots(region, catalog.therapists);
  const built = buildFeedItems(catalog, slots, { slotMode, maxSlots, storeCountry, now });
  items.push(...built.items);
  const withSlots = built.items.filter((i) => i.availability === 'in_stock').length;
  console.log(
    `${region}: ${catalog.therapists.length} therapists → ${built.items.length} items (${withSlots} with open slots, ${built.skipped.length} skipped)`,
  );
  for (const s of built.skipped.slice(0, 5)) console.log(`  skipped ${s.id}: ${s.reason}`);
  // A daily snapshot replaces the previous one, so never publish a half-scraped region.
  if (slots.size < catalog.therapists.length * minCoverage) {
    console.error(`${region}: slots returned for only ${slots.size}/${catalog.therapists.length} therapists`);
    failed = true;
  }
}

const errors = validateItems(items);
if (errors.length) {
  console.error(`${errors.length} validation errors:\n  ${errors.slice(0, 20).join('\n  ')}`);
  failed = true;
}
if (!items.length) failed = true;
if (failed) {
  console.error('Feed NOT written.');
  process.exit(1);
}

mkdirSync(FEED_DIR, { recursive: true });
const jsonl = toJsonl(items);
writeFileSync(`${FEED_DIR}/pleso-therapists.jsonl`, jsonl);
writeFileSync(`${FEED_DIR}/${FEED_FILE}`, gzipSync(jsonl));
console.log(`Wrote ${items.length} items to ${FEED_DIR}/${FEED_FILE} (${(jsonl.length / 1024).toFixed(0)} KB uncompressed)`);
