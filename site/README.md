# The postcard site

The public front door for the skill: the home page, `llms.txt` for agents, and a live example. Everything
is static. A person's own trip page is built and served on their computer by their agent, never here.

| Path | What it is |
| --- | --- |
| `index.html`, `home.css`, `home.js` | The home page shell. `?v=<id>` picks a variant and shows the variant switcher. |
| `hero/` | The home page (`type.js`, `type.css`): routes around the world on the turning globe, four example trips to point at, the bill, and one copy button. `hero/common.js` has the shared parts; `hero/world/trip.json` has the routes and trips (typical timetable times, rounded example fares). |
| `llms.txt` | The agent guide: install the skill, or a short guide without it. |
| `serve.py` | The development server. |
| `Dockerfile`, `nginx.conf` | The image for hosting. |

The kit is not copied here. `serve.py` and the image serve it at `/kit/` from
`plugins/postcard/skills/postcard/kit`, the `nordic-loop` example at `/nordic/`, and the skill's `SKILL.md`, `references/` and `scripts/` at
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

The domain, `postcard.henrikkvamme.no`, is written in `index.html`, `hero/common.js` and `llms.txt`.
