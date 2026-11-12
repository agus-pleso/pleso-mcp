// Live smoke test: node scripts/smoke.mjs [url]  (default http://localhost:8080/mcp)
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const url = process.argv[2] ?? 'http://localhost:8080/mcp';
const client = new Client({ name: 'smoke', version: '0' });
await client.connect(new StreamableHTTPClientTransport(new URL(url)));
const { tools } = await client.listTools();
console.log('tools:', tools.map((t) => t.name).join(', '));
const call = async (name, args) => {
  const t0 = Date.now();
  const r = await client.callTool({ name, arguments: args });
  if (r.isError) throw new Error(`${name} failed: ${r.content[0].text}`);
  console.log(`\n${name} ${JSON.stringify(args)} (${Date.now() - t0}ms)`);
  return r.structuredContent;
};
const s = await call('search_therapists', { region: 'en', concerns: ['anxiety', 'burnout', "can't sleep"], limit: 3 });
console.log(' interpreted:', s.interpreted_as.concerns.map((c) => c.label).join(' | '), '| total:', s.total_matching_therapists, '| price:', s.price);
for (const t of s.therapists) console.log(`  ${t.match_score}  ${t.name} (${t.years_of_experience}y) ${t.matching_specialties.map((m) => m.level).join('/')}  ${t.profile_url.slice(0, 80)}…`);
const ua = await call('search_therapists', { region: 'ua', therapy_type: 'couple', concerns: ['conflict', 'infidelity'], limit: 2 });
console.log(' interpreted:', ua.interpreted_as.concerns.map((c) => c.code).join(', '), '| total:', ua.total_matching_therapists, ua.notes);
for (const t of ua.therapists) console.log(`  ${t.match_score}  ${t.name} langs=${t.languages.join(',')}`);
const pl = await call('search_therapists', { region: 'pl', concerns: ['depression', 'PTSD'], methods: ['CBT'], therapist_gender: 'female', limit: 2 });
console.log(' interpreted:', JSON.stringify(pl.interpreted_as), '| total:', pl.total_matching_therapists);
const p = await call('get_therapist_profile', { region: 'en', therapist_id: s.therapists[0].id });
console.log(' profile:', p.name, '| edu:', p.education.length, '| specialties:', p.specialties.slice(0, 3).map((x) => x.name).join(', '), '| methods:', p.methods.slice(0, 3).join(', '));
const lc = await call('list_concerns', { region: 'ro' });
console.log(' ro concerns:', lc.concerns.length, 'methods:', lc.methods.length, 'groups:', lc.client_groups.length, 'sample:', lc.concerns.slice(0, 2));
const info = await call('get_pleso_info', {});
for (const r of info.regions) console.log(`  ${r.region}: ${r.therapists} therapists, types=${r.therapy_types}, prices=${JSON.stringify(r.prices)}`);
const cr = await call('get_crisis_resources', { country: 'UA' });
console.log(' ', cr.crisis_lines.map((l) => l.contact).join(' | '));
await client.close();
