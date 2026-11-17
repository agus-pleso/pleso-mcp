import { describe, expect, it } from 'vitest';
import { buildCatalog, parseCatalogPage } from '../src/catalog.js';
import { buildFeedItems, fetchSlots, parsePrice, parseSlot, regionNow, validateItems, type SlotMap } from '../src/feed.js';
import { catalogHtml, therapistRaw } from './fixture.js';

const now = new Date('2026-11-17T12:00:00Z');

function catalog() {
  const html = catalogHtml([therapistRaw('aaa', 'Anna Example'), therapistRaw('bbb', 'Bea Example')]);
  const c = buildCatalog('en', [parseCatalogPage(html, 'en', now)], {}, now);
  c.prices = { individual: 'from £59 / session' };
  return c;
}

describe('feed', () => {
  it('parses published price strings', () => {
    expect(parsePrice('from £59 / session', 'GBP')).toBe('59.00 GBP');
    expect(parsePrice('від 1 440 грн/сеанс', 'UAH')).toBe('1440.00 UAH');
    expect(parsePrice('od 199 zł/sesja*', 'PLN')).toBe('199.00 PLN');
    expect(parsePrice('Cena obowiązuje przy zakupie pakietu sesji. Cena regularna - 249 zł/sesja', 'PLN')).toBe('249.00 PLN');
    expect(parsePrice(undefined, 'GBP')).toBeNull();
  });

  it('uses the regular single-session price, not the bundle rate', () => {
    const html = catalogHtml([therapistRaw('aaa', 'Anna Example')]).replace(
      '</body>',
      '<p>* Single session - £79, with a bundle - from £74 down to £59 per session</p></body>',
    );
    const page = parseCatalogPage(html, 'en', now);
    expect(page.footnotePrice).toBe('£79');
    const c = buildCatalog('en', [page], {}, now);
    c.prices = { individual: 'from £59 / session' };
    expect(c.regularPrices?.individual).toBe('£79');
    const { items } = buildFeedItems(c, new Map(), { now });
    expect(items[0]?.price).toBe('79.00 GBP');
    expect(items[0]?.description).toContain('from 59.00 GBP per session');
  });

  it("keeps slot times as the region's local wall-clock time", () => {
    expect(parseSlot('2026-11-18T15:00:00')).toBe('2026-11-18T15:00:00.000Z');
    expect(parseSlot('nope')).toBeNull();
    // 12:00 UTC is 14:00 in Kyiv, so a 13:00 Kyiv slot is already in the past there.
    expect(regionNow(now, 'ua')).toBe('2026-11-17T14:00:00.000Z');
    expect(regionNow(now, 'en')).toBe('2026-11-17T12:00:00.000Z');
    const c = catalog();
    c.region = 'ua';
    c.prices = { individual: 'від 1440 грн/сеанс' };
    const slots: SlotMap = new Map([['aaa', { individual: ['2026-11-17T13:00:00.000Z', '2026-11-17T15:00:00.000Z'] }]]);
    const { items } = buildFeedItems(c, slots, { now });
    expect(items[0]?.description).toContain('Tue 17 Nov, 15:00');
    expect(items[0]?.description).not.toContain('13:00');
  });

  it('batches slot requests per session type', async () => {
    const c = catalog();
    const urls: string[] = [];
    const slots = await fetchSlots('en', c.therapists, async (url) => {
      urls.push(url);
      return [{ worker_id: 'AAA', slots_start_time: ['2026-11-19T10:00:00', '2026-11-18T08:00:00'] }];
    });
    expect(urls).toHaveLength(1);
    expect(urls[0]).toContain('service_name=personal');
    expect(urls[0]).toContain('worker_id=aaa&worker_id=bbb');
    expect(slots.get('aaa')?.individual).toEqual(['2026-11-18T08:00:00.000Z', '2026-11-19T10:00:00.000Z']);
  });

  it('builds one valid item per therapist with slots in the description', () => {
    const slots: SlotMap = new Map([['aaa', { individual: ['2026-11-16T08:00:00.000Z', '2026-11-18T08:00:00.000Z'] }]]);
    const { items, skipped } = buildFeedItems(catalog(), slots, { now });
    expect(skipped).toEqual([]);
    expect(validateItems(items)).toEqual([]);
    const [a, b] = items;
    expect(a?.item_id).toBe('en-aaa-individual');
    expect(a?.availability).toBe('in_stock');
    expect(a?.price).toBe('59.00 GBP');
    expect(a?.target_countries).toEqual(['GB']);
    expect(a?.description).toContain('Wed 18 Nov, 08:00');
    expect(a?.description).not.toContain('16 Nov'); // past slot dropped
    expect(b?.availability).toBe('out_of_stock');
  });

  it('emits one grouped row per slot in variants mode', () => {
    const slots: SlotMap = new Map([['aaa', { individual: ['2026-11-18T08:00:00.000Z', '2026-11-18T09:00:00.000Z'] }]]);
    const { items } = buildFeedItems(catalog(), slots, { now, slotMode: 'variants' });
    expect(validateItems(items)).toEqual([]);
    const variants = items.filter((i) => i.group_id === 'en-aaa-individual');
    expect(variants).toHaveLength(2);
    expect(variants[0]?.variant_dict?.session_time).toContain('08:00');
    expect(items).toHaveLength(3); // + therapist bbb without slots
  });
});
