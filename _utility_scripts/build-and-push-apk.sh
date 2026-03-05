#!/bin/bash
set -e

# Load .env from project root (parent dir)
ENV_PATH="$(cd "$(dirname "$0")/.." && pwd)/.env"

if [ -f "$ENV_PATH" ]; then
  set -a
  source "$ENV_PATH"
  set +a
fi


# Check for VITE_CF_API_URL environment variable
if [ -z "$VITE_CF_API_URL" ]; then
  echo "Error: VITE_CF_API_URL environment variable is not set."
  echo "Please set it before running the script, e.g.:"
  echo "export VITE_CF_API_URL=http://localhost:8788"
  echo "Usage: $0 <admin_username> <admin_password> [version]"
  echo "Example: $0 adminUser strongPassword 1.0.0"
  exit 1
fi

BASE_URL=$VITE_CF_API_URL
BASE_URL="${BASE_URL%/}"
if [[ "$BASE_URL" == */api ]]; then
  BASE_URL="${BASE_URL%/api}"
fi

# 0. Validate arguments and parse
if [ -z "$1" ] || [ -z "$2" ]; then
  echo "Error: ADMIN_USERNAME and ADMIN_PASSWORD must be provided for authentication."
  echo "Usage: $0 <admin_username> <admin_password> [version]"
  echo "Example: $0 adminUser strongPassword 1.0.0"
  exit 1
fi

ADMIN_USERNAME=$1
ADMIN_PASSWORD=$2
VERSION=$3 # Optional version argument

# 1. Generate Nuxt build
echo "🚀 Running npm run generate..."
npm run generate

# 2. Sync Capacitor
echo "🔄 Syncing Capacitor..."
npx cap sync

# 3. Build APK inside Docker
echo "📦 Building APK in Docker..."
docker run --rm \
    -v "$(pwd)":/project \
    mingc/android-build-box \
    bash -c 'cd /project/android; ./gradlew :app:assembleDebug'

# 4. Authenticate and Upload APK to OTA endpoint
echo "📤 Authenticating and Uploading APK to OTA endpoint..."

# Find the APK file
APK_PATH="android/app/build/outputs/apk/debug/app-debug.apk"
if [ ! -f "$APK_PATH" ]; then
    echo "❌ APK file not found at $APK_PATH"
    ls -R android/app/build/outputs/apk/
    exit 1
fi

# Use timestamp as version if not provided
if [ -z "$VERSION" ]; then
    VERSION=$(date +%s)
    echo "ℹ️ No version provided, using timestamp as version: $VERSION"
fi

# Login to get token
LOGIN_URL="$BASE_URL/api/auth/login"
echo "🔑 Logging in to $LOGIN_URL with user $ADMIN_USERNAME..."

# Safely create the JSON payload using printf
JSON_PAYLOAD=$(printf '{"username":"%s","password":"%s"}' "$ADMIN_USERNAME" "$ADMIN_PASSWORD")

LOGIN_BODY_FILE=$(mktemp)
LOGIN_STATUS=$(curl -sS -o "$LOGIN_BODY_FILE" -w "%{http_code}" -X POST \
                    -H "Content-Type: application/json" \
                    -d "$JSON_PAYLOAD" \
                    "$LOGIN_URL")
LOGIN_RESPONSE=$(cat "$LOGIN_BODY_FILE")
rm -f "$LOGIN_BODY_FILE"

# Check for login errors in the response
if [ "$LOGIN_STATUS" -lt 200 ] || [ "$LOGIN_STATUS" -ge 300 ]; then
  echo "❌ Login failed."
  echo "HTTP status: $LOGIN_STATUS"
  echo "Login response: $LOGIN_RESPONSE"
  exit 1
fi

if ! echo "$LOGIN_RESPONSE" | jq -e . >/dev/null 2>&1; then
  echo "❌ Login returned non-JSON response."
  echo "HTTP status: $LOGIN_STATUS"
  echo "Login response: $LOGIN_RESPONSE"
  exit 1
fi

AUTH_TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.token // empty')

if [ -z "$AUTH_TOKEN" ]; then
  echo "❌ Failed to obtain authentication token from login response."
  echo "HTTP status: $LOGIN_STATUS"
  echo "Login response: $LOGIN_RESPONSE"
  exit 1
fi

echo "✅ Authentication successful. Token obtained."

UPLOAD_URL="$BASE_URL/api/ota/admin/apk/upload"
echo "⬆️ Uploading $APK_PATH to $UPLOAD_URL with version $VERSION..."

curl -i -X POST \
     -H "Authorization: Bearer $AUTH_TOKEN" \
     -F "file=@$APK_PATH" \
     -F "version=$VERSION" \
     "$UPLOAD_URL"

echo
echo "✅ Done!"
