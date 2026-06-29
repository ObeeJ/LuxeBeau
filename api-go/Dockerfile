# Build stage
FROM golang:1.22-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache git

# Copy dependency manifests
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY . .

# Build static binary
RUN CWD=$(pwd) && CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -o server ./cmd/api

# Final runtime stage
FROM alpine:latest

RUN apk --no-cache add ca-certificates tzdata

WORKDIR /root/

# Run as non-root user for production security hardening
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

# Copy static binary from build stage
COPY --from=builder /app/server .

# Expose port and configure entrypoint
EXPOSE 8080

CMD ["./server"]
