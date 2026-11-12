/**
 * Public web pages served next to the MCP endpoint. The marketplaces need these:
 *   /docs     what the connector does + how to connect (indexable)
 *   /privacy  connector privacy notice (noindex; the main Privacy Policy lives on pleso.me)
 *   /logo.png, /favicon.png, /robots.txt
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { SERVER_VERSION } from './server.js';

export const PUBLIC_URL =
  process.env.PUBLIC_URL ?? 'https://pleso-mcp--product-team-products.europe-west4.hosted.app';
const MCP_URL = `${PUBLIC_URL}/mcp`;
const MAIN_PRIVACY = 'https://pleso.me/en/legal/privacy-policy';
const TERMS = 'https://pleso.me/en/legal/terms-and-conditions-2026-06-16';
const SUPPORT = 'hello@pleso.me';
const DPO = 'iod@pleso.me';
const UPDATED = '12 November 2026';

export interface Page {
  status: number;
  type: string;
  body: string | Buffer;
  headers?: Record<string, string>;
}

function asset(name: string): Buffer | null {
  try {
    return readFileSync(fileURLToPath(new URL(`../assets/${name}`, import.meta.url)));
  } catch {
    return null;
  }
}
const LOGO = asset('logo.png');
const FAVICON = asset('favicon.png');

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function layout(title: string, description: string, body: string, opts: { noindex?: boolean; path: string }): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
${opts.noindex ? '<meta name="robots" content="noindex">' : `<link rel="canonical" href="${PUBLIC_URL}${opts.path}">`}
<link rel="icon" type="image/png" href="/favicon.png">
<style>
  :root { --brand:#00acc8; --ink:#1d2730; --muted:#5b6770; --line:#e3e9ec; --bg:#ffffff; --soft:#f3f8f9; }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--bg); color:var(--ink); font:16px/1.6 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif; }
  main { max-width:760px; margin:0 auto; padding:32px 16px 64px; }
  header { display:flex; align-items:center; gap:12px; margin-bottom:8px; }
  header img { width:44px; height:44px; }
  header a { color:var(--ink); text-decoration:none; font-weight:700; font-size:20px; }
  h1 { font-size:28px; line-height:1.25; margin:24px 0 8px; }
  h2 { font-size:20px; margin:36px 0 8px; }
  p, li { color:var(--ink); }
  .lede { color:var(--muted); font-size:18px; }
  a { color:#007c91; }
  code { background:var(--soft); border:1px solid var(--line); border-radius:4px; padding:1px 5px; font-size:14px; word-break:break-all; }
  .box { background:var(--soft); border:1px solid var(--line); border-radius:10px; padding:14px 16px; margin:16px 0; }
  .safety { border-left:4px solid #d9534f; background:#fdf3f2; border-radius:6px; padding:12px 16px; margin:20px 0; }
  table { border-collapse:collapse; width:100%; font-size:15px; }
  th, td { text-align:left; vertical-align:top; padding:8px 10px; border-bottom:1px solid var(--line); }
  th { color:var(--muted); font-weight:600; }
  footer { margin-top:48px; padding-top:16px; border-top:1px solid var(--line); color:var(--muted); font-size:14px; }
</style>
</head>
<body><main>
<header><img src="/logo.png" alt="" width="44" height="44"><a href="https://pleso.me">Pleso Therapy</a></header>
${body}
<footer>
  Pleso Therapy sp. z o.o. · ul. 12 Lutego 25/7, 82-300 Elbląg, Poland · KRS 0000980227<br>
  <a href="/docs">Connector docs</a> · <a href="/privacy">Connector privacy notice</a> ·
  <a href="${MAIN_PRIVACY}">Privacy Policy</a> · <a href="${TERMS}">Terms</a> · <a href="mailto:${SUPPORT}">${SUPPORT}</a>
</footer>
</main></body>
</html>`;
}

function docsPage(): string {
  const body = `
<h1>Pleso Therapy for AI assistants</h1>
<p class="lede">Find an online therapist on Pleso from inside Claude, ChatGPT, Gemini, Perplexity, Copilot or any app that supports the Model Context Protocol (MCP).</p>

<p>Tell your assistant what you'd like help with, for example anxiety, burnout, grief, relationship problems, trauma or sleep. It searches Pleso's directory of vetted therapists and ranks them by how much experience they have with exactly those concerns. It then explains why each therapist is a match. You can filter by therapy language (English, Ukrainian, Polish or Romanian), individual or couple therapy, therapist gender or age, and preferred method such as CBT, EMDR or Gestalt. Booking happens on <a href="https://pleso.me">pleso.me</a>.</p>

<div class="safety"><strong>Not for emergencies.</strong> Pleso is not an emergency service and the connector does not diagnose. If you or someone else is in danger, call your local emergency number (112 in the EU and UK, 911 in North America) or a crisis line. You can also visit <a href="https://findahelpline.com">findahelpline.com</a>.</div>

<h2>Connect</h2>
<div class="box">Server URL: <code>${MCP_URL}</code><br>Transport: Streamable HTTP · Authentication: none</div>
<table>
<tr><th>App</th><th>How</th></tr>
<tr><td>Claude</td><td>Settings → Connectors → Add custom connector → paste the server URL.</td></tr>
<tr><td>ChatGPT</td><td>Settings → Apps &amp; Connectors → Advanced → Developer mode → Create → paste the server URL, authentication "None".</td></tr>
<tr><td>Perplexity</td><td>Settings → Connectors → Add custom → MCP connector → paste the server URL, authentication "None".</td></tr>
<tr><td>Gemini CLI</td><td><code>gemini extensions install https://github.com/agus-pleso/pleso-mcp</code></td></tr>
<tr><td>Claude Code</td><td><code>claude mcp add --transport http pleso ${MCP_URL}</code></td></tr>
<tr><td>VS Code / Cursor</td><td><code>{"servers":{"pleso":{"type":"http","url":"${MCP_URL}"}}}</code></td></tr>
</table>

<h2>Try asking</h2>
<ul>
<li>"I've been really anxious and can't sleep. Can you find me a therapist on Pleso?"</li>
<li>"Find a female Ukrainian-speaking therapist on Pleso who works with burnout and uses CBT."</li>
<li>"My partner and I keep fighting. Are there couple therapists on Pleso in Polish?"</li>
<li>"Compare the top 3 Pleso therapists for grief and show me their education."</li>
<li>"How much does a session on Pleso cost in Romania?"</li>
</ul>

<h2>Tools</h2>
<table>
<tr><th>Tool</th><th>What it does</th></tr>
<tr><td><code>search_therapists</code></td><td>Ranks therapists for up to 5 concerns. Filters for language, therapy type, therapist gender and age, methods and client groups. Returns a match score, the reasons for the match, a short bio and a profile link.</td></tr>
<tr><td><code>get_therapist_profile</code></td><td>Full public profile: approach, education, specialties, methods, languages, intro video, price.</td></tr>
<tr><td><code>list_concerns</code></td><td>The concerns, methods and client groups you can search by in each language.</td></tr>
<tr><td><code>get_pleso_info</code></td><td>How Pleso works, current starting prices, and links to the directory and the matching quiz.</td></tr>
<tr><td><code>get_crisis_resources</code></td><td>Emergency numbers and free crisis lines by country.</td></tr>
</table>
<p>All tools are read-only. They can't book, pay or change anything, and they need no Pleso account.</p>

<h2>How matching works</h2>
<p>Each Pleso therapist publishes how much experience they have with each concern, on a scale from 1 to 5. The match score is the average of those levels for the concerns you ask about. A therapist loses points for any concern they work with only a little, and gets a small bonus for preferred methods or client groups. There is no paid placement.</p>

<h2>Privacy</h2>
<p>The connector receives only search filters, such as language and short concern keywords. It stores none of them, creates no account and sets no cookies. Details are in the <a href="/privacy">connector privacy notice</a>.</p>

<h2>Support</h2>
<p>Email <a href="mailto:${SUPPORT}">${SUPPORT}</a>. Version ${SERVER_VERSION}.</p>`;
  return layout(
    'Pleso Therapy connector for Claude, ChatGPT, Gemini and Perplexity',
    "Find an online therapist on Pleso from inside your AI assistant. Setup, tools, example prompts and privacy.",
    body,
    { path: '/docs' },
  );
}

function privacyPage(): string {
  const body = `
<h1>Pleso Therapy AI connector: privacy notice</h1>
<p class="lede">Last updated ${UPDATED}. This notice adds to the <a href="${MAIN_PRIVACY}">Pleso Privacy Policy</a> and applies only to the Pleso Therapy connector for AI assistants (the "Connector").</p>

<h2>Who we are</h2>
<p>The Connector is operated by Pleso Therapy sp. z o.o., ul. 12 Lutego 25/7, 82-300 Elbląg, Poland (KRS 0000980227), the data controller. Our Data Protection Officer can be reached at <a href="mailto:${DPO}">${DPO}</a>.</p>

<h2>What the Connector receives</h2>
<p>When your AI assistant uses the Connector, it sends only the search filters needed to answer you. These are:</p>
<ul>
<li>the therapy language or region</li>
<li>up to five short concern keywords (for example "anxiety" or "burnout")</li>
<li>optional preferences: individual or couple therapy, therapist gender or age range, language, therapy method or client group</li>
<li>when you open a profile, the therapist's ID</li>
</ul>
<p>The Connector is designed so that assistants do not send your name, contact details, conversation history or personal stories. Please don't include them in requests.</p>

<h2>How we use it</h2>
<ul>
<li>Only to search and rank therapists in Pleso's public directory and return the results to your assistant.</li>
<li>We do not store search filters. We do not create accounts, set cookies, build profiles, or use the data for advertising or AI training. We do not sell or share it.</li>
<li>Our server logs record only the time, the endpoint, the response status and the response time. They do not record search filters.</li>
<li>Our hosting provider (Google Cloud, EU region europe-west4) automatically keeps standard request logs. These include IP address, user agent and timestamp, and are kept for up to 30 days for security and reliability.</li>
</ul>

<h2>Your AI assistant</h2>
<p>Your conversation is processed by your AI provider (such as Anthropic, OpenAI, Google or Perplexity) under its own privacy policy. Pleso does not receive your conversation, only the search filters described above.</p>

<h2>Booking on pleso.me</h2>
<p>Therapist links open pleso.me. They include the tags <code>utm_source=ai_assistant&amp;utm_medium=mcp</code> so we can count visits that come from AI assistants. The tags contain no personal data. If you sign up or book, the <a href="${MAIN_PRIVACY}">Pleso Privacy Policy</a> and <a href="${TERMS}">Terms</a> apply.</p>

<h2>Health and safety</h2>
<p>The Connector does not diagnose and is not medical advice. It is not an emergency service. If you are in danger, contact your local emergency number or a crisis line.</p>

<h2>Age</h2>
<p>Pleso's services are for adults aged 18 and over. Minors can use them only through the parent or guardian process described in the Terms.</p>

<h2>Your rights</h2>
<p>Because the Connector stores no personal data, there is normally nothing to access or delete. For questions or to exercise your rights under the GDPR or UK GDPR, contact <a href="mailto:${DPO}">${DPO}</a>. You can also complain to your data protection authority. In Poland that is the President of the Personal Data Protection Office (PUODO).</p>`;
  return layout('Pleso Therapy AI connector: privacy notice', 'Privacy notice for the Pleso Therapy connector for AI assistants.', body, {
    noindex: true,
    path: '/privacy',
  });
}

const ROBOTS = `User-agent: *\nDisallow: /mcp\nAllow: /\n`;

/** Resolve a GET path to a static page, or null if it isn't one. */
export function getPage(path: string, accept = ''): Page | null {
  const html = (body: string): Page => ({
    status: 200,
    type: 'text/html; charset=utf-8',
    body,
    headers: { 'Cache-Control': 'public, max-age=3600' },
  });
  const png = (buf: Buffer | null): Page | null =>
    buf ? { status: 200, type: 'image/png', body: buf, headers: { 'Cache-Control': 'public, max-age=86400' } } : null;
  switch (path.replace(/\/+$/, '') || '/') {
    case '/docs':
      return html(docsPage());
    case '/privacy':
      return html(privacyPage());
    case '/robots.txt':
      return { status: 200, type: 'text/plain; charset=utf-8', body: ROBOTS };
    case '/logo.png':
      return png(LOGO);
    case '/favicon.png':
    case '/favicon.ico':
      return png(FAVICON);
    case '/':
      // Browsers get the docs; API clients keep getting JSON from http.ts.
      return accept.includes('text/html') ? { status: 302, type: 'text/plain', body: '', headers: { Location: '/docs' } } : null;
    default:
      return null;
  }
}
