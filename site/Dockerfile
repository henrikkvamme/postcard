# The postcard site as one static image. Build from the repository root, so the kit and the skill are
# copied in from plugins/ and never kept twice in git:
#
#   docker build -f site/Dockerfile -t postcard-site .
#   docker run --rm -p 8080:80 postcard-site
FROM alpine:3.20 AS skill
COPY plugins/postcard/skills/postcard /src/postcard
RUN find /src/postcard \( -name __pycache__ -o -name .DS_Store \) -prune -exec rm -rf {} + \
 && tar -C /src -czf /src/postcard-skill.tar.gz postcard

FROM nginx:1.27-alpine
COPY site/nginx.conf /etc/nginx/conf.d/default.conf
COPY site/ /usr/share/nginx/html/
COPY --from=skill /src/postcard/kit /usr/share/nginx/html/kit
COPY --from=skill /src/postcard/SKILL.md /usr/share/nginx/html/skill/SKILL.md
COPY --from=skill /src/postcard/references /usr/share/nginx/html/skill/references
COPY --from=skill /src/postcard/scripts /usr/share/nginx/html/skill/scripts
COPY --from=skill /src/postcard-skill.tar.gz /usr/share/nginx/html/postcard-skill.tar.gz
RUN rm /usr/share/nginx/html/serve.py /usr/share/nginx/html/Dockerfile /usr/share/nginx/html/nginx.conf
