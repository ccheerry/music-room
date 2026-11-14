# Security

What the project protects against, how, and what is knowingly left open. Every protection
named here is implemented in the code and covered by a test in `apps/api/test` or
`apps/mobile/test`.

## Model

- Clients are untrusted: the mobile app, anything that speaks HTTP or Socket.IO to the API.
- The API is the only component that reads or writes the database and that talks to Deezer,
  Google, Facebook and the mail server.
- Secrets live in `.env` (git-ignored) and are validated at startup; the API refuses to start
  without them.

## Sessions and credentials

| Item | Value |
|---|---|
| Password hashing | argon2id (library defaults); 8 to 64 characters with a letter and a digit |
| Access token | JWT HS256, 15 minutes, kept in memory by the app |
| Refresh token | 256 random bits, 30 days, stored hashed (SHA-256), rotated on every use |
| Mail tokens | 256 random bits, stored hashed, single use; 24 h (verify), 1 h (reset) |
| Storage on the phone | Refresh token in Keychain / Keystore (`expo-secure-store`) |

## Threats

| Threat | Impact | Protection | Residual risk |
|---|---|---|---|
| Brute force on one account | Account takeover | Login backoff per email: locked after 5 failures in a row, 30 s doubling up to 15 min, also for unknown emails. argon2 makes each guess expensive | An attacker can keep a known email locked (15 min at a time). The counter is in memory: per API instance, reset on restart |
| Credential stuffing (many emails, one source) | Takeover of accounts with reused passwords | Budget per address on login, sign-up, resend and forgot password (`AUTH_RATE_LIMIT_MAX`, 30 per 15 min) | Distributed sources are not stopped; no breached-password check |
| Flooding the API | Slow or unavailable service | Global budget per user, per address when logged out (`RATE_LIMIT_MAX`, 300 per minute); 100 KB body limit; lists paginated (50 per page) or capped (500 rows) | In-memory counters, per instance. No protection below HTTP (SYN floods, slow connections): that belongs to a reverse proxy |
| Session theft (stolen access token) | Acting as the user | 15 minute lifetime; never written to disk by the app | Valid until it expires, even after logout |
| Refresh token replay | Long-lived stolen session | Rotation: a token is spent on use. Presenting a spent token revokes the whole session family. Password reset revokes every session | The thief wins if they use the token before the owner does; the owner is logged out at their next refresh, which exposes the theft |
| Account enumeration | Knowing who has an account | Sign-up, resend and forgot password always answer 204; login answers the same error and costs one argon2 run whether the email exists or not; lockout applies to unknown emails too | Social sign-in answers `ACCOUNT_EXISTS` for an email already registered, after the provider has proved the caller owns it |
| IDOR (asking for somebody else's resource by id) | Reading or changing other users' data | One authorization function per resource (`canView`, `voteRefusal`, `canEdit`, `canControl`, `viewProfile`). Private resources answer 404 to strangers. `security.test.ts` calls every route as a stranger and fails when a new route has no rule | Ids are random UUIDs, not secrets: protection relies on the checks only |
| Stale access (rights removed during a live session) | Still receiving a private event, playlist or remote | Uninviting, making a resource private, revoking or letting a control grant expire removes the user's sockets from the room at once | None known |
| Injection (SQL, NoSQL, header) | Data theft or corruption | Prisma parameterises every query; the one raw query is a tagged template with a bound parameter. zod validates every body, query, param, socket payload and external answer | None known |
| Mass assignment | Setting fields that are not the caller's to set | Every body is a zod `strictObject`: unknown keys are refused; services pick the fields they store | None known |
| Cross-site requests and embedding | A web page acting for a logged-in user | No cookies: the token travels in the `Authorization` header. CORS limited to `CORS_ORIGINS`. Security headers from `@fastify/helmet` (CSP, no framing, no sniffing) | The web build keeps the refresh token in `localStorage`, readable by an XSS in that page |
| Socket flooding | Server or other clients overwhelmed | 20 events per second per socket, then the socket is dropped; 100 KB per message; token checked at the handshake and the socket closed when it expires; state broadcasts coalesced to one per 200 ms per event | Reconnecting gives a new budget; connections are not limited per address |
| Location spoofing | Voting in a location-restricted event from elsewhere | The server checks distance and time window itself; the owner chooses radius and hours | Coordinates come from the client: a modified app or a mock-location setting can lie. Not fixable without trusted hardware |
| Token extraction on a rooted or jailbroken phone | Stolen session | Keychain / Keystore storage; access token in memory only; sessions are per device and can be ended from another device ("My devices") | Root defeats the secure store. No root detection |
| Man in the middle | Reading or changing traffic, stealing tokens | The API is meant to run behind TLS (HTTPS / WSS) terminated by a reverse proxy; the app only needs an `https://` backend address | The development setup is plain HTTP on a local network. No certificate pinning: a user who installs a rogue CA can be intercepted |
| Mail token leakage | Verifying or resetting somebody's account | Tokens are random, hashed at rest, single use (atomic update) and short-lived; a reset revokes all sessions; mails per mailbox limited to 5 per 15 min | Whoever reads the mailbox within the lifetime owns the token |
| Control of somebody's device | Unwanted playback changes | Grants per device, to friends only, optional end date; every command re-checks the grant; ending the friendship revokes them | A granted friend can do whatever the remote allows until revoked |
| Deezer quota exhaustion | Search and playback unavailable for everybody | Search results cached 5 min, tracks stored and refreshed at most every 10 min, local quota of 50 calls per 5 s answering `503 CATALOG_BUSY` beyond it | One busy instance can starve its own users; several instances share Deezer's limit without knowing |
| Information leak through errors | Helping an attacker map the system | Every error is `{ error: { code, message } }`; unexpected errors answer a generic 500 and the detail goes to the log only | None known |
| Secrets in the repository | Compromised keys | `.env` git-ignored, `.env.example` holds no real value; `make audit` fails when a `.env` file is tracked | A secret pasted into another file is not detected by that check |
| Vulnerable dependencies | Known exploits | `make audit` runs `npm audit` at level high on the production dependencies of the API; lockfile committed | Advisories in the Expo build toolchain (development only, not shipped in the app or the API) are reviewed by hand |

## Audit trail

Every HTTP request and socket event is stored in `ActionLog` with the user, device,
platform, device model, app version, action and status. Passwords, tokens and bodies are
never logged.

## Production checklist

- Terminate TLS in front of the API and forward only HTTPS / WSS.
- Set `trustProxy` for that proxy so limits apply to the real client address.
- Use a long random `JWT_SECRET` (`openssl rand -base64 48`); rotate it to log everybody out.
- Set `CORS_ORIGINS` to the real web origins only.
- With several API instances, move the rate-limit, backoff and cache state to Redis.
