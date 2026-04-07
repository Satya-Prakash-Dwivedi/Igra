# build stage
FROM node:22-alpine AS build

WORKDIR /app

# install dependencies
COPY package*.json ./
RUN npm install

# copy all files and build
COPY . .
RUN npm run build

# runtime stage
FROM node:22-alpine AS runtime

WORKDIR /app

# install production dependencies only
COPY package*.json ./
RUN npm install --omit=dev

# copy built assets from build stage
COPY --from=build /app/dist ./dist

# add a professional non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
RUN chown -R appuser:appgroup /app
USER appuser

EXPOSE 5000

CMD ["node", "dist/server.js"]
