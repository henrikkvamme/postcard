#!/bin/sh
# Build the workshop's variant sets: every style x palette x base for every model.
# Output: models/workshop/out/<style>-<palette>-<base>/ (not committed).
cd "$(dirname "$0")/../.."
SAMPLE=""  # all models
for s in shaded ink flat; do for p in subject strict; do for b in plinth footprint none; do
  d="models/workshop/out/$s-$p-$b"; mkdir -p "$d"
  MODEL_STYLE=$s MODEL_PALETTE=$p MODEL_BASE=$b MODEL_OUT="$d" node models/build.mjs $SAMPLE > /dev/null || exit 1
done; done; done
echo built $(ls models/workshop/out | wc -l) sets
