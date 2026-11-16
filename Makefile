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

# File targets: each step only runs when its output is missing or older than its inputs.
node_modules/.package-lock.json: package-lock.json
	npm ci

packages/shared/dist: node_modules/.package-lock.json $(shell find packages/shared/src -type f)
	npm run build -w @music-room/shared
	touch $@

apps/api/src/generated/prisma: node_modules/.package-lock.json apps/api/prisma/schema.prisma
	cd apps/api && npx prisma generate
	touch $@

.env:
	@echo "missing .env: copy .env.example to .env and fill it in" && exit 1

setup: .env packages/shared/dist apps/api/src/generated/prisma ## Install, migrate and seed whatever is missing
	docker compose up -d --wait postgres mailpit
	cd apps/api && $(LOAD_ENV) && npx prisma migrate deploy
	@docker compose exec -T postgres sh -c \
		'psql -U "$$POSTGRES_USER" -d "$$POSTGRES_DB" -tAc "SELECT 1 FROM \"User\" LIMIT 1"' | grep -q 1 \
		|| $(MAKE) --no-print-directory seed

up: ## Start postgres, mailpit and the api in Docker, and wait until the api answers
	docker compose up -d --build --wait

down: ## Stop the Docker stack
	docker compose down

dev: setup ## Api in watch mode + Expo (runs setup first)
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

mobile: ## Start the Expo dev server for Expo Go (no social login, see docs)
	$(ROOT_ENV) && npm -w @music-room/mobile run start

mobile-dev: ## Start the Expo dev server for an installed development build
	$(ROOT_ENV) && npm -w @music-room/mobile run start:dev

mobile-android: ## Build and run the development build on an Android device or emulator
	$(ROOT_ENV) && cd apps/mobile && npx expo run:android

mobile-ios: ## Build and run the development build on an iPhone or simulator (macOS + Xcode)
	$(ROOT_ENV) && cd apps/mobile && npx expo run:ios --device

# LOADTEST_RATE: new users per second at the end of the ramp (each stays about 35 s).
LOADTEST_TARGET ?= http://localhost:3000
LOADTEST_RATE ?= 20
LOADTEST_SCENARIOS ?= vote playlist delegation mixed

loadtest: ## Run the Artillery scenarios against LOADTEST_TARGET, reports in loadtest/reports
	mkdir -p loadtest/reports
	for s in $(LOADTEST_SCENARIOS); do \
		(cd apps/api && $(LOAD_ENV) && npx tsx scripts/loadtest-seed.ts) || exit 1; \
		node loadtest/monitor.mjs $(LOADTEST_TARGET) loadtest/reports/$$s.health.jsonl & monitor=$$!; \
		LOADTEST_TARGET=$(LOADTEST_TARGET) LOADTEST_RATE=$(LOADTEST_RATE) npx artillery run \
			--config loadtest/common.yml --output loadtest/reports/$$s.json loadtest/$$s.yml; \
		kill $$monitor; \
	done
	cd apps/api && $(LOAD_ENV) && npx tsx scripts/loadtest-seed.ts --clean
	node loadtest/summary.mjs | tee loadtest/reports/summary.md

clean: ## Stop Docker and remove builds
	docker compose down
	rm -rf apps/*/dist packages/*/dist apps/api/src/generated

fclean: clean ## Also remove volumes, local images and node_modules
	docker compose down -v --rmi local
	rm -rf node_modules apps/*/node_modules packages/*/node_modules

.PHONY: help install setup up down dev migrate seed test coverage audit lint format docs mobile mobile-dev mobile-android mobile-ios loadtest clean fclean
