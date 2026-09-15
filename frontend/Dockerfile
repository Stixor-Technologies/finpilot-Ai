# Dev-mode image: runs the same `bun run dev` a developer runs locally, just
# inside a container so `docker compose up` from the repo root brings up the
# frontend alongside every backend service — no separate `bun install`/`bun
# run dev` step on the host required.
FROM oven/bun:1

WORKDIR /app

# Installed separately from the rest of the source so this layer only
# reinvalidates when dependencies actually change, not on every source edit.
# Not --frozen-lockfile: the committed lockfile was resolved by a different
# bun version than this image's, so a strict frozen install fails here even
# though nothing in package.json actually changed.
COPY package.json bun.lock ./
RUN bun install

COPY . .

EXPOSE 8080

CMD ["bun", "run", "dev"]
