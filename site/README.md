# The postcard site

The public front door for the skill: the home page, `llms.txt` for agents, and the hosted viewer.
Everything is static. The viewer draws a trip on the person's device and sends nothing to the server.

| Path | What it is |
| --- | --- |
| `index.html`, `home.css`, `home.js` | The home page shell. `?v=<id>` picks a variant and shows the variant switcher. |
| `hero/` | The home page (`type.js`, `type.css`): routes around the world on the turning globe, four example trips to point at, the bill, and one copy button. `hero/common.js` has the shared parts; `hero/world/trip.json` has the routes and trips (typical timetable times, rounded example fares). |
| `llms.txt` | The agent guide: install the skill, or a short guide without it. |
| `view/` | The viewer at `/view`. It reads `#trip=<URL>`, `#data=<base64url of gzip(trip.json)>`, dropped or picked files, or a `{ type: 'postcard:trip', trip }` message from the page that embeds it. |
| `nordic/` | The Mix story page for a loop from Oslo, the live example. |
| `serve.py` | The development server. |
| `Dockerfile`, `nginx.conf` | The image for hosting. |

The kit is not copied here. `serve.py` and the image serve it at `/kit/` from
`plugins/postcard/skills/postcard/kit`, and the skill's `SKILL.md`, `references/` and `scripts/` at
`/skill/`. `/postcard-skill.tar.gz` is the whole skill folder.

## Run

```sh
python3 site/serve.py --host 0.0.0.0 --port 4390
```

## Build the image

From the repository root:

```sh
docker build -f site/Dockerfile -t postcard-site .
docker run --rm -p 8080:80 postcard-site
```

The domain, `postcard.henrikkvamme.no`, is written in `index.html`, `llms.txt` and `view/view.js`.

## The viewer and untrusted trips

A trip can come from any link, so the viewer:

- checks the size (8 MB of JSON, 2,000 journeys, 250,000 path points) before it draws;
- reads every GeoJSON path itself and gives the kit inline lines;
- removes `<` and `>` from every string, because the kit's chart writes place names into the page as HTML;
- runs no code from the trip, and loads scripts only from this site and pinned unpkg builds (a CSP in `view/index.html`).

Booking needs the person's own agent, because a public page cannot reach their computer. Book opens a sheet with
the request to copy to the agent.
