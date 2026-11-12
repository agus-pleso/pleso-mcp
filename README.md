# Pleso Therapy — MCP server

A universal [Model Context Protocol](https://modelcontextprotocol.io) server that lets any AI assistant —
Claude, ChatGPT, Gemini, Perplexity, Copilot, Cursor… — help people **find a Pleso therapist for their concerns**.

- **Live endpoint:** `https://pleso-mcp--product-team-products.europe-west4.hosted.app/mcp`
  (Firebase App Hosting, project `product-team-products`, backend `pleso-mcp`; Streamable HTTP, no auth, read-only)
- **Public pages** (same host): `/docs` (setup guide), `/privacy` (connector privacy notice, noindex), `/logo.png`, `/robots.txt`. Source: `src/pages.ts`
- **Local:** `npx @pleso/mcp-server` (stdio)
- **Data:** Pleso's public therapist catalog (same data as `pleso.me/{region}/therapists/all`), cached 30 min
- **Privacy:** no accounts, no cookies, no storage; search terms are never logged

## Tools

| Tool | What it does |
|---|---|
| `search_therapists` | Ranks therapists by how strongly they work with up to 5 concerns ("anxiety", "burnout", "breakup", or codes). Filters: region, individual/couple, therapist gender/age, language; preferred methods & client groups boost ranking. Returns match score, why they match, bio excerpt, photo, intro video, profile/booking link. |
| `list_concerns` | Concerns, methods, client groups and languages available per region (codes + English/local labels). |
| `get_therapist_profile` | Full public profile: bio, education, specialties by level, methods, client groups, languages, price. |
| `get_pleso_info` | How Pleso works, regions, therapist counts, live starting prices, quiz/catalog links. |
| `get_crisis_resources` | Emergency numbers + crisis lines (UA, PL, RO, GB, IE, US, CA, DE) with findahelpline.com fallback. |

Plus a `find_a_therapist` prompt. All tools are annotated `readOnlyHint: true, destructiveHint: false, openWorldHint: false`.

**Regions** = therapy language: `en` (English, worldwide · individual), `ua` (Ukrainian · individual + couple),
`pl` (Polish · individual + couple), `ro` (Romanian · individual). Each region has its own concern taxonomy; English
terms are matched against all of them.

**How matching works:** each Pleso therapist publishes a 1–5 level for each concern. The score is the mean level
across the requested concerns (0–100), minus a penalty for any concern below "experienced" (3), plus small bonuses for
preferred methods / client groups. Ties break on years of experience. No paid placement.

## Develop

```bash
npm install
npm test            # unit + in-memory MCP tests (no network)
npm run dev         # http://localhost:8080/mcp
node scripts/smoke.mjs http://localhost:8080/mcp   # live end-to-end check against pleso.me
npx @modelcontextprotocol/inspector              # interactive testing
```

Env vars: `PORT` (8080), `CATALOG_TTL_SECONDS` (1800), `CATALOG_MAX_ROUNDS` (6), `WARM_UP` (true),
`PLESO_BASE_URL` (https://pleso.me), `OPENAI_APPS_CHALLENGE` (ChatGPT domain-verification token).

## Deploy (Firebase App Hosting — Product Team - Products)

Deployed from local source (no GitHub link needed), same as the `care-roster` backend in that project:

```bash
npm test
firebase deploy --only apphosting:pleso-mcp --project product-team-products
node scripts/smoke.mjs https://pleso-mcp--product-team-products.europe-west4.hosted.app/mcp
```

- Runtime settings live in `apphosting.yaml` (1 always-on instance, max 4, 1 vCPU, 512 MiB).
- On startup the server loads the whole catalog **before** accepting traffic (max 90 s, `WARM_UP_MAX_SECONDS`), so a new
  rollout keeps the old revision serving until the new one is warm. After that, expired data is served instantly
  while it refreshes in the background — users never wait on pleso.me.
- Health check: `GET /health` (`/healthz` is reserved by Google's edge on App Hosting/Cloud Run).
- Logs: Firebase console → App Hosting → pleso-mcp → Logs (or Cloud Logging, service `pleso-mcp`).
- **No custom domain (decided 2026-11-12).** Every listing uses the Firebase URL above. Never delete or move the
  `pleso-mcp` backend: the URL is tied to it, so a move breaks every installed connector and listing. If a move is ever
  needed, add a custom domain first, then update the listings.

A `Dockerfile` is also included for any other container host.

## Connect it

| Client | How |
|---|---|
| **Claude** (web/desktop/mobile) | Settings → Connectors → Add custom connector → `https://pleso-mcp--product-team-products.europe-west4.hosted.app/mcp` |
| **ChatGPT** | Settings → Apps & Connectors → Advanced → Developer mode → Create → URL `https://pleso-mcp--product-team-products.europe-west4.hosted.app/mcp`, auth: none |
| **Perplexity** | Settings → Connectors / Plugins → Add custom → MCP connector → URL, auth: none |
| **Gemini CLI** | `gemini extensions install https://github.com/<org>/pleso-mcp` (uses `gemini-extension.json`) |
| **Claude Code** | `claude mcp add --transport http pleso https://pleso-mcp--product-team-products.europe-west4.hosted.app/mcp` |
| **VS Code / Cursor** | `{"servers":{"pleso":{"type":"http","url":"https://pleso-mcp--product-team-products.europe-west4.hosted.app/mcp"}}}` |
| **Claude Desktop (local)** | `{"mcpServers":{"pleso":{"command":"npx","args":["-y","@pleso/mcp-server"]}}}` |

## Publish to marketplaces

See **[docs/PUBLISHING.md](docs/PUBLISHING.md)** — step-by-step for the Claude Connectors Directory, ChatGPT app
directory, MCP Registry (→ VS Code/GitHub), Gemini CLI gallery, Perplexity, Smithery, Glama, mcp.so — with
ready-to-paste listing copy, example prompts and test cases. Privacy policy draft: [docs/PRIVACY.md](docs/PRIVACY.md).

## Crisis resources

`src/crisis.ts` was checked on 2026-11-11. **Re-verify every number before each release** — hours are deliberately
omitted because sources disagree. findahelpline.com is always returned as a fallback.

## Known limitations / roadmap

1. **Data source is the public catalog HTML.** pleso.me's default sort is partly randomised, so the loader re-reads
   pages until it has everyone (currently ~99%: en 49/50, ua 257/259, pl 163/163, ro 85/85). **Ask the backend team for a
   stable JSON endpoint** (e.g. `GET /api/public/catalog?region=en`) and implement it as another `CatalogSource` in
   `src/catalog.ts` — no other code changes needed.
2. No live availability / next free slot yet — a natural next tool once the backend exposes it.
3. Booking stays on pleso.me (no OAuth). If in-chat booking is ever wanted, it needs OAuth 2.1 + a separate review.
