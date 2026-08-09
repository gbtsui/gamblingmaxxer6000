#!/usr/bin/env bash
# Generates grid-sized thumbnails of the card art into static/cards/thumb/.
#
# The source PNGs are 750-1500px wide and up to 1.5 MB each; a ten-card pull
# ships ~7 MB of them into slots a couple of hundred pixels wide. At 560px
# wide and JPEG q82 the same pull is well under 1 MB, which is the difference
# between a grid that fills instantly and one that looks broken on venue wifi.
#
# Full-resolution PNGs stay where they are for the enlarged view.
#
# Uses sips, which ships with macOS — no cwebp, ImageMagick or sharp needed.
# Re-run after adding card art:  ./scripts/thumbs.sh

set -euo pipefail

cd "$(dirname "$0")/.."

src=static/cards
out=$src/thumb
width=560
quality=82

if ! command -v sips >/dev/null; then
	echo "thumbs.sh needs sips (macOS). Generate ${width}px-wide JPEGs into $out by other means." >&2
	exit 1
fi

mkdir -p "$out"

count=0
for png in "$src"/*.png; do
	[ -e "$png" ] || continue
	name=$(basename "$png" .png)
	sips -s format jpeg -s formatOptions "$quality" -Z "$width" "$png" --out "$out/$name.jpg" >/dev/null
	count=$((count + 1))
done

echo "thumbs.sh: wrote $count thumbnails to $out ($(du -sh "$out" | cut -f1) total)"
