# gofarva-site

Public marketing site for **[Go Farva](https://gofarva.run)** — the offline Android run tracker by Fez Commerce.

Static HTML/CSS (tiny JS for the mobile nav). No build step. Hosted on **GitHub Pages** from this repository’s `main` branch, site root (`/`).

The Android app lives in a separate **private** repo (`robairuk/go-farva`). Do not make that repo public.

## Pages

| Path | Purpose |
|------|---------|
| `/` | Landing |
| `/privacy/` | Privacy policy (placeholder body until QA finalises) |
| `/support/` | Support / contact |
| `/privacy/health-connect/` | Health Connect write-only note |

## Local preview

```bash
cd /path/to/gofarva-site
python3 -m http.server 8080
# open http://127.0.0.1:8080/
```

## GitHub Pages

Pages is configured to publish from **`main` / root** (not `/docs`).

After the first push, confirm in the repo: **Settings → Pages → Build and deployment**:

- Source: Deploy from a branch  
- Branch: `main` / `/ (root)`

The GitHub Pages URL is:

- https://robairuk.github.io/gofarva-site/

With the custom domain (after DNS):

- https://gofarva.run/

A `CNAME` file in the repo root contains `gofarva.run`. In Pages settings, set **Custom domain** to `gofarva.run` and enable **Enforce HTTPS** once the certificate is ready.

## DNS (founder must add at the registrar)

Domain: **gofarva.run** (already owned). GitHub Pages custom domains for an apex (`gofarva.run`) need these records at your DNS host:

### Option A — apex with A + AAAA (recommended for `gofarva.run`)

**A records** (IPv4), host `@` or blank / `gofarva.run`:

| Type | Name | Value |
|------|------|--------|
| A | `@` | `185.199.108.153` |
| A | `@` | `185.199.109.153` |
| A | `@` | `185.199.110.153` |
| A | `@` | `185.199.111.153` |

**AAAA records** (IPv6), same host:

| Type | Name | Value |
|------|------|--------|
| AAAA | `@` | `2606:50c0:8000::153` |
| AAAA | `@` | `2606:50c0:8001::153` |
| AAAA | `@` | `2606:50c0:8002::153` |
| AAAA | `@` | `2606:50c0:8003::153` |

Optional www redirect — CNAME:

| Type | Name | Value |
|------|------|--------|
| CNAME | `www` | `robairuk.github.io` |

### Option B — subdomain only

If you prefer `www.gofarva.run` as the primary site:

| Type | Name | Value |
|------|------|--------|
| CNAME | `www` | `robairuk.github.io` |

Then set the Pages custom domain to `www.gofarva.run`.

**Do not** point DNS at the private app repo. Only this public `gofarva-site` repo serves Pages.

After DNS propagates (often minutes, sometimes up to 48 hours), tick **Enforce HTTPS** in the Pages settings.

## Brand

Colours and logos come from the Go Farva design tokens (`#0B6B66` teal, `#F0CB4C` yellow). Map attribution: © OpenStreetMap contributors · OpenFreeMap.

## Licence

Site content © Fez Commerce. Inter font via Google Fonts (SIL OFL).
