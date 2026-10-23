API := npm -w @music-room/api run
LOAD_ENV := set -a && . ../../.env && set +a

install:
	npm ci
	npm run build -w @music-room/shared
	cd apps/api && npx prisma generate

up:
	docker compose up -d --build

down:
	docker compose down

dev:
	docker compose up -d postgres mailpit
	trap 'kill 0' INT; $(API) dev & npm -w @music-room/mobile run start

migrate:
	cd apps/api && $(LOAD_ENV) && npx prisma migrate dev

seed:
	cd apps/api && $(LOAD_ENV) && npx prisma db seed

test:
	cd apps/api && $(LOAD_ENV) && npx vitest run
	npm -w @music-room/mobile test --if-present

lint:
	npm run lint
	npm run typecheck --workspaces --if-present

docs:
	@echo "TODO(step 10): export openapi.json"

mobile:
	npm -w @music-room/mobile run start

loadtest:
	@echo "TODO(step 11): artillery scenarios"

clean:
	docker compose down
	rm -rf apps/*/dist packages/*/dist apps/api/src/generated

fclean: clean
	docker compose down -v --rmi local
	rm -rf node_modules apps/*/node_modules packages/*/node_modules

.PHONY: install up down dev migrate seed test lint format docs mobile loadtest clean fclean

format:
	npm run format
