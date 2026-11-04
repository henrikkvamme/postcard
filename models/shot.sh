#!/bin/sh
# Render models in the gallery to a PNG from the deck canvas itself.
# models/shot.sh <out.png> <query> [angle]   e.g. shot.sh /tmp/t.png "only=train-hs&zoom=3.3" 25
out=$1; q=$2; a=${3:-25}
export CHROME_DEVTOOLS_AXI_ISOLATED_SESSION=${CHROME_DEVTOOLS_AXI_ISOLATED_SESSION:-models}
chrome-devtools-axi open "http://${GALLERY_HOST:-fry:4680}/models/gallery/?$q" >/dev/null
sleep 4
chrome-devtools-axi eval "window.__gallery.set($a), 'ok'" >/dev/null
sleep 1
chrome-devtools-axi eval "window.__gallery.shot()" | sed -n 's/^result: "\(.*\)"$/\1/p' | sed 's/^\\"//; s/\\"$//' | sed 's/^data:image\/png;base64,//' | base64 -d > "$out"
