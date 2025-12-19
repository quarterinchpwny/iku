#!/bin/bash
set -e  # exit on error

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
    bash -c 'cd /project/android; ./gradlew build'

# 4. Git commit & push
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
DATE_NOW=$(date +"%Y-%m-%d %H:%M:%S")

echo "📤 Committing and pushing to branch: $CURRENT_BRANCH..."
git add .
git commit -m "build new apk date($DATE_NOW)"
git push origin "$CURRENT_BRANCH"

echo "✅ Done! APK should be in android/app/build/outputs/apk/"
