#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# ── Resolve new version ──────────────────────────────────────────────────────

CURRENT_VERSION=$(node -p "require('./version.json').version")

if [ $# -ge 1 ]; then
  NEW_VERSION="$1"
else
  # Auto-increment patch (e.g. 1.3.1 → 1.3.2)
  IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT_VERSION"
  NEW_VERSION="$MAJOR.$MINOR.$((PATCH + 1))"
fi

echo "Current version : $CURRENT_VERSION"
echo "New version     : $NEW_VERSION"
echo ""

read -r -p "Proceed? [y/N] " CONFIRM
if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
  echo "Aborted."
  exit 0
fi

# ── Update version files ─────────────────────────────────────────────────────

# version.json
echo "{ \"version\": \"$NEW_VERSION\" }" > version.json

# package.json
node -e "
  const fs = require('fs');
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  pkg.version = '$NEW_VERSION';
  fs.writeFileSync('package.json', JSON.stringify(pkg, null, 4) + '\n');
"

# manifest.json
node -e "
  const fs = require('fs');
  const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
  manifest.version = '$NEW_VERSION';
  fs.writeFileSync('manifest.json', JSON.stringify(manifest, null, 4) + '\n');
"

echo "✔ version.json, package.json, manifest.json updated to $NEW_VERSION"

# ── Build zip ────────────────────────────────────────────────────────────────

ZIP_NAME="snaprec-extension-v${NEW_VERSION}.zip"
ZIP_PATH="../${ZIP_NAME}"

rm -f "$ZIP_PATH"

zip -r "$ZIP_PATH" . \
  --exclude "*.md" \
  --exclude "store_assets/*" \
  --exclude "package.json" \
  --exclude ".DS_Store" \
  --exclude "ship-to-store.sh"

echo "✔ Zip created: apps/${ZIP_NAME}"
echo ""
echo "Ready to upload to the Chrome Web Store."
