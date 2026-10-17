# ZeroBounce JavaScript SDK – test image (Node 20 LTS)
FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --ignore-scripts || npm install

COPY . .


USER 65532:65532

CMD ["npm", "run", "test:coverage"]
