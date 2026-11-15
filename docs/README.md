# Music Room

## Description

Music Room is a **collaborative mobile application** for sharing music in real time. Several users join the same event or playlist and interact with it simultaneously, with the backend acting as the single source of truth.

The application is built around three features:

- **Music Track Vote** — live events where participants vote for tracks; the most voted song moves up the queue and plays first. Events can be public or private, and voting rights can be restricted by invitation, location or time window.
- **Music Control Delegation** — playback control (play, pause, skip) can be delegated to other users under per-device licenses.
- **Music Playlist Editor** — playlists edited collaboratively in real time by several users at once.

Across all features, the application provides full authentication (email/password with validation and recovery, plus OAuth login and account linking), user profiles with granular visibility, integration with a music provider (Deezer) for search and playback, a documented REST API, and real-time synchronization across devices with proper conflict handling. Security matters: users only access their own data, every action is logged, and all secrets stay out of the repository.

## Stack

| Layer | Technology | Why |
|---|---|---|
| Language | TypeScript (strict) everywhere | One language and one set of types for the API, the app and their contract |
| Mobile | React Native + Expo (Expo Router), TanStack Query, Zustand, react-hook-form, expo-audio, expo-secure-store, expo-auth-session | One code base for Android and iOS; the app only caches and renders server state |
| Backend | Node.js 22+, Fastify with the zod type provider, Socket.IO, pino | One zod schema validates, serialises and documents each route; Socket.IO gives rooms, acknowledgements and reconnection |
| API style | REST over JSON for every change, Socket.IO for broadcasts | A single write path to validate, limit, log and document; JSON is native to both sides and to Swagger |
| Database | PostgreSQL 16 through Prisma | Transactions, unique constraints and row locks solve the concurrency cases; typed queries and migrations |
| Auth | argon2id, short-lived JWT access tokens, rotating refresh tokens, Google and Facebook verified server-side | Stateless requests, revocable sessions, no provider secret in the app |
| Mail | Nodemailer; Mailpit captures every mail in development | Verification and reset mails can be read locally at `http://localhost:8025` |
| Music | Deezer public API (30 s previews), always proxied and cached by the backend | Search and playable previews without a paid account; the SDK only plays sound, every rule is ours |
| Tests | Vitest, socket.io-client, fast-check, jest-expo, Testing Library, Maestro | Unit, integration against a real database, socket, property-based and component tests |
| Load | Artillery (HTTP + Socket.IO) | Both protocols in the same scenario |

The repository is an npm workspaces monorepo:

- `apps/api` — REST API and Socket.IO server
- `apps/mobile` — Expo application
- `packages/shared` — zod schemas shared by both sides: every request, response and socket payload is defined once here

## Requirements

- Node.js 22 or later, with npm
- Docker with Compose
- `make`
- An Android or iOS device or emulator; Android Studio or Xcode for the development build
- Optional: a Google Cloud OAuth client and a Meta app for social login (everything else works without them)

Nothing is vendored: every dependency is downloaded by `make install`.

## Setup

```bash
cp .env.example .env    # fill in the values described below
make install            # install every workspace (always first: nothing runs without it)
docker compose up -d postgres mailpit
make migrate seed       # apply the schema and load demo data
make dev                # api in watch mode + Expo dev server
```

The shortest way to a running backend, with the API in Docker as well:

```bash
cp .env.example .env
make install up seed
```

`make up` runs the API in Docker instead, on the same port 3000: use either `make up` or `make dev`, not both at once. The container applies pending migrations by itself when it starts, so `make install up` is enough on a clean machine; `make seed` then adds the demo data.

`.env.example` lists the variables to set. `.env` is git-ignored, and the API refuses to start if a required variable is missing or malformed.

| Variable | Purpose |
|---|---|
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | Account and database created by the Postgres container |
| `DATABASE_URL` | PostgreSQL connection used from the host (`make dev`, `migrate`, `seed`, `test`) |
| `PORT` / `LOG_LEVEL` | API port (3000) and log level |
| `TEST_DATABASE_URL` | Optional, database used by the API tests (default: `DATABASE_URL` with `_test` appended) |
| `JWT_SECRET` | Access token signature, at least 32 characters (`openssl rand -base64 48`) |
| `CORS_ORIGINS` | Browser origins allowed to call the API (Expo Web), comma-separated |
| `RATE_LIMIT_MAX` | Requests per minute for one user, or one address when logged out (default 300) |
| `AUTH_RATE_LIMIT_MAX` | Requests per 15 minutes for one address on each of login, sign-up, resend and forgot password (default 30) |
| `TRUST_PROXY` | `true` when the API runs behind a reverse proxy, so limits use the real client address |
| `SMTP_HOST` / `SMTP_PORT` | Mail server (Mailpit in development) |
| `MAIL_FROM` | Sender of verification and reset mails |
| `APP_LINK_URL` | Base of the links in mails: `musicroom://` for a build, `exp://<lan-ip>:8081/--/` for Expo Go |
| `GOOGLE_CLIENT_IDS` | Accepted audiences for Google id tokens, comma-separated (web, iOS, Android client ids) |
| `FACEBOOK_APP_ID` / `FACEBOOK_APP_SECRET` | Facebook token verification |
| `EXPO_PUBLIC_API_URL` | Default backend URL of the app |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` / `_IOS_` / `_ANDROID_` | Google client ids used by the app |
| `EXPO_PUBLIC_FACEBOOK_APP_ID` | Facebook app id used by the app |

Social login is optional: while the server variables are empty, `/auth/google` and `/auth/facebook` answer `503 SOCIAL_DISABLED`, and the app hides the buttons when its own ids are empty.

## Running

| Service | Address |
|---|---|
| API | `http://localhost:3000/api/v1` |
| API documentation (Swagger) | `http://localhost:3000/docs` |
| Same contract as a file | `docs/openapi.json` |
| Socket.IO contract | `docs/API_REALTIME.md` |
| Captured mails (Mailpit) | `http://localhost:8025` |

The backend address used by the app can be changed at runtime from its **Settings** screen, which also tests the connection. A phone on the same network reaches the API through the machine's LAN IP (`http://<lan-ip>:3000`); `localhost` only works on an emulator or in the browser.

To open the app: run `make dev` (or `make mobile` when the API runs in Docker) and scan the QR code with Expo Go, or press `a` for an Android emulator.

`make seed` creates four verified accounts, all with the password `musicroom1`: `alice@musicroom.local`, `bob@musicroom.local`, `carol@musicroom.local` and `dave@musicroom.local`. Alice is friends with Bob and Carol, Dave has a pending request to Alice. Alice owns the event "Friday party" (Bob invited) and the playlist "Road trip" (Bob is a member, only members edit).

### The app

The app has five tabs:

- **Events** (Music Track Vote): discover, invited and own events; create one, suggest tracks, vote, follow the ranked queue live. The owner's phone plays the current track; the server advances to the most voted track when a preview ends.
- **Playlists** (Music Playlist Editor): own, shared and public playlists; add, move and remove tracks while others do the same; "Play in order" plays the playlist on this phone.
- **Search**: Deezer search; tapping a result plays its 30 second preview in the mini player, which stays visible above the tabs.
- **Control** (Music Control Delegation): devices this user may control, with a remote (play, pause, next, previous, volume) for each.
- **Profile**: the three profile tiers and music preferences, plus friends, devices and their grants, linked accounts, password and log out.

Every feature except two works in Expo Go. Social login and the links in mails (`musicroom://…`) need a development build with its own application id and the OAuth clients registered for it at Google and Meta; with Expo Go, set `APP_LINK_URL=exp://<lan-ip>:8081/--/` so the mail links open the app.

### Make targets

```bash
make           # list every target (same as make help)
make install   # install every workspace, build shared, generate the Prisma client
make up        # start postgres, mailpit and the api in Docker (migrations applied on start)
make down      # stop the Docker stack
make dev       # api in watch mode + Expo
make migrate   # apply Prisma migrations
make seed      # load demo data
make test      # shared, api and mobile test suites
make coverage  # coverage of shared and api, fails under 80 %
make audit     # npm audit of the API dependencies, no tracked .env file
make lint      # eslint + prettier check + type check
make format    # fix formatting
make docs      # export docs/openapi.json (database up)
make mobile    # Expo dev server
make loadtest  # Artillery scenarios, reports in loadtest/reports
make clean     # stop Docker and remove builds
make fclean    # also remove volumes, local images and node_modules
```

## Testing

- `make test` runs unit tests, integration tests against a real PostgreSQL (start it with `docker compose up -d postgres`), socket tests and mobile component tests.
- The API tests never use the development database. They run on `TEST_DATABASE_URL`, by default the same server with `_test` appended to the database name (`musicroom_test`). Every run creates it if needed, applies the migrations and empties it; the runner refuses to start if it points to `DATABASE_URL`.
- External services are replaced at their boundary in tests: the Deezer HTTP client and the Google / Facebook verifiers.
- Concurrency is tested explicitly: simultaneous votes from many users, duplicated votes, simultaneous playlist moves, and random operation sequences from several clients (property-based) checking that the playlist order is always consistent.
- A generated test calls every route as a stranger and expects `401`, `403` or `404`; it fails when a route is added without a rule.
- `docs/openapi.json` is compared with the running API by a test: run `make docs` after changing a route.
- `make coverage` reports coverage and fails under 80 %.
- `make loadtest` runs the load scenarios against a running stack (`make up`); it writes its users into the database of `DATABASE_URL` and removes them at the end. `LOADTEST_RATE` (new users per second, default 20) and `LOADTEST_TARGET` can be passed to `make`. Method and results are in `docs/RAMP_UP.md`.
- `apps/mobile/.maestro` holds five end-to-end flows for Maestro (sign up and verify, log in, vote, edit a playlist, delegate control); they need a device or emulator with the app installed and are not part of `make test`.

## Documentation

| File | Content |
|---|---|
| `docs/openapi.json` | REST contract: every route, input, output and example (also served at `/docs`) |
| `docs/API_REALTIME.md` | Socket.IO contract: rooms, events, payloads, errors |
| `docs/SECURITY.md` | Threats considered, protection in place, remaining risk |
| `docs/RAMP_UP.md` | Load test method, machine, measured capacity of the three services |

## Architecture

- The server is the single source of truth. The app sends intents and renders the state the server returns; no ordering, scoring or permission logic lives in the app.
- Every mutation is a REST call. After it commits, the new state is broadcast to the matching Socket.IO room, and every state message carries a `version`.
- Votes are rows keyed by `(track, user)`, so a vote cannot be counted twice; the queue order is computed, never stored.
- The event playback clock lives on the server (`currentEntryId`, `currentStartedAt`). Skipping names the entry the caller saw playing, so two simultaneous skips advance one track.
- Playlist positions are fractional keys. Each operation locks the playlist row, names entries by id, and rewrites a single row. An operation on an entry that no longer exists returns `409` with the current state.
- Event broadcasts are coalesced to at most one every 200 ms per event.
- Socket.IO rooms: `user:<id>` and `device:<id>` are joined on connection; `event:<id>`, `playlist:<id>` and `remote:<deviceId>` (the controllers of a device) are joined with `room:join`, which asks the owning module whether the user may see the resource.
- Device control: a controller sends `device:command`, the server checks the grant and relays it to the device, which reports `device:status` back to its controllers. Revoking a grant or ending a friendship removes the controller from the room immediately.

## Project structure

```
apps/
  api/
    prisma/            schema, migrations, seed
    src/
      app.ts           Fastify instance
      server.ts        entry point
      config/          environment schema
      plugins/         auth, swagger, action log, errors
      lib/             small helpers (tokens, cache, distance, limits, social verifiers)
      mail/            mail sender
      modules/         health, auth, social, me, users, friends, catalog,
                       events, playlists, devices (routes and service),
                       realtime (Socket.IO server)
    scripts/           OpenAPI export, load test data
    test/              integration, socket and concurrency tests
  mobile/
    app/               Expo Router screens
    src/               api client, features, realtime, hooks, stores, components
    test/              component and unit tests
    .maestro/          end-to-end flows
packages/
  shared/              zod schemas, DTO types, socket event map
loadtest/              Artillery scenarios
docs/                  OpenAPI file, Socket.IO contract, security notes, load test report
```

## Security

- Passwords hashed with argon2id; mail tokens are single-use and stored hashed.
- Refresh tokens rotate on every use; reusing an old one revokes the whole session family.
- Every body, query, parameter, socket payload and external response is validated with zod.
- Errors follow `{ error: { code, message } }` and never include stack traces. Private resources answer `404` to users without access, and authentication endpoints do not reveal whether an account exists.
- Every route has a request budget per user (per address when logged out); login, sign-up and mail routes each have a stricter one per address, mails are limited per mailbox, and repeated login failures lock the email for a growing delay.
- Changing or resetting a password logs the other devices out.
- Security headers on every answer, 100 KB body limit, CORS limited to the configured origins.
- Losing access (invitation withdrawn, resource made private, control revoked or expired) removes the user from the live room at once.
- Every action is stored in an action log with user, platform, device and app version. Rows are written in batches from a bounded buffer.
- Secrets live only in `.env`; none are committed.

Details are in `docs/SECURITY.md`.

## Known limitations

- The voting zone of a location event is placed at the phone's current position; there is no map picker.
- Playlist entries are reordered with up / down buttons rather than drag and drop.
- Location checks trust the coordinates sent by the phone, which can be spoofed.
- Rate limits, login backoff and catalog caches are kept in memory, per API instance.
- Event playback timers and broadcast coalescing live in the API process; running several API instances needs a shared adapter (see the load test report).
- Only the owner of an event can skip a track, and only the owner's phone plays the event audio.
- A device is identified by user, platform and model: two phones of the same model on one account count as one device.
- On the remote, next and previous act on a playlist being played in order; they do nothing on a single track or an event.
- An event queue holds at most 200 waiting tracks, a playlist 500.
- Social login needs OAuth credentials and a development build; it is covered by tests with the providers replaced, not by a run against Google or Facebook.
