# Realtime API (Socket.IO)

The REST API is described in `docs/openapi.json` and served at `/docs`. This file covers
what Swagger does not: the Socket.IO channel. Payloads are defined once in
`packages/shared/src` (`realtime.ts`, `events.ts`, `playlists.ts`, `devices.ts`) and imported by
both the API and the app: zod schemas for everything a client sends and for the state
messages, plain types for the three small notices.

## Principles

- **Changes go through REST, broadcasts come through the socket.** The socket never changes
  an event or a playlist; it carries state after a REST call committed. The only
  client-to-server messages are room membership and remote control.
- **State, not deltas.** A broadcast carries the whole state of the resource and its
  `version`. A client keeps the highest version it has seen and drops anything older.
- **Rejoin and reload.** After a reconnection the client joins its rooms again and reloads
  the state from REST, since broadcasts sent while it was away are not replayed.

## Connection

Same host and port as the REST API, default path `/socket.io`, WebSocket transport.

Handshake `auth` object:

| Field | Required | Meaning |
|---|---|---|
| `token` | yes | Access token (the JWT used for REST) |
| `platform` | no | `ios`, `android` or `web` |
| `device` | no | Device model |
| `appVersion` | no | App version |

The three client fields may also be sent as the `X-Platform`, `X-Device` and
`X-App-Version` headers. They are stored with every socket action in the action log.

- A missing, forged or expired token refuses the connection with the error `UNAUTHORIZED`.
- The server closes the socket when its token expires. The client refreshes the token over
  REST and connects again.
- On connection the socket is placed in `user:<userId>` and, when the token belongs to a
  device, in `device:<deviceId>`. These two rooms cannot be joined by request.

## Limits

- 20 client events per second per socket. Beyond it the server emits `error` with
  `RATE_LIMITED` and closes the socket.
- 100 KB per message.

## Acknowledgements and errors

Every client event takes an acknowledgement callback:

```ts
type Ack = { ok: true } | { ok: false; error: { code: string; message: string } };
```

A refused event is also emitted back as `error` with the same `{ code, message }`.

| Code | Meaning |
|---|---|
| `UNAUTHORIZED` | Handshake refused |
| `VALIDATION_ERROR` | The payload does not match its schema |
| `FORBIDDEN` | Not allowed to join that room or control that device |
| `RATE_LIMITED` | Too many events; the socket is closed |
| `INTERNAL_ERROR` | Unexpected failure, detail in the server log only |

## Rooms

| Room | Who may join | What it receives |
|---|---|---|
| `event:<id>` | Whoever can see the event (public, owner or invited) | `event:state`, `event:deleted`, `room:presence` |
| `playlist:<id>` | Whoever can see the playlist (public, owner or member) | `playlist:state`, `playlist:deleted`, `room:presence` |
| `remote:<deviceId>` | The device owner and friends holding a grant that has not expired | `device:status`, `room:presence` |

A user who loses access leaves the room at once, without a message from the client:
invitation or membership withdrawn, resource made private, grant revoked or expired,
friendship ended.

## Client to server

### `room:join` / `room:leave`

```json
{ "kind": "event", "id": "7bae8d33-fb98-466a-aa16-476866475b06" }
```

`kind` is `event`, `playlist` or `remote`; `id` is a UUID. `room:join` answers `FORBIDDEN`
when the user may not see the resource, also when it does not exist.

### `device:command`

Sent by a controller; relayed to the device when the sender owns it or holds a grant.

```json
{ "deviceId": "7cd56655-f024-40f0-ac73-72f7cfb13c85", "action": "next", "trackId": 3135563 }
```

| Field | Meaning |
|---|---|
| `action` | `play`, `pause`, `next`, `prev` or `volume` |
| `trackId` | Optional. The track the controller saw playing. The device ignores a `next` / `prev` meant for another track, so two controllers pressing "next" at once skip one track, not two |
| `value` | Required for `volume`: 0 to 1 |

### `device:status`

Sent by a device about itself only (`deviceId` must be the device of the socket's token),
on every change and every 5 seconds. Relayed to `remote:<deviceId>`.

```json
{ "deviceId": "7cd56655-…", "playing": true, "track": { "id": 3135563, "title": "…" }, "positionMs": 12000, "volume": 0.8 }
```

`track` is a full track object or `null` when nothing is loaded.

## Server to client

| Event | Sent to | Payload |
|---|---|---|
| `room:presence` | The room, on every join and leave | `{ kind, id, count }`: sockets now in the room |
| `event:state` | `event:<id>` | `{ eventId, version, current, queue }` |
| `event:deleted` | `event:<id>` | `{ eventId }` |
| `playlist:state` | `playlist:<id>` | `{ playlistId, version, entries }` |
| `playlist:deleted` | `playlist:<id>` | `{ playlistId }` |
| `device:command` | `device:<deviceId>` | The command plus `from`: the user id of the sender |
| `device:status` | `remote:<deviceId>` | The status sent by the device |
| `device:revoked` | `user:<userId>` | `{ deviceId }`: the user may no longer control that device |
| `error` | The socket | `{ code, message }` |

### `event:state`

```json
{
	"eventId": "7bae8d33-…",
	"version": 7,
	"current": { "entryId": "…", "track": { "id": 136889434, "title": "…", "previewUrl": "https://…" }, "startedAt": "2026-11-14T11:02:23.000Z" },
	"queue": [{ "id": "…", "track": { "id": 136889400, "title": "…" }, "votes": 2, "suggestedBy": { "id": "…", "displayName": "Bob" } }]
}
```

- `queue` is already ranked by the server: votes descending, then oldest suggestion first.
- `current.startedAt` is the server clock: a client plays the 30 second preview from
  `now - startedAt`. The server moves to the next track by itself when the preview ends.
- Broadcasts are coalesced: at most one per event every 200 ms, always carrying the latest
  state.
- Which entries the user voted for is personal and not broadcast: it comes from
  `GET /events/:id/state` and from the answer of each vote call (`myVotes`).

### `playlist:state`

```json
{
	"playlistId": "2c05c603-…",
	"version": 20,
	"entries": [{ "id": "…", "track": { "id": 3135563, "title": "…" }, "position": "a0", "addedBy": { "id": "…", "displayName": "Alice" } }]
}
```

`entries` are in order. `position` is the stored sort key and needs no interpretation by
clients. A REST edit that lost a race answers `409 STALE` with this same state in its body.

A track object is `{ id, title, artist, album, coverUrl, previewUrl, durationSec }`.
Preview links expire a few minutes after they are issued: the one of `event:state.current`
is refreshed by the server when the track starts; for anything else, ask
`GET /tracks/:deezerId` right before playing.
