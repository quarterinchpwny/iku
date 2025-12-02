#!/bin/bash
set -e  # exit on error

# Check for VITE_CF_API_URL environment variable
if [ -z "$VITE_CF_API_URL" ]; then
  echo "Error: VITE_CF_API_URL environment variable is not set."
  echo "Please set it before running the script, e.g.:"
  echo "export VITE_CF_API_URL=http://localhost:8788"
  echo "Usage: $0 [version]"
  echo "Example: $0 1.0.0"
  exit 1
fi

BASE_URL=$VITE_CF_API_URL
VERSION=$1 # Now version is the first argument

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

# 4. Upload APK to OTA endpoint
echo "📤 Uploading APK to OTA endpoint..."

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

UPLOAD_URL="$BASE_URL/api/ota/admin/apk/upload"

echo "⬆️ Uploading $APK_PATH to $UPLOAD_URL with version $VERSION..."

curl -X POST \
     -F "file=@$APK_PATH" \
     -F "version=$VERSION" \
     "$UPLOAD_URL"

echo
echo "✅ Done!"
