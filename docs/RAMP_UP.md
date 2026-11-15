# Ramp-up

How many users the three services support at the same time, how it was measured, on which
machine, and what limits it.

## Machine

Everything ran on one machine: the API, the database and the load generator.

| Item | Value |
|---|---|
| Type | On premise, a laptop on mains power |
| CPU | Intel Core i5-13500H, 16 threads |
| RAM | 15 GiB |
| OS | Linux 6.18 (x86_64), Docker 29.9 |
| API | One Node.js 22 process in a container (`make up`, `NODE_ENV=production`, built JavaScript) |
| Database | PostgreSQL 16.15 in a container, default settings (`max_connections` 100, `shared_buffers` 128 MB) |
| Connection pool | 10 connections from the API to PostgreSQL |
| Load generator | Artillery 2.0.34 on Node.js 26, same machine |

The load generator shares the CPU with the server, so the figures are a lower bound of what
the same server would do with the load coming from elsewhere.

## Method

- `make loadtest` runs one Artillery scenario per service plus a mixed one
  (`loadtest/*.yml`). Before each scenario it writes 2000 users into the database, each with a
  device, an access token, a friend and a control grant, plus one event with 40 queued tracks
  and one playlist with 40 entries. It removes them at the end.
- Every virtual user opens a Socket.IO connection with their own token, joins a room and
  then acts through the REST API or the socket, like the app does.
- Phases: 20 s warm-up at 2 new users per second, 90 s ramp up to the target rate, 40 s at
  the target rate. `LOADTEST_RATE` sets the target (`make loadtest LOADTEST_RATE=12`).
- A user stays about 32 s, so the number of users connected at the same time at the plateau
  is about `rate x 32`.
- A run passes when the 95th percentile of the response time stays under 500 ms and fewer
  than 1 % of the users fail. The rate was raised run after run until a run failed.
- The scenarios put every user in the **same** event or the **same** playlist. This is the
  worst case: all the load meets on one row lock and one broadcast room. Users spread over
  many events and playlists cost less per user.
- During each run, CPU and memory of both containers were sampled with `docker stats` and the
  open database connections with `pg_stat_activity`.
- The Deezer catalog is not part of the measure: tracks are written by the seed, and the
  mixed scenario searches five fixed queries that the API cache answers.

| Scenario | What a user does |
|---|---|
| `vote.yml` | Joins the event room, reads the state, then 8 times: vote for a random track, wait 2 s, remove the vote, wait 2 s |
| `playlist.yml` | Joins the playlist room, reads the entries, then 5 times: add a track, move it to the top, remove it, 2 s apart |
| `delegation.yml` | Lists the devices they can control, joins the remote of a friend's device, then 8 times: send a command, report their own device status, 2 s apart |
| `mixed.yml` | Profile, event list, playlist list, a search, friends, then 4 times: a vote, a playlist add and remove, a remote command |

## Results

Response times in milliseconds. "Users at once" is the plateau, `rate x session length`.

### Music Track Vote (one event)

| New users / s | Users at once | Requests / s | p50 | p95 | p99 | API CPU | DB CPU | Result |
|---|---|---|---|---|---|---|---|---|
| 4 | 130 | 68 | 19 | 36 | 51 | 45 % | 42 % | pass |
| 8 | 260 | 144 | 22 | 54 | 78 | 69 % | 63 % | pass |
| 12 | 400 | 213 | 25 | 76 | 111 | 92 % | 86 % | pass |
| 20 | 660 | 246 | 1224 | 3906 | 5379 | 108 % | 102 % | fail |

**About 400 users voting at the same time in one event.** Each of them votes every 2 s, which
is far more than people do at a party: the same server follows several times more people who
mostly watch the queue.

### Music Playlist Editor (one playlist)

| New users / s | Users at once | Requests / s | p50 | p95 | p99 | API CPU | DB CPU | Result |
|---|---|---|---|---|---|---|---|---|
| 4 | 125 | 66 | 26 | 89 | 215 | 69 % | 32 % | pass |
| 8 | 250 | 71 | 2725 | 6187 | 7710 | 93 % | 35 % | fail |

**About 125 users editing the same playlist at the same time**, one edit every 2 s each.
Edits of one playlist are applied one after the other, so its throughput is capped by the
time of one edit (about 70 edits per second here), whatever the number of users.

### Music Control Delegation

Response time is the acknowledgement of a socket message by the server, after the grant
check and the relay.

| New users / s | Users at once | Messages / s | Ack p95 | API CPU | DB CPU | API memory | Result |
|---|---|---|---|---|---|---|---|
| 40 | 1300 | 709 | 0.3 | 81 % | 60 % | 340 MB | pass |
| 80 | 2600 | 1372 | 0.3 | 104 % | 103 % | 948 MB | pass |
| 160 | 5300 | 2718 | 0.3 | above 100 % | 86 % | 948 MB | pass |
| 320 | 10000 | - | - | - | - | 4 GB | process out of memory |

**About 5000 users controlling a device at the same time**, each sending a command and a
status report every 4 s.

### Mixed use

| New users / s | Users at once | Requests / s | p50 | p95 | p99 | API CPU | DB CPU | Result |
|---|---|---|---|---|---|---|---|---|
| 5 | 125 | 86 | 15 | 47 | 97 | 49 % | 31 % | pass |
| 10 | 250 | 178 | 16 | 97 | 202 | 94 % | 61 % | pass |
| 15 | 375 | 199 | 93 | 2618 | - | 105 % | 80 % | fail |

**About 250 users in a continuous session** made of browsing, searching and the three
services.

## Bottleneck

The API process. Node.js runs the application on one thread, and every failing run shows
that process at 100 % of one core while memory, the 10 database connections and the other
15 hardware threads are not exhausted. PostgreSQL comes second: it reaches 60 to 100 % of a
core at the same moment, because one vote costs about six queries (permission, entry, vote,
version, the ranked queue, the caller's votes) and returns the whole state.

The server holds about 200 to 250 requests per second, whatever the scenario. The number of
users that represents depends on how often each one acts.

## What the measure changed

Three weaknesses appeared under load and were fixed. Only the first two have a measure
after the fix.

| Problem found | Before | Change | After |
|---|---|---|---|
| Playlist edits waiting for the row lock each held a database connection; with 10 of them waiting, every other request failed | At 8 new users / s: 656 answers `500` | Edits of one playlist wait their turn inside the API process and take a connection only when it is their turn; a saturated database now answers `503` with `Retry-After` | Same load: no `500`; the response time is still above the limit, since the edits remain sequential |
| Every action started its own insert into the action log; under a flood of socket messages the pending inserts piled up in memory | At 320 new users / s: 4 GB of heap, process killed | The action log is written in batches from a bounded buffer; beyond it rows are dropped and counted | Same load: the process stays up under 1 GB; about 100 000 log rows dropped per run and reported in the server log |
| The same search arriving many times at once called Deezer once per request, reaching Deezer's quota | At 15 new users / s in the mixed run: 820 answers `503`, 133 answers `502` | Identical searches in flight share one call | Covered by a test, not measured again |

The vote, playlist and mixed tables above were measured before the action-log change. It
removes one insert per request and was not measured again on these three scenarios.

## Consistency with the hardware

One laptop core serves a few hundred very active users of one room, or a few thousand
connected users who act now and then. That matches the scale given as a reference for this
kind of machine: thousands of users for a low-end server, far fewer on smaller hardware.

## Scaling path

1. **Several API processes** behind a load balancer use the idle cores. Requirements already
   identified in the code: the Socket.IO Redis adapter for broadcasts across processes, and
   Redis for the state now kept in memory (rate limits, login backoff, catalog cache,
   playback timers).
2. **A larger connection pool or PgBouncer** once several processes share the database.
3. **Cheaper votes**: return and broadcast only what changed instead of the whole queue.
4. **A read replica** for the discovery lists and searches.

## Reproducing

```bash
make install up                  # API, PostgreSQL and Mailpit in Docker
make loadtest LOADTEST_RATE=12   # the four scenarios, reports in loadtest/reports/*.json
```

Each report holds the response time percentiles, the request rates and the result of the two
pass criteria.
