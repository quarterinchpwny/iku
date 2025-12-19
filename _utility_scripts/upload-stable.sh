#!/bin/bash
set -e

# Load .env from project root (parent dir)
ENV_PATH="$(cd "$(dirname "$0")/.." && pwd)/.env"

if [ -f "$ENV_PATH" ]; then
  set -a
  source "$ENV_PATH"
  set +a
fi

# --- Configuration ---

# Your Cloudflare Worker URL should be set as an environment variable.
# Example: export VITE_CF_API_URL=https://your-worker.your-domain.workers.dev
if [ -z "$VITE_CF_API_URL" ]; then
  echo "❌ Error: VITE_CF_API_URL environment variable is not set."
  echo "Please set it before running the script, e.g.:"
  echo "export VITE_CF_API_URL=http://localhost:8788"
  exit 1
fi

BASE_URL=$VITE_CF_API_URL
BUILD_DIR=".output/public"
CHANNEL="stable"

# --- Argument Validation ---
if [ -z "$1" ] || [ -z "$2" ]; then
  echo "❌ Error: ADMIN_USERNAME and ADMIN_PASSWORD must be provided."
  echo "Usage: $0 <admin_username> <admin_password> [version]"
  echo "Example: $0 admin mysecretpassword 1.0.2"
  exit 1
fi

ADMIN_USERNAME=$1
ADMIN_PASSWORD=$2
VERSION=$3 # Optional version argument

# --- 1. Build the Nuxt Application ---
echo "🚀 Starting Nuxt build (npm run generate)..."
npm run generate
echo "✅ Nuxt build complete."

# --- 2. Determine Version ---
if [ -z "$VERSION" ]; then
    VERSION=$(date +%s)
    echo "ℹ️ No version provided, using timestamp as version: $VERSION"
fi

# --- 3. Create Zip Archive ---
ZIP_NAME="${CHANNEL}-${VERSION}.zip"
ZIP_PATH="$(pwd)/${ZIP_NAME}" # Create zip in current directory for Capgo CLI

echo "📦 Generating Capgo bundle for version $VERSION to '$ZIP_NAME'…"


# --- 3. Create Zip Archive via Capgo ---
CAPGO_BUNDLE_OUTPUT=$(npx @capgo/cli@latest bundle zip)

ZIP_NAME=$(echo "$CAPGO_BUNDLE_OUTPUT" | grep "Saved to" | awk '{print $NF}')
CHECKSUM=$(echo "$CAPGO_BUNDLE_OUTPUT" | grep "Checksum SHA256" | awk '{print $NF}')
ZIP_PATH="$(pwd)/$ZIP_NAME"

[ -f "$ZIP_PATH" ] || { echo "Zip not found"; exit 1; }
[ -n "$CHECKSUM" ] || { echo "Checksum missing"; exit 1; }



# --- 4. Authenticate ---
LOGIN_URL="$BASE_URL/api/auth/login"
echo "🔑 Logging in to $LOGIN_URL…"

JSON_PAYLOAD=$(printf '{"username":"%s","password":"%s"}' "$ADMIN_USERNAME" "$ADMIN_PASSWORD")

LOGIN_RESPONSE=$(curl -s -X POST \
                     -H "Content-Type: application/json" \
                     -d "$JSON_PAYLOAD" \
                     "$LOGIN_URL")

# Check for login errors
if echo "$LOGIN_RESPONSE" | grep -q '"error"'; then
  echo "❌ Login failed."
  echo "Login response: $LOGIN_RESPONSE"
  rm "$ZIP_PATH" # Clean up zip file
  exit 1
fi

# Use jq for robust token parsing
AUTH_TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r .token)

if [ -z "$AUTH_TOKEN" ] || [ "$AUTH_TOKEN" == "null" ]; then
  echo "❌ Failed to obtain authentication token."
  echo "Login response: "$LOGIN_RESPONSE""
  rm "$ZIP_PATH" # Clean up zip file
  exit 1
fi

echo "✅ Authentication successful. Token obtained."

# --- 5. Upload ---
UPLOAD_URL="$BASE_URL/api/ota/admin/ota/upload"
echo "⬆️ Uploading $ZIP_PATH to $UPLOAD_URL…"

curl -i -X POST \
     -H "Authorization: Bearer $AUTH_TOKEN" \
     -F "file=@$ZIP_PATH" \
     -F "version=$VERSION" \
     -F "channel=$CHANNEL" \
     -F "checksum=$CHECKSUM" \
     "$UPLOAD_URL"

# --- 6. Cleanup ---
echo "🧹 Cleaning up temporary zip file…"
rm "$ZIP_PATH"

echo
echo "✅ Done!"
