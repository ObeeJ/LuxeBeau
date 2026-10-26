# Build stage. Matches the Go version go.mod requires.
FROM golang:1.26-alpine AS builder

WORKDIR /src

# Copy dependency manifests first so the module download is cached
COPY go.mod go.sum ./
RUN go mod download

COPY . .

# Static binary (the API uses the pure-Go Postgres driver; SQLite is tests only)
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-w -s" -o /out/server ./cmd/api

# Runtime stage, pinned rather than :latest
FROM alpine:3.22

RUN apk --no-cache add ca-certificates \
    && addgroup -S appgroup && adduser -S -G appgroup appuser

# A directory the non-root user can read (the old /root location wasn't)
WORKDIR /app
COPY --from=builder --chown=appuser:appgroup /out/server ./server

USER appuser
EXPOSE 8080
CMD ["./server"]
