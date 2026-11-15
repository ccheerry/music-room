API := npm -w @music-room/api run
LOAD_ENV := set -a && . ../../.env && set +a
# Same from the repository root: the Expo server needs the EXPO_PUBLIC_* variables.
ROOT_ENV := set -a && . ./.env && set +a

help: ## Show this help
	@awk 'BEGIN { FS = ":.*## " } /^[a-z-]+:.*## / { printf "  make %-10s %s\n", $$1, $$2 }' $(MAKEFILE_LIST)

install: ## Install every workspace, build shared, generate the Prisma client
	npm ci
	npm run build -w @music-room/shared
	cd apps/api && npx prisma generate

up: ## Start postgres, mailpit and the api in Docker, and wait until the api answers
	docker compose up -d --build --wait

down: ## Stop the Docker stack
	docker compose down

dev: ## Api in watch mode + Expo (postgres and mailpit in Docker)
	docker compose up -d postgres mailpit
	trap 'kill 0' INT; $(API) dev & $(ROOT_ENV) && npm -w @music-room/mobile run start

migrate: ## Apply Prisma migrations
	cd apps/api && $(LOAD_ENV) && npx prisma migrate dev

seed: ## Load demo data
	cd apps/api && $(LOAD_ENV) && npx prisma db seed

test: ## Run the shared, api (Vitest) and mobile (jest-expo) tests
	npm -w @music-room/shared test
	cd apps/api && $(LOAD_ENV) && npx vitest run
	npm -w @music-room/mobile test --if-present

coverage: ## Test coverage of shared and api (fails under 80 %)
	npm -w @music-room/shared test -- --coverage
	cd apps/api && $(LOAD_ENV) && npx vitest run --coverage

audit: ## Known vulnerabilities in what the API ships, and no tracked .env file
	npm audit --omit=dev -w @music-room/api -w @music-room/shared --audit-level=high
	@test -z "$$(git ls-files | grep -E '(^|/)\.env(\..+)?$$' | grep -v '\.env\.example$$')" \
		|| { echo "a .env file is tracked by git"; exit 1; }

lint: ## ESLint + Prettier check + type check
	npm run lint
	npm run typecheck --workspaces --if-present

format: ## Fix formatting with Prettier
	npm run format

docs: ## Export docs/openapi.json (needs the database up)
	cd apps/api && $(LOAD_ENV) && npx tsx scripts/export-openapi.ts

mobile: ## Start the Expo dev server
	$(ROOT_ENV) && npm -w @music-room/mobile run start

# LOADTEST_RATE: new users per second at the end of the ramp (each stays about 35 s).
LOADTEST_TARGET ?= http://localhost:3000
LOADTEST_RATE ?= 20

loadtest: ## Run the Artillery scenarios against LOADTEST_TARGET, reports in loadtest/reports
	mkdir -p loadtest/reports
	for s in vote playlist delegation mixed; do \
		(cd apps/api && $(LOAD_ENV) && npx tsx scripts/loadtest-seed.ts) || exit 1; \
		LOADTEST_TARGET=$(LOADTEST_TARGET) LOADTEST_RATE=$(LOADTEST_RATE) npx artillery run \
			--config loadtest/common.yml --output loadtest/reports/$$s.json loadtest/$$s.yml; \
	done
	cd apps/api && $(LOAD_ENV) && npx tsx scripts/loadtest-seed.ts --clean

clean: ## Stop Docker and remove builds
	docker compose down
	rm -rf apps/*/dist packages/*/dist apps/api/src/generated

fclean: clean ## Also remove volumes, local images and node_modules
	docker compose down -v --rmi local
	rm -rf node_modules apps/*/node_modules packages/*/node_modules

.PHONY: help install up down dev migrate seed test coverage audit lint format docs mobile loadtest clean fclean
