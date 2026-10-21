# music-room

## 📖 About

"music-room" is a **full-stack mobile project**: a collaborative music app in
which the people around you decide what plays next. A **React Native (Expo)**
app talks to a **Node.js / Fastify** back-end over a documented REST + JSON API
and a Socket.IO channel; **PostgreSQL** keeps every piece of state, because the
server — not the phone — is the truth.

Three services sit on top of a shared account system:

- **Music Track Vote** — at a party, anyone allowed can suggest a track or vote
  for one; the most voted track plays next.
- **Music Playlist Editor** — friends edit the same playlist live, adding,
  removing and reordering tracks at the same time.
- **Music Control Delegation** — lend the remote of one of your devices to the
  friends you choose.

The interesting part is not playing music, it is that **many people act on the
same list at the same instant**. Votes are rows protected by a primary key, so a
double vote cannot exist and the order is computed, never stored. Playlist
positions are fractional keys, so a move rewrites a single row, and every
operation runs under a short row lock and names tracks by id rather than by
index — two users moving tracks at once always converge on the same order.

The catalog comes from the public **Deezer API** (30-second previews), proxied
and cached by the back-end; the app stays a pure remote control whose server
address can be changed from its settings.

## 🎯 Objectives

- Designing a client / server architecture where the back-end is the single source of truth
- Defining a **REST + JSON** API and documenting it with **OpenAPI / Swagger**
- Pushing live state to every client with **Socket.IO** rooms
- Solving **concurrent votes** and **concurrent reorders** without lost updates
- Sign-up by email (with validation and password reset), **Google** and **Facebook**
- Short-lived JWTs with **rotating refresh tokens** and theft detection
- Per-field profile visibility: public, friends only, private
- Visibility (public / private) and licenses (everyone / invited / place + time) per service
- Per-device permissions for remote control
- Logging every app action with platform, device and app version
- Measuring how many users the platform holds with **load tests**
- Shipping a repo where `make` downloads and starts everything, with no secret committed

## 📋 Function Overview

<details>
<summary><strong>music-room — modules breakdown</strong></summary>

<br>

| Module | Feature | Description |
|--------|---------|-------------|
| **auth** | Email sign-up | argon2id hashes, verification mail with a single-use hashed token |
| **auth** | Password reset | Always answers `204`, so an address can't be probed; reset revokes every session |
| **auth** | Sessions | 15-minute access JWT + refresh token rotated on every use; replaying an old one revokes the family |
| **auth** | Google / Facebook | The app gets a provider token, the back-end verifies it with the provider itself |
| **users** | Profile tiers | Public, friends-only and private fields filtered by one `viewProfile` function |
| **users** | Music preferences | Genres and artists, used for discovery |
| **friends** | Requests | Send, accept, decline, remove; one row per pair |
| **catalog** | Deezer proxy | Search and track lookup, validated, cached, throttled to the Deezer quota |
| **events** | Track Vote | Suggest, vote, ranked queue computed `ORDER BY votes DESC, createdAt ASC` |
| **events** | Licenses | Everyone, invited only, or inside a radius during a time window |
| **events** | Playback clock | `currentStartedAt` on the server; next track advanced with an optimistic `version` check |
| **playlists** | Live editor | Add / move / remove by entry id, fractional positions, row lock per playlist |
| **playlists** | Conflicts | Operation on a vanished entry → `409` with the current state |
| **devices** | Delegation | Per-device grants to friends, commands relayed over Socket.IO, revoked instantly |
| **realtime** | Rooms | One room per event, playlist, device and user; every message carries a `version` |
| **logs** | Action log | Every REST call and socket command stored with user, platform, device, app version |
| **security** | Hardening | Rate limits, login backoff, helmet, CORS, zod on every input, authorization audit test |
| **mobile** | Remote control | Expo Router screens, TanStack Query cache patched by socket events |
| **mobile** | Settings | Back-end URL editable and tested from the app |
| **loadtest** | Ramp-up | Artillery scenarios mixing HTTP and Socket.IO for the three services |

<br>

</details>

<details>
<summary><strong>Usage Example & Testing</strong></summary>

### Build and run

```bash
cp .env.example .env          # fill in the OAuth client ids
make install                  # npm ci for every workspace
make up                       # postgres + mailpit + api in Docker
make migrate seed             # schema + demo users, events and playlists
make mobile                   # Expo dev server, scan the QR code
```

API on `http://localhost:3000`, interactive docs on `http://localhost:3000/docs`,
captured mails on `http://localhost:8025`.

### A vote, end to end

```bash
$ curl -s -X POST localhost:3000/api/v1/events/$EVENT/tracks/$ENTRY/vote \
       -H "Authorization: Bearer $TOKEN" | jq '.queue[0:2]'
[
  { "entryId": "…", "title": "One More Time", "artist": "Daft Punk", "votes": 7 },
  { "entryId": "…", "title": "Get Lucky",     "artist": "Daft Punk", "votes": 5 }
]
```

Every phone in the event's room receives the same `event:state` with the new
`version` within the same second.

### Concurrency, tested

```bash
make test                     # unit + integration, Postgres in Docker
```

The integration suite fires 50 votes from 50 users at once and checks every
count, 20 identical votes and checks there is one, 30 simultaneous moves on a
playlist and checks no update is lost, and random operation sequences from
several clients (property-based) to check the order is always a valid
permutation.

### Error handling

```bash
$ curl -s localhost:3000/api/v1/events/$PRIVATE_EVENT -H "Authorization: Bearer $STRANGER"
{ "error": { "code": "NOT_FOUND", "message": "Event not found" } }
```

Private resources answer `404` to strangers rather than `403`, so their
existence is not revealed. Errors never carry stack traces.

### Load test

```bash
make loadtest                 # vote · playlist · delegation · mixed → loadtest/reports/*.html
```

Method and results — machine, concurrent users per service, latency
percentiles, bottleneck — are in [`docs/RAMP_UP.md`](docs/RAMP_UP.md).

<br>

</details>

## 🚀 Installation & Structure

<details>
<summary><strong>📥 Setup & Usage</strong></summary>

<br>

### Host requirements

| Tool | Needed for | Notes |
|------|------------|-------|
| Node.js ≥ 20 + npm | Everything | Workspaces install every dependency from `package-lock.json` |
| Docker + Compose | Postgres, Mailpit, API | `make up` |
| `make` | Driving the build | Single entry point |
| Android Studio / Xcode | Development build | Needed for native OAuth and BLE; Expo Go is enough for the rest |
| A phone or emulator | Running the app | Same network as the API, or set its URL in **Settings** |

Nothing is vendored: every library is downloaded by `make install`.

### Make targets

```bash
make install    # npm ci for api, mobile and shared
make up         # docker compose up -d
make down       # docker compose down
make dev        # api in watch mode + Expo
make migrate    # apply Prisma migrations
make seed       # demo data
make test       # all test suites
make lint       # eslint + tsc --noEmit
make docs       # export openapi.json
make mobile     # Expo dev server
make loadtest   # Artillery scenarios
make fclean     # remove containers, volumes, node_modules and builds
```

### Environment

Every variable is listed in `.env.example`; `.env` is git-ignored and the API
refuses to start if a required one is missing.

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection |
| `JWT_SECRET` | Access token signature |
| `SMTP_HOST` / `SMTP_PORT` | Mailpit in development |
| `GOOGLE_CLIENT_IDS` | Accepted audiences for Google id tokens |
| `FACEBOOK_APP_ID` / `FACEBOOK_APP_SECRET` | Facebook token verification |
| `EXPO_PUBLIC_API_URL` | Default back-end URL of the app |

<br>

</details>

<details>
<summary><strong>📁 Project Structure</strong></summary>

<br>

```
music-room/
│
├── README.md                             # Main project documentation
├── Makefile                              # install · up · dev · test · lint · loadtest
├── docker-compose.yml                    # postgres, mailpit, api
├── .env.example                          # Every variable, no secret
├── package.json                          # npm workspaces
│
│
├── packages/
│   └── shared/                           # zod schemas, DTO types, socket event map
│
├── apps/
│   ├── api/
│   │   ├── prisma/                       # schema.prisma, migrations, seed
│   │   ├── src/
│   │   │   ├── app.ts                    # Builds the Fastify instance
│   │   │   ├── server.ts                 # Listens
│   │   │   ├── plugins/                  # auth, rate-limit, swagger, action-log, errors
│   │   │   └── modules/
│   │   │       ├── auth/                 # register, login, refresh, mails, social
│   │   │       ├── users/                # profile tiers, search
│   │   │       ├── friends/              # requests and friendships
│   │   │       ├── catalog/              # Deezer proxy and cache
│   │   │       ├── events/               # Music Track Vote
│   │   │       ├── playlists/            # Music Playlist Editor
│   │   │       ├── devices/              # Music Control Delegation
│   │   │       └── realtime/             # Socket.IO server and rooms
│   │   └── test/                         # Integration and concurrency tests
│   │
│   └── mobile/
│       ├── app/                          # Expo Router screens
│       ├── src/
│       │   ├── api/                      # HTTP client, refresh, device headers
│       │   ├── features/                 # auth, profile, events, playlists, devices
│       │   ├── hooks/                    # useSocket, useRoom, …
│       │   ├── stores/                   # session, settings, player
│       │   └── components/               # Shared UI
│       └── .maestro/                     # End-to-end flows
│
└── loadtest/
    ├── seed.ts                           # Users, tokens, events, playlists
    ├── vote.yml                          # Track Vote under load
    ├── playlist.yml                      # Playlist Editor under load
    ├── delegation.yml                    # Control Delegation under load
    └── mixed.yml                         # Realistic mix
```

Every module exposes a service and keeps its tables to itself; `realtime` is the
only module that knows about Socket.IO, and `packages/shared` is the only place
a request or a message shape is defined.

<br>

</details>

<details>
<summary><strong>🧱 Architecture Overview</strong></summary>

<br>

### Pipeline

```
app intent ─> REST (zod) ─> service ─> transaction ─> commit ─> version++ ─> Socket.IO room ─> every client
```

A mutation is always a REST call; once it commits, the new state is broadcast to
the room. One write path to validate, rate limit, log and document.

### Votes — nothing to lock

```
Vote (eventTrackId, userId)  PRIMARY KEY
   same user, same track, twice  ──> second insert is a no-op
   different users / tracks       ──> independent inserts
queue = ORDER BY count(votes) DESC, createdAt ASC     (computed, never stored)
```

### Playlists — one row per move

```
 a0        a1        a2              move "C" between "A" and "B"
 A ─────── B ─────── C        ==>    A ── C ── B
                                     a0  a0V  a1     (only C's row changes)

 BEGIN; SELECT … FROM playlist WHERE id = $1 FOR UPDATE;  -- serialise one playlist
        read neighbours by id; write one row; version++;
 COMMIT; broadcast playlist:state
```

Operations name entries by id. An index computed on a stale screen means
nothing, an id does; an entry that vanished meanwhile gives `409` with the
current state, and the client replaces its optimistic copy.

### Sessions

```
login ──> access (15 min) + refresh R1
refresh(R1) ──> access + R2      R1 marked replaced
refresh(R1) again ──> whole family revoked   (someone stole a token)
```

<br>

</details>

<details>
<summary><strong>✨ Bonus</strong></summary>

<br>

Started only once the mandatory part is complete.

| Bonus | What it does |
|-------|--------------|
| **Web responsive** | The same Expo code exported to the web, list + detail side by side on large screens |
| **Free vs Paid** | Two offers; the Playlist Editor and location licenses need the paid one, one back-end guard decides |
| **Offline mode** | Cached events and playlists, downloaded previews, playlist edits queued in an outbox and replayed idempotently |
| **iBeacon** | A beacon at a party pushes the event's details to phones that come close |
| **QR join** | Scan a code to enter an event or a playlist |
| **Synced playback** | Every phone in an event plays the current track at the same position |
| **Live reactions** | Emoji floating over the track playing now |
| **Ops dashboard** | Prometheus + Grafana: requests, latency, sockets, votes per second |

<br>

</details>

## 💡 Key Learning Outcomes

- **Client / server design**: an app that only sends intents and renders the
  server's answer, and a server that owns every rule
- **Concurrency in a database**: primary keys as idempotency, computed order
  instead of stored order, row locks with short critical sections, optimistic
  versions
- **Realtime state**: rooms, versioned broadcasts, reconnection and resync
  without trusting that every message arrived
- **Authentication**: password hashing, mail tokens, OAuth token verification on
  the server, refresh rotation and theft detection
- **Authorization**: one function per rule, tested against every role
- **API as a product**: schemas that validate, serialise and document at once
- **Measuring instead of guessing**: load tests, percentiles and a bottleneck
  you can name
- **Working as a team**: shared contracts first, then back-end and mobile in
  parallel, every step reviewed

## ⚙️ Technical Specifications

- **Languages**: TypeScript (strict) everywhere
- **Mobile**: React Native + Expo, Expo Router, TanStack Query, Zustand, expo-audio, expo-secure-store
- **Back-end**: Node.js ≥ 20, Fastify, zod type provider, Socket.IO
- **Database**: PostgreSQL 16 through Prisma; raw SQL only for row locks and partial indexes
- **API**: REST, JSON, `/api/v1`, OpenAPI 3 at `/docs`; errors `{ error: { code, message } }`
- **Auth**: argon2id, JWT access 15 min, refresh 30 days rotated, Google / Facebook verified server-side
- **Music**: Deezer public API, 30 s previews, cached and throttled
- **Logs**: pino + `ActionLog` table (user, platform, device, app version, action, status)
- **Tests**: Vitest, `fastify.inject`, socket.io-client, fast-check, jest-expo, Maestro
- **Load**: Artillery (HTTP + Socket.IO), results in `docs/RAMP_UP.md`
- **CI**: GitHub Actions — lint, typecheck, tests with Postgres, audit, secret scan

## 🔧 Requirements

- Node.js 20 or later and npm
- Docker with Compose
- `make`
- A Google Cloud OAuth client and a Meta app for social login (ids in `.env`)
- An Android or iOS device / emulator; Android Studio or Xcode for the development build
