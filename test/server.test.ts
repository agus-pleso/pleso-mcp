import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { beforeAll, describe, expect, it } from 'vitest';
import { PlesoWebCatalog, type Region } from '../src/catalog.js';
import { createServer } from '../src/server.js';
import { catalogHtml, therapistRaw } from './fixture.js';

// 25 therapists across 2 pages to exercise pagination.
const all = Array.from({ length: 25 }, (_, i) =>
  therapistRaw(`d${String(i).padStart(7, '0')}-0000-0000-0000-000000000000`, `Therapist ${i}`, {}, {
    'issue.personal.anxiety_fear': String((i % 5) + 1),
    'issue.personal.sleep': String(((i + 2) % 5) + 1),
  }),
);
const fetched: string[] = [];
const fakeFetch = async (url: string) => {
  fetched.push(url);
  const page = Number(new URL(url).searchParams.get('page') ?? 1);
  return catalogHtml(all.slice((page - 1) * 20, page * 20), { count: all.length });
};

let client: Client;
beforeAll(async () => {
  const server = createServer(new PlesoWebCatalog(fakeFetch));
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(a);
  client = new Client({ name: 'test', version: '0' });
  await client.connect(b);
});

const call = async (name: string, args: Record<string, unknown>) => {
  const r = await client.callTool({ name, arguments: args });
  return r as { isError?: boolean; structuredContent?: any; content: { type: string; text: string }[] };
};

describe('MCP server', () => {
  it('exposes read-only annotated tools', async () => {
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual([
      'get_crisis_resources',
      'get_pleso_info',
      'get_therapist_profile',
      'list_concerns',
      'search_therapists',
    ]);
    for (const t of tools) {
      expect(t.title ?? t.annotations?.title).toBeTruthy();
      expect(t.annotations).toMatchObject({ readOnlyHint: true, destructiveHint: false, openWorldHint: false });
      expect(t.name.length).toBeLessThanOrEqual(64);
    }
  });

  it('searches across all pages and returns profile links', async () => {
    const r = await call('search_therapists', { region: 'en' as Region, concerns: ['anxiety', 'insomnia'], limit: 3 });
    expect(r.isError).toBeFalsy();
    const s = r.structuredContent;
    expect(s.total_matching_therapists).toBe(25);
    expect(s.interpreted_as.concerns.map((c: any) => c.code)).toEqual(['issue.personal.anxiety_fear', 'issue.personal.sleep']);
    expect(s.therapists).toHaveLength(3);
    expect(s.therapists[0].profile_url).toMatch(/^https:\/\/pleso\.me\/en\/therapists\?psychologist_id=.+utm_source=ai_assistant/);
    expect(s.safety).toMatch(/not an emergency service/);
    expect(fetched.filter((u) => u.includes('page=2'))).toHaveLength(1);
    // JSON text mirror for clients without structuredContent support
    expect(JSON.parse(r.content[0]!.text).therapists).toHaveLength(3);
  });

  it('serves the cached catalog on subsequent calls', async () => {
    const before = fetched.length;
    await call('list_concerns', { region: 'en' });
    expect(fetched.length).toBe(before);
  });

  it('returns a profile and a helpful error for unknown ids', async () => {
    const search = await call('search_therapists', { concerns: ['anxiety'], limit: 1 });
    const id = search.structuredContent.therapists[0].id;
    const p = await call('get_therapist_profile', { therapist_id: id, region: 'en' });
    expect(p.structuredContent.education[0].title).toBe('MSc Counselling');
    const missing = await call('get_therapist_profile', { therapist_id: '00000000-dead-beef-0000-000000000000' });
    expect(missing.isError).toBe(true);
  });

  it('rejects couple therapy where not offered', async () => {
    const r = await call('search_therapists', { therapy_type: 'couple', concerns: ['conflict'] });
    expect(r.isError).toBe(true);
    expect(r.content[0]!.text).toMatch(/not offered/);
  });

  it('returns crisis resources with a fallback', async () => {
    const pl = await call('get_crisis_resources', { country: 'Poland' });
    expect(pl.structuredContent.crisis_lines.map((l: any) => l.contact)).toContain('800 70 2222');
    const unknown = await call('get_crisis_resources', { country: 'Atlantis' });
    expect(unknown.structuredContent.crisis_lines[0].url).toBe('https://findahelpline.com');
  });

  it('recovers every therapist when the site shuffles page order', async () => {
    let calls = 0;
    const shuffled = async (url: string) => {
      const page = Number(new URL(url).searchParams.get('page') ?? 1);
      // First read of page 2 repeats page 1's people; later reads are correct.
      const slice = page === 2 && calls++ === 0 ? all.slice(0, 5) : all.slice((page - 1) * 20, page * 20);
      return catalogHtml(slice, { count: all.length });
    };
    const cat = await new PlesoWebCatalog(shuffled).getCatalog('en');
    expect(cat.therapists).toHaveLength(25);
  });

  it('degrades gracefully when pleso.me is down', async () => {
    const server = createServer(new PlesoWebCatalog(async () => { throw new Error('boom'); }));
    const [a, b] = InMemoryTransport.createLinkedPair();
    await server.connect(a);
    const c = new Client({ name: 't', version: '0' });
    await c.connect(b);
    const r = (await c.callTool({ name: 'search_therapists', arguments: { region: 'pl', concerns: ['stress'] } })) as any;
    expect(r.isError).toBe(true);
    expect(r.content[0].text).toContain('https://pleso.me/pl/therapists/all');
  });
});
