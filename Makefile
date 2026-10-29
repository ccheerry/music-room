API := npm -w @music-room/api run
LOAD_ENV := set -a && . ../../.env && set +a

help: ## Show this help
	@awk 'BEGIN { FS = ":.*## " } /^[a-z-]+:.*## / { printf "  make %-10s %s\n", $$1, $$2 }' $(MAKEFILE_LIST)

install: ## Install every workspace, build shared, generate the Prisma client
	npm ci
	npm run build -w @music-room/shared
	cd apps/api && npx prisma generate

up: ## Start postgres, mailpit and the api in Docker
	docker compose up -d --build

down: ## Stop the Docker stack
	docker compose down

dev: ## Api in watch mode + Expo (postgres and mailpit in Docker)
	docker compose up -d postgres mailpit
	trap 'kill 0' INT; $(API) dev & npm -w @music-room/mobile run start

migrate: ## Apply Prisma migrations
	cd apps/api && $(LOAD_ENV) && npx prisma migrate dev

seed: ## Load demo data
	cd apps/api && $(LOAD_ENV) && npx prisma db seed

test: ## Run the shared, api (Vitest) and mobile (jest-expo) tests
	npm -w @music-room/shared test
	cd apps/api && $(LOAD_ENV) && npx vitest run
	npm -w @music-room/mobile test --if-present

lint: ## ESLint + Prettier check + type check
	npm run lint
	npm run typecheck --workspaces --if-present

format: ## Fix formatting with Prettier
	npm run format

docs: ## Export openapi.json (not implemented yet)
	@echo "TODO(step 10): export openapi.json"

mobile: ## Start the Expo dev server
	npm -w @music-room/mobile run start

loadtest: ## Run the Artillery scenarios (not implemented yet)
	@echo "TODO(step 11): artillery scenarios"

clean: ## Stop Docker and remove builds
	docker compose down
	rm -rf apps/*/dist packages/*/dist apps/api/src/generated

fclean: clean ## Also remove volumes, local images and node_modules
	docker compose down -v --rmi local
	rm -rf node_modules apps/*/node_modules packages/*/node_modules

.PHONY: help install up down dev migrate seed test lint format docs mobile loadtest clean fclean
