#!/usr/bin/env bash
# Deploy gofarva-newsletter Worker + D1. Does NOT create Cloudflare accounts.
# Requires env: CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID (or R2_ACCOUNT_ID).
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

if [[ ! -d node_modules ]]; then
  npm install
fi

# Ensure D1 exists and wrangler.toml has the real id
DB_ID="$(sed -n 's/^database_id = "\(.*\)"/\1/p' wrangler.toml | head -1)"
if [[ -z "$DB_ID" || "$DB_ID" == "REPLACE_WITH_D1_DATABASE_ID" ]]; then
  echo "Creating D1 database gofarva-newsletter..."
  # Capture create output; wrangler prints the uuid
  CREATE_OUT="$(npx wrangler d1 create gofarva-newsletter 2>&1 || true)"
  echo "$CREATE_OUT"
  NEW_ID="$(printf '%s\n' "$CREATE_OUT" | sed -n 's/.*database_id\s*=\s*"\([^"]*\)".*/\1/p' | head -1)"
  if [[ -z "$NEW_ID" ]]; then
    NEW_ID="$(printf '%s\n' "$CREATE_OUT" | grep -Eo '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' | head -1)"
  fi
  if [[ -z "$NEW_ID" ]]; then
    echo "Could not parse D1 database id. Paste it into wrangler.toml and re-run." >&2
    exit 1
  fi
  sed -i "s/database_id = \"REPLACE_WITH_D1_DATABASE_ID\"/database_id = \"$NEW_ID\"/" wrangler.toml
  echo "Set database_id=$NEW_ID"
fi

echo "Applying schema..."
npx wrangler d1 execute gofarva-newsletter --remote --file=./schema.sql

if [[ -z "${NEWSLETTER_SALT:-}" ]]; then
  NEWSLETTER_SALT="$(openssl rand -hex 32)"
  echo "Generated NEWSLETTER_SALT (also set as Worker secret SALT)."
fi
printf '%s' "$NEWSLETTER_SALT" | npx wrangler secret put SALT

echo "Deploying Worker..."
npx wrangler deploy

echo
echo "Done. Confirm:"
echo "  1) Custom domain api.gofarva.run is attached (DNS/cert via Workers)"
echo "  2) POST https://api.gofarva.run/subscribe returns {ok:true}"
echo "  3) Site form ENDPOINT is https://api.gofarva.run/subscribe"
echo "Export list later with: ./export.sh"
