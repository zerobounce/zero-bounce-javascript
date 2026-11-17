# ZeroBounce JavaScript SDK – test image (Node 24 LTS, as CI)
# Pinned by digest (docker image inspect node:24-alpine); update tag and digest together.
FROM node:24-alpine@sha256:a34ab6d7f6f4813f4d0c5469d74685604b962fbdbf5793a7bc7b4998ecb867c8

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

COPY . .

# The tests build dist/ and write coverage/ under /app, and npm logs to its cache:
# give the unprivileged user a writable /app and a cache outside any home directory.
RUN chown 65532:65532 /app
ENV npm_config_cache=/tmp/.npm

USER 65532:65532

CMD ["npm", "run", "test:coverage"]
