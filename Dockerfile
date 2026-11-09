# Stage 1: Build the application
FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Create the production image
FROM node:24-alpine
WORKDIR /app
COPY --from=build /app/.output ./
CMD ["node", "server/index.mjs"]
