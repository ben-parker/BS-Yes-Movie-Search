# Stage 1: Build the application
FROM node:26-alpine3.24 AS build
WORKDIR /app
RUN apk upgrade --no-cache
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Create the production image
FROM alpine:3.24
WORKDIR /app
RUN apk upgrade --no-cache && apk add --no-cache ca-certificates libatomic libstdc++
COPY --from=build /usr/local/bin/node /usr/local/bin/
COPY --from=build /app/.output ./
CMD ["node", "server/index.mjs"]
