.PHONY: all build build-api build-cli build-tui deps test clean run-api run-cli run-tui lint

BINARY_NAME=trending
API_BINARY=$(BINARY_NAME)-api
CLI_BINARY=$(BINARY_NAME)-cli
TUI_BINARY=$(BINARY_NAME)-tui

all: deps build

deps:
	go mod download
	go mod tidy

build: build-api build-cli build-tui

build-api:
	go build -o bin/$(API_BINARY) ./cmd/api

build-cli:
	go build -o bin/$(CLI_BINARY) ./cmd/cli

build-tui:
	go build -o bin/$(TUI_BINARY) ./cmd/tui

test:
	go test -v ./...

clean:
	rm -rf bin/

run-api:
	go run ./cmd/api

run-cli:
	go run ./cmd/cli

run-tui:
	go run ./cmd/tui

lint:
	golangci-lint run
