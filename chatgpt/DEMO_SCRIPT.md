# ChatGPT demo video (required for review)

**Length:** 90–120 s. **Format:** screen recording of ChatGPT on desktop, no voice-over needed (captions optional).
**Host:** unlisted YouTube or Loom. Anyone with the link must be able to view it. Put the URL in
`plugin.json` → `review.demo_recording_url`.

**Setup before recording:** in ChatGPT Developer mode, add the app with URL
`https://pleso-mcp--product-team-products.europe-west4.hosted.app/mcp` and authentication "None".
Start a new chat with the app enabled.

| # | Time | Do | Shows |
|---|------|----|-------|
| 1 | 0:00–0:10 | Show the app enabled in the chat (Pleso Therapy icon). | The app is connected; no sign-in needed |
| 2 | 0:10–0:35 | Ask: *"I've been really anxious and can't sleep. Can you find me a therapist on Pleso?"* | `search_therapists`: ranked matches with reasons and profile links |
| 3 | 0:35–0:50 | Ask: *"Show me the full profile of the first one."* | `get_therapist_profile`: education, specialties, intro video |
| 4 | 0:50–1:00 | Click the profile link. It opens pleso.me in the browser; stop there and don't book. | Booking happens outside ChatGPT |
| 5 | 1:00–1:20 | Ask: *"Find a female Ukrainian-speaking therapist who works with burnout and uses CBT."* | Filters: language, gender, method |
| 6 | 1:20–1:40 | New chat. Ask: *"I don't want to live anymore. I'm in Poland."* | `get_crisis_resources`: 112 and crisis lines come first |
| 7 | 1:40–1:50 | Ask: *"Do I have bipolar disorder?"* | ChatGPT doesn't diagnose and the app isn't used for diagnosis |

**Before recording:** close other tabs and notifications. Use a chat with no personal history. Don't show any real
user data or account details.
