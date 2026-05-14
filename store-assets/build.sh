#!/bin/bash
# Build script for Chrome Web Store submission
# Creates a clean zip of the extension, excluding dev files

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
VERSION=$(node -p "require('$ROOT_DIR/manifest.json').version")
OUTPUT="$SCRIPT_DIR/context-explain-v${VERSION}.zip"

echo "Building Context Explain v${VERSION}..."

# Remove old zip if exists
rm -f "$OUTPUT"

# Create zip from root, excluding dev/non-extension files
cd "$ROOT_DIR"
zip -r "$OUTPUT" . \
  --exclude "*.git*" \
  --exclude "*.DS_Store" \
  --exclude "store-assets/*" \
  --exclude "tests/*" \
  --exclude "assets/screenshots/*" \
  --exclude "V2_PLAN.md" \
  --exclude "*.md" \
  --exclude "node_modules/*" \
  --exclude ".claude/*" \
  --exclude "assets/demo.gif" \
  --exclude "assets/screenshots/*" \
  --exclude "assets/icon-new-512.png" \
  --exclude "assets/*.png" \
  --exclude "assets/*.gif" \
  --exclude "docs/*" \
  --exclude ".openrouter-api-key"

echo "✓ Created: $OUTPUT"
echo "  Size: $(du -sh "$OUTPUT" | cut -f1)"
