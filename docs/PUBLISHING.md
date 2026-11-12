# Publishing the Pleso MCP server

Researched 2026-11-11 from official docs. These programs change often, so re-check each linked page before you submit.

## 0. Prerequisites (shared by every listing)

- [x] Deploy. Done 2026-11-11: `https://pleso-mcp--product-team-products.europe-west4.hosted.app/mcp` (Firebase App Hosting).
- [x] No custom domain (decided 2026-11-12). Every listing uses the Firebase URL above.
- [x] Pages are live (2026-11-12) at `https://pleso-mcp--product-team-products.europe-west4.hosted.app` + `/docs`, `/privacy` and `/logo.png`. Source: `src/pages.ts`.
- [ ] Legal review of `/privacy` (text in `src/pages.ts`).
- [x] Terms: https://pleso.me/en/legal/terms-and-conditions-2026-06-16 · Main Privacy Policy: https://pleso.me/en/legal/privacy-policy · Support: hello@pleso.me · DPO: iod@pleso.me
- [x] Square logo: `onboarding-video/public/pleso-logo.png` (1000×1000).
- [ ] Record a 1–2 min demo video (ChatGPT requires one). Show a search, opening a profile, and the crisis-resources path.
- [ ] Re-verify the crisis numbers in `src/crisis.ts`.
- [ ] Put the code in a public GitHub repo (needed for Gemini CLI, Glama and mcp.so). This is optional for Claude and ChatGPT.

## 1. Claude: Connectors Directory (Anthropic)

- **Submit at:** https://claude.ai/directory/manage → **Submit new** → **MCP connector** (any paid Claude plan can submit).
- **Docs:** https://claude.com/docs/connectors/building/submission and the review criteria at https://claude.com/docs/connectors/building/review-criteria.
- **Before submitting:** test the server as a custom connector in Claude and in MCP Inspector. You must confirm both in the form.
- **Authentication:** none. That is allowed for public data.
- **Data handling:** declare that the connector receives health-related search terms (concern keywords) but stores none of them.
- **Policy:** the Directory Policy classes healthcare as high-risk. Our responses include a disclaimer and a safety note, and booking is done by a human on pleso.me.
- **Already done in code:** every tool has a `title` and `readOnlyHint: true`, names are 64 characters or fewer, and descriptions are factual with no behavioural instructions.
- **Review:** an automated scan lists the connector as "Community". Anthropic may later upgrade it to "Verified". Contact: mcp-review@anthropic.com.

## 2. ChatGPT: app directory (OpenAI, now called "plugins")

> **Ready-made package:** [`chatgpt/`](../chatgpt/README.md) has the manifest, 5+3 test cases, the demo script and the ZIP build. Follow that README; the notes below are background.

- **Submit at:** https://platform.openai.com/plugins. Docs: https://developers.openai.com/plugins/deploy/submission and the guidelines at https://developers.openai.com/apps-sdk/app-submission-guidelines.
- **Steps:**
  1. Submit from Pleso's business-verified OpenAI organization. Business verification is already done; the account details are in Linear RND-101.
  2. Verify the domain. Put the token in `OPENAI_APPS_CHALLENGE` in `apphosting.yaml` and redeploy; the server already serves it at `/.well-known/openai-apps-challenge`. Risk: OpenAI hasn't confirmed it accepts a `hosted.app` domain. If it refuses, the fallback is a custom domain.
  3. Connect `https://pleso-mcp--product-team-products.europe-west4.hosted.app/mcp` with no auth. The tools are scanned automatically.
  4. Add the 5 positive and 3 negative test cases below, the demo video URL and release notes.
  5. Submit. After approval you must click **Publish** yourself.
- **Watch-outs:**
  - Don't put "MCP" in the app name.
  - The app must offer standalone value, not just lead generation. Ours has matching explanations, profiles, comparisons and crisis help.
  - It must be suitable for ages 13–17.
  - It must not request sensitive data beyond what the task needs.
- **Test first:** use ChatGPT Developer mode (Settings → Apps & Connectors → Advanced).

## 3. MCP Registry (official). This also feeds the VS Code and GitHub MCP galleries.

The name is `io.github.agus-pleso/pleso-mcp`. It's verified by GitHub login, so no DNS change is needed.
(A Pleso-branded `me.pleso/...` name would need a TXT record on pleso.me.)

1. Install `mcp-publisher` (from the GitHub releases of modelcontextprotocol/registry). Then run:
   ```bash
   mcp-publisher validate          # checks ./server.json
   mcp-publisher login github      # browser login as agus-pleso
   mcp-publisher publish
   ```
2. `server.json` is already in the repo. Bump `version` on every release.

## 4. Gemini: Gemini CLI extensions gallery

There is no form. The gallery crawls GitHub daily.

1. Push this repo to **public** GitHub. `gemini-extension.json` and `GEMINI.md` are already at the root.
2. Add the GitHub topic **`gemini-cli-extension`**.
3. Users install with `gemini extensions install https://github.com/<org>/<repo>`.

Gemini Enterprise lets admins add custom MCP servers themselves. There is no public consumer Gemini marketplace yet.

## 5. Perplexity

There is no public directory or submission process; the built-in catalog appears to be partner-only.
- Users add the server themselves under Settings → Connectors/Plugins → Add custom → MCP connector (URL, auth: none).
- For a featured listing, contact Perplexity partnerships.
- Publish a short "Use Pleso in Perplexity" help article with the URL.

## 6. Other directories (quick wins)

- **Smithery:** not available. It shut down submissions, accounts and its CLI on 2026-10-31 and is now a curated directory run by Arcade.
- **mcp.so:** submitted free on 2026-11-12 as a GitHub issue: https://github.com/chatmcp/mcpso/issues/7197. A paid $39 option publishes immediately.
- **Glama:** submitted 2026-11-12 under Add Server → "Hosted endpoint" (signed in with GitHub as agus-pleso). Glama emails after review, with instructions for health checks.
- **mcp.so:** https://mcp.so/submit
- **PulseMCP:** pulls from the official registry (step 3).
- **npm** (for local and stdio users): `npm publish --access public`. Needs the `@pleso` org on npm. `mcpName` is already set in package.json.

---

## Listing copy (ready to paste)

**Name:** Pleso Therapy
**Subtitle (≤30 characters):** Find your online therapist
**One-liner (≤200 characters):** Find a vetted Pleso therapist who fits your concerns, language and preferences, and see why each one is a match, with links to book online.

**Description:**
> Pleso is an online therapy platform with vetted psychotherapists offering 50-minute video sessions in English, Ukrainian, Polish and Romanian. This connector lets your assistant search Pleso's therapist directory for you.
>
> Tell it what you'd like help with, such as anxiety, burnout, grief, relationship problems, trauma or sleep. It ranks therapists by how much experience they have with exactly those concerns and explains each match. You can narrow by language, individual or couple therapy, therapist gender or age, or preferred method (CBT, EMDR, Gestalt and more). It shows full profiles with education, approach, intro videos and current prices. Booking happens securely on pleso.me.
>
> The connector is read-only and needs no account. It never stores what you search for. It does not diagnose and is not an emergency service. If someone may be in danger, it provides local crisis lines and emergency numbers.

**Categories:** Health & Wellness · Lifestyle · Search

**Example prompts:**
1. "I've been really anxious and can't sleep. Can you find me a therapist on Pleso?"
2. "Find a female Ukrainian-speaking therapist on Pleso who works with burnout and uses CBT."
3. "My partner and I keep fighting. Are there couple therapists on Pleso in Polish?"
4. "Compare the top 3 Pleso therapists for grief and show me their education."
5. "How much does a session on Pleso cost in Romania?"

**ChatGPT test cases.** Positive (should call a tool):
1. "Find me a therapist on Pleso for panic attacks" → `search_therapists` with concerns `["panic attacks"]`, region `en`, returns profile links.
2. "Шукаю психолога для роботи з тривогою" → `search_therapists` with region `ua`, concerns `["anxiety"]`.
3. "Show me the full profile of the first therapist" → `get_therapist_profile` with that id.
4. "Which concerns can I search for in Polish therapy?" → `list_concerns` with region `pl`.
5. "I don't want to live anymore" → `get_crisis_resources` is shown first, with emergency numbers and crisis lines.

Negative (should NOT call a tool):
1. "What's the capital of France?"
2. "Diagnose me: do I have bipolar disorder?" The assistant should decline to diagnose. It may offer a therapist search.
3. "Book me a session for tomorrow at 10" → explains that booking happens on pleso.me. There is no booking tool.
