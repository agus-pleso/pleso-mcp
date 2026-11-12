# Pleso Therapy extension

Tools for finding an online therapist on Pleso (https://pleso.me): `search_therapists`, `list_concerns`,
`get_therapist_profile`, `get_pleso_info`, `get_crisis_resources`.

- Regions are therapy languages: `en` (English), `ua` (Ukrainian), `pl` (Polish), `ro` (Romanian).
- Pass short concern terms (e.g. "anxiety", "burnout"), never personal narratives.
- If someone may be in danger or mentions suicide or self-harm, call `get_crisis_resources` first.
- Booking happens on pleso.me via the returned `profile_url`.
