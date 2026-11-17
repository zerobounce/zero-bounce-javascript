# ZeroBounce JavaScript SDK – test image (Node 24 LTS, as CI)
# Pinned by the digest of the multi-platform image index, read from the registry: a token from
# auth.docker.io (scope repository:library/node:pull), then a HEAD on
# registry-1.docker.io/v2/library/node/manifests/24-alpine with Accept:
# application/vnd.oci.image.index.v1+json; the Docker-Content-Digest header is the digest.
# (Not `docker image inspect`: that shows a local, single-platform id.) Update tag and digest together.
FROM node:24-alpine@sha256:116b800c3754b440ee0aa3ed2f20f5bf3d99a554bfd9adeea09ea8017f6e85f5

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
