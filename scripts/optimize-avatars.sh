#!/bin/bash

# Script to optimize avatar images for web performance
# Target: 200x200px, JPEG quality 85, ~10-30KB per image

AVATAR_DIR="/Users/owner/aidin/public/avatars"
BACKUP_DIR="/Users/owner/aidin/public/avatars_backup_$(date +%Y%m%d)"
TARGET_SIZE=200
QUALITY=85

echo "🖼️  Avatar Image Optimization Script"
echo "===================================="
echo ""

# Create backup
echo "📁 Creating backup at: $BACKUP_DIR"
mkdir -p "$BACKUP_DIR"
cp -r "$AVATAR_DIR"/*.jpg "$BACKUP_DIR/" 2>/dev/null || true
echo "✅ Backup created"
echo ""

# Count files
TOTAL_FILES=$(find "$AVATAR_DIR" -name "*.jpg" | wc -l | tr -d ' ')
echo "📊 Found $TOTAL_FILES avatar images to optimize"
echo ""

# Get total size before
SIZE_BEFORE=$(du -sh "$AVATAR_DIR" | awk '{print $1}')
echo "📏 Total size BEFORE: $SIZE_BEFORE"
echo ""

COUNTER=0

# Process each image
for img in "$AVATAR_DIR"/*.jpg; do
  if [ -f "$img" ]; then
    COUNTER=$((COUNTER + 1))
    filename=$(basename "$img")

    # Get current size
    SIZE_KB=$(du -k "$img" | awk '{print $1}')

    # Only optimize if > 50KB
    if [ "$SIZE_KB" -gt 50 ]; then
      echo "[$COUNTER/$TOTAL_FILES] Optimizing: $filename (${SIZE_KB}KB)"

      # Resize and optimize using sips (built-in macOS tool)
      sips -s format jpeg \
           -s formatOptions "$QUALITY" \
           -Z "$TARGET_SIZE" \
           "$img" --out "$img" > /dev/null 2>&1

      # Get new size
      NEW_SIZE_KB=$(du -k "$img" | awk '{print $1}')
      SAVED=$((SIZE_KB - NEW_SIZE_KB))
      echo "   ✅ Reduced from ${SIZE_KB}KB to ${NEW_SIZE_KB}KB (saved ${SAVED}KB)"
    else
      echo "[$COUNTER/$TOTAL_FILES] Skipping: $filename (already optimized at ${SIZE_KB}KB)"
    fi
  fi
done

echo ""
echo "===================================="
SIZE_AFTER=$(du -sh "$AVATAR_DIR" | awk '{print $1}')
echo "📏 Total size AFTER: $SIZE_AFTER"
echo "✨ Optimization complete!"
echo ""
echo "💾 Backup location: $BACKUP_DIR"
echo "   (You can delete this backup once you verify everything works)"
