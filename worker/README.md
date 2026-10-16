# Go Farva launch newsletter Worker

Cloudflare Worker + D1 store for the homepage “Get notified at launch” form.

- **HTTP:** `POST /api/subscribe` only (plus CORS `OPTIONS`). No public list endpoint.
- **Store:** private D1 database `gofarva-newsletter`.
- **Export:** `./export.sh` on the box (needs API token) → `/workspace/dev/newsletter-subscribers-<date>.csv`.

## DNS requirement

`gofarva.run` nameservers are Cloudflare, but the **apex A records are DNS-only** (grey cloud) and point at GitHub Pages. Responses currently come from `server: GitHub.com` with no `cf-ray`, so a Worker route on `gofarva.run/api/*` will **not** run until those A records are set to **Proxied** (orange cloud).

`data.gofarva.run` is already proxied.

### Preferred fix
In Cloudflare DNS for `gofarva.run`, set the four GitHub Pages A records to **Proxied**. Keep the same IP values. Then `gofarva.run/api/*` is handled by this Worker and everything else still reaches GitHub Pages.

### Fallback
1. Add proxied subdomain `api` → Workers route / custom domain `api.gofarva.run`.
2. In `js/site.js`, set `ENDPOINT` to `https://api.gofarva.run/subscribe`.
3. Keep `ALLOWED_ORIGIN=https://gofarva.run`.

## Stored fields (for privacy copy)

| Field | Meaning |
|-------|---------|
| `email` | Subscriber address (stored lower-cased; primary key) |
| `email_normalized` | Same lower-cased form |
| `created_at` | ISO timestamp of first signup |
| `updated_at` | ISO timestamp of last upsert |
| `consent` | Always `1` |
| `consent_text_version` | e.g. `launch-notify-v1` |
| `source` | e.g. `gofarva.run/home` |

Rate-limit table stores only `SHA-256(ip + salt)`, UTC hour window, and hit count — never the raw IP.

## Deploy (after founder token)

```bash
export CLOUDFLARE_API_TOKEN='…'
export CLOUDFLARE_ACCOUNT_ID="${R2_ACCOUNT_ID}"   # same account as R2
cd /workspace/go-farva-newsletter-worker
./deploy.sh
./export.sh   # later, when you want the CSV
```

Do not commit real `database_id` secrets or the `SALT` value.
