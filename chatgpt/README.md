# ChatGPT app submission package

This folder is the package uploaded to the OpenAI plugin dashboard (https://platform.openai.com/plugins). It contains:

- `plugin.json`: the manifest, with the listing, 5 positive and 3 negative review test cases, and publication settings
- `mcp.json`: the remote MCP server (Streamable HTTP, no auth)
- `assets/logo.png`: a 512×512 icon

Build the ZIP with `python -I scripts/build-chatgpt-zip.py`. It writes `dist/pleso-therapy-chatgpt.zip`.

## Steps (submit from Pleso's business-verified OpenAI organization)

1. **Record the demo video** following `DEMO_SCRIPT.md`. Upload it unlisted, then put its URL in `review.demo_recording_url`.
2. **Confirm or change three decisions in `plugin.json`:**
   - `category`: "Health & Fitness" is a guess. Pick the closest title from the dashboard's list.
   - `publication.countries`: currently GB, IE, PL, RO, UA, MD (Pleso's markets). Use `[]` for no restriction.
   - `supportURL`: currently the docs page, which lists hello@pleso.me. The field must be an HTTPS URL, not an email.
3. **Build the ZIP** and upload it under "Upload new or existing plugin".
4. **Domain verification:** the dashboard gives a token. Add it to `apphosting.yaml`:
   ```yaml
   - variable: OPENAI_APPS_CHALLENGE
     value: "<token>"
   ```
   Then run `firebase deploy --only apphosting:pleso-mcp`. Check that
   `https://pleso-mcp--product-team-products.europe-west4.hosted.app/.well-known/openai-apps-challenge` returns only
   the token, then click Verify.
5. **Let the connection and tool scan finish**, and resolve any "Complete MCP setup" findings.
6. **Run each positive test case once in ChatGPT** before submitting, as OpenAI asks. Then submit. After approval,
   click **Publish**.

## Points reviewers may look at

- **Pricing:** OpenAI asks apps not to advertise pricing or promotions. The listing text doesn't mention prices.
  `get_pleso_info` and search results return Pleso's published starting price only as factual information. If a
  reviewer objects, the price fields can be removed.
- **Commerce:** none. There's no booking or payment in ChatGPT; profile links open pleso.me therapist pages, not a checkout.
- **Annotations:** every tool sets `readOnlyHint: true`, `destructiveHint: false` and `openWorldHint: false`. The data
  comes from Pleso's own bounded catalog.
- **Age:** content is suitable for ages 13–17. Crisis results include youth lines where available.
