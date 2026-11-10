# ZeroBounce JavaScript SDK – test image (Node 24 LTS, as CI)
FROM node:24-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --ignore-scripts || npm install

COPY . .


USER 65532:65532

CMD ["npm", "run", "test:coverage"]
