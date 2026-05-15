# Build stage
FROM golang:1.22-alpine AS builder

WORKDIR /app
RUN apk add --no-cache git build-base sqlite-dev

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=1 GOOS=linux go build -a -installsuffix cgo -o bin/trending-api ./cmd/api

# Runtime stage
FROM alpine:3.19

RUN apk add --no-cache ca-certificates sqlite-libs

WORKDIR /app
COPY --from=builder /app/bin/trending-api .
COPY --from=builder /app/.env.example .env

EXPOSE 8080
CMD ["./trending-api"]
