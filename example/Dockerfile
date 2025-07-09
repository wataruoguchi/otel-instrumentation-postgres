# STAGE 1: Grab a copy of tini
FROM node:20-alpine AS tini

RUN apk add --no-cache tini

# STAGE 2: Build our code into a package.
FROM node:20-alpine AS build

WORKDIR /workspace

# Copy workspace files
COPY package*.json ./

WORKDIR /workspace/lib
COPY lib ./

# Install jq and remove husky prepare script for Docker build (safely)
RUN apk add --no-cache jq
RUN jq 'del(.scripts.prepare)' package.json > package.tmp.json && mv package.tmp.json package.json

# Install dependencies and build lib package
RUN npm clean-install && npm run build && npm prune --production

WORKDIR /workspace/app

# Copy example files
COPY example/package*.json ./
COPY example/tsconfig.json ./
COPY example/tsup.config.ts ./
COPY example/src ./src

# Install example dependencies and build
RUN npm clean-install && \
  npm run build && \
  npm prune --production

# Manually install the lib package
RUN mkdir -p /tmp/lib-package && \
    cp -r /workspace/lib/dist/* /tmp/lib-package/ && \
    cp /workspace/lib/package.json /tmp/lib-package/ && \
    rm -rf node_modules/otel-instrumentation-postgres && \
    mkdir -p node_modules/otel-instrumentation-postgres && \
    mkdir -p node_modules/otel-instrumentation-postgres/dist && \
    cp -r /tmp/lib-package/* node_modules/otel-instrumentation-postgres/dist/ && \
    cp /tmp/lib-package/package.json node_modules/otel-instrumentation-postgres/ && \
    ls -la node_modules/otel-instrumentation-postgres/

# STAGE 3: Production container
FROM node:20-alpine

WORKDIR /app

COPY --from=build /workspace/app/node_modules ./node_modules
COPY --from=build /workspace/app/dist ./dist
COPY --from=tini /sbin/tini /sbin/tini

# Create a non-root user
RUN addgroup -g 1001 -S appgroup && \
    adduser -S -D -H -h /app -s /sbin/nologin -G appgroup -g appgroup appuser

# Change ownership of the app directory
RUN chown -R appuser:appgroup /app

# Switch to the non-root user
USER appuser

# Use tini as the init system
ENV NODE_OPTIONS="--require /app/dist/app-telemetry.js"
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/index.js"]
