# Route lines for the map

Every segment that is not a plane or a walk needs a `path`. A path is a GeoJSON file relative to
the trip folder (`paths/<name>.geojson`) or an inline list of `[lng, lat]`. Planes draw a great
circle on their own. All sources are keyless.

## Which source to use

| Mode | Source | How |
| --- | --- | --- |
| Train, local bus, coach in the feeds | Transitous leg geometry | `transitous.py plan --paths <trip>/paths` writes it. |
| FlixBus, FlixTrain | OSRM road line, Transitous rail line | `flixbus.py search --paths <trip>/paths` writes it. |
| Train or bus that you added by hand | Transitous | `geometry.py rail A B --date YYYY-MM-DD --out ...` |
| Car, taxi, shuttle bus | OSRM | `geometry.py road A B --out ...` |
| Ferry | OSM ferry route through Overpass | `geometry.py ferry A B --out ...` |
| Anything else | Straight line | `geometry.py line A B --out ...`, plus a warning. |

## Rules

1. Write the lines into the trip's own `paths/` folder. Pass `--paths <trip>/paths`.
2. One ride has one file. Journeys that share a ride share the file.
3. The helpers simplify each line to about 300 m (`--tol 0.003`). That keeps a 500 km line under
   200 points.
4. Each line must start and end near its segment's places (within 15 km). The scenario tests
   check this. A line that ends at an airport when the stop is in town means a wrong position.
5. After `merge.py`, pass `--prune-paths` to delete the line files that no journey uses.

## Checks

- A ferry search finds nothing: raise `--radius` (the terminal can be far from the route end), or
  give `--name` with part of the route or operator name.
- Transitous finds no journey for `rail`: try another date in the published timetable.
- OSRM returns no route across water: add `--via` points at both ferry ports and add the ferry
  as its own segment.
