# Build stage
FROM golang:1.26-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache gcc musl-dev

# Copy go mod files
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY . .

# Build the binary
RUN CGO_ENABLED=1 GOOS=linux go build -ldflags="-w -s" -o hub ./cmd/hub

# Runtime stage
FROM alpine:latest

RUN apk add --no-cache ca-certificates wget

WORKDIR /app

# Copy binary from builder
COPY --from=builder /app/hub /app/hub

# Create data directory
RUN mkdir -p /data

VOLUME ["/data"]

EXPOSE 8080

ENTRYPOINT ["/app/hub"]
