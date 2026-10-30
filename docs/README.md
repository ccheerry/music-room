# Music Room

## Description

Music Room is a **collaborative mobile application** for sharing music in real time. Several users join the same event or playlist and interact with it simultaneously, with the backend acting as the single source of truth.

The application is built around three features:

- **Music Track Vote** — live events where participants vote for tracks; the most voted song moves up the queue and plays first. Events can be public or private, and voting rights can be restricted by invitation, location or time window.
- **Music Control Delegation** — playback control (play, pause, skip) can be delegated to other users under per-device licenses.
- **Music Playlist Editor** — playlists edited collaboratively in real time by several users at once.

Across all features, the application provides full authentication (email/password with validation and recovery, plus OAuth login and account linking), user profiles with granular visibility, integration with a music provider SDK for playback, a documented REST API, and real-time synchronization across devices with proper conflict handling. Security matters: users only access their own data, every action is logged, and all secrets stay out of the repository.

## Stack

| Layer | Technology |
|---|---|
| Language | TypeScript (strict) everywhere |
| Mobile | React Native + Expo (Expo Router, development build), TanStack Query, Zustand, react-hook-form, expo-audio, expo-secure-store, expo-auth-session |
| Backend | Node.js 20+, Fastify with the zod type provider, Socket.IO, pino |
| Database | PostgreSQL 16 through Prisma |
| Auth | argon2id, short-lived JWT access tokens, rotating refresh tokens, Google and Facebook verified server-side |
| Mail | Nodemailer; Mailpit captures every mail in development |
| Music | Deezer public API (30 s previews), always proxied and cached by the backend |
| Tests | Vitest, socket.io-client, fast-check, jest-expo, Testing Library, Maestro |
| Load | Artillery (HTTP + Socket.IO) |
| CI | GitHub Actions |

The repository is an npm workspaces monorepo:

- `apps/api` — REST API and Socket.IO server
- `apps/mobile` — Expo application
- `packages/shared` — zod schemas shared by both sides: every request, response and socket payload is defined once here

## Requirements

- Node.js 20 or later, with npm
- Docker with Compose
- `make`
- An Android or iOS device or emulator; Android Studio or Xcode for the development build
- A Google Cloud OAuth client and a Meta app for social login

Nothing is vendored: every dependency is downloaded by `make install`.

## Setup

```bash
cp .env.example .env    # fill in the values described below
make install            # install every workspace
make up                 # start postgres, mailpit and the api in Docker
make migrate seed       # apply the schema and load demo data
make mobile             # start the Expo dev server
```

Every variable is listed in `.env.example`. `.env` is git-ignored, and the API refuses to start if a required variable is missing.

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection |
| `JWT_SECRET` | Access token signature, at least 32 characters (`openssl rand -base64 48`) |
| `SMTP_HOST` / `SMTP_PORT` | Mail server (Mailpit in development) |
| `MAIL_FROM` | Sender of verification and reset mails |
| `APP_LINK_URL` | Base of the links in mails: `musicroom://` for a build, `exp://<lan-ip>:8081/--/` for Expo Go |
| `GOOGLE_CLIENT_IDS` | Accepted audiences for Google id tokens |
| `FACEBOOK_APP_ID` / `FACEBOOK_APP_SECRET` | Facebook token verification |
| `EXPO_PUBLIC_API_URL` | Default backend URL of the app |

## Running

| Service | Address |
|---|---|
| API | `http://localhost:3000/api/v1` |
| API documentation (Swagger) | `http://localhost:3000/docs` |
| Captured mails (Mailpit) | `http://localhost:8025` |

The backend address used by the app can be changed at runtime from its **Settings** screen, which also tests the connection. A phone on the same network reaches the API through the machine's LAN IP.

### Make targets

```bash
make           # list every target (same as make help)
make install   # install every workspace, build shared, generate the Prisma client
make up        # start postgres, mailpit and the api in Docker
make down      # stop the Docker stack
make dev       # api in watch mode + Expo
make migrate   # apply Prisma migrations
make seed      # load demo data
make test      # shared, api and mobile test suites
make lint      # eslint + prettier check + type check
make format    # fix formatting
make docs      # export openapi.json
make mobile    # Expo dev server
make loadtest  # Artillery scenarios
make clean     # stop Docker and remove builds
make fclean    # also remove volumes, local images and node_modules
```

## Testing

- `make test` runs unit tests, integration tests against a real PostgreSQL, socket tests and mobile component tests.
- Concurrency is tested explicitly: simultaneous votes from many users, duplicated votes, simultaneous playlist moves, and random operation sequences from several clients (property-based) checking that the playlist order is always consistent.
- `make loadtest` runs the load scenarios; method and results are in `docs/RAMP_UP.md`.

## Architecture

- The server is the single source of truth. The app sends intents and renders the state the server returns; no ordering, scoring or permission logic lives in the app.
- Every mutation is a REST call. After it commits, the new state is broadcast to the matching Socket.IO room, and every state message carries a `version`.
- Votes are rows keyed by `(track, user)`, so a vote cannot be counted twice; the queue order is computed, never stored.
- Playlist positions are fractional keys. Each operation locks the playlist row, names entries by id, and rewrites a single row. An operation on an entry that no longer exists returns `409` with the current state.

## Project structure

```
apps/
  api/
    prisma/            schema, migrations, seed
    src/
      app.ts           Fastify instance
      server.ts        entry point
      plugins/         auth, rate limit, swagger, action log, errors
      modules/         one folder per resource: routes, service, schemas
    test/              integration and concurrency tests
  mobile/
    app/               Expo Router screens
    src/               api client, features, hooks, stores, components
    .maestro/          end-to-end flows
packages/
  shared/              zod schemas, DTO types, socket event map
loadtest/              Artillery scenarios
docs/                  security notes, load test report
```

## Security

- Passwords hashed with argon2id; mail tokens are single-use and stored hashed.
- Refresh tokens rotate on every use; reusing an old one revokes the whole session family.
- Every body, query, parameter, socket payload and external response is validated with zod.
- Errors follow `{ error: { code, message } }` and never include stack traces. Private resources answer `404` to users without access, and authentication endpoints do not reveal whether an account exists.
- Rate limiting and login backoff protect the authentication endpoints.
- Every action is stored in an action log with user, platform, device and app version.
- Secrets live only in `.env`; none are committed.

Details are in `docs/SECURITY.md`.
