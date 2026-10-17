#!/usr/bin/env bash
# Export newsletter subscribers to /workspace/dev/newsletter-subscribers-<date>.csv
set -euo pipefail
cd "$(dirname "$0")"

ACCOUNT_ID="${CLOUDFLARE_ACCOUNT_ID:-${R2_ACCOUNT_ID:-}}"
if [[ -z "${CLOUDFLARE_API_TOKEN:-}" ]]; then
  echo "Missing CLOUDFLARE_API_TOKEN" >&2
  exit 1
fi
if [[ -z "$ACCOUNT_ID" ]]; then
  echo "Missing CLOUDFLARE_ACCOUNT_ID (or R2_ACCOUNT_ID)" >&2
  exit 1
fi
export CLOUDFLARE_API_TOKEN
export CLOUDFLARE_ACCOUNT_ID="$ACCOUNT_ID"

DATE="$(date +%Y-%m-%d)"
OUT="/workspace/dev/newsletter-subscribers-${DATE}.csv"
mkdir -p /workspace/dev

if [[ ! -d node_modules ]]; then
  npm install
fi

TMP="$(mktemp)"
npx wrangler d1 execute gofarva-newsletter --remote --json --command \
  "SELECT email, created_at, updated_at, consent, consent_text_version, source FROM subscribers ORDER BY created_at ASC;" \
  > "$TMP"

python3 - "$TMP" "$OUT" << 'PY'
import json, csv, sys
src, out = sys.argv[1], sys.argv[2]
data = json.load(open(src))
# wrangler --json returns a list of result objects
rows = []
if isinstance(data, list):
    for block in data:
        rows.extend(block.get("results") or [])
elif isinstance(data, dict):
    rows = data.get("results") or []
fields = ["email", "created_at", "updated_at", "consent", "consent_text_version", "source"]
with open(out, "w", newline="") as f:
    w = csv.DictWriter(f, fieldnames=fields)
    w.writeheader()
    for r in rows:
        w.writerow({k: r.get(k, "") for k in fields})
print(f"Wrote {len(rows)} rows to {out}")
PY

rm -f "$TMP"
echo "$OUT"
