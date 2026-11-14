# End-to-end flows (Maestro)

Five flows that drive the real app against a running stack:

| Flow | What it proves |
|---|---|
| `01-sign-up-verify.yaml` | Sign up, verification mail, link from the mail, first login |
| `02-log-in.yaml` | Login with a seeded account, logout |
| `03-vote-in-event.yaml` | An invited user suggests tracks and votes in an event |
| `04-edit-playlist.yaml` | Create a playlist, add, move and remove tracks |
| `05-delegate-control.yaml` | Grant control of a device, use the remote, revoke |

## Running

```bash
make up seed                                  # API, Postgres, Mailpit, demo accounts
maestro test -e APP_ID=<application id> apps/mobile/.maestro
```

- `APP_ID` is the application id of the installed build (`host.exp.exponent` for Expo Go).
- `LINK_BASE` (default `musicroom://`) must match `APP_LINK_URL` of the API; `MAILPIT_URL`
  (default `http://localhost:8025`) is where the flow reads the verification mail.
- Flows 03 and 04 search Deezer for real.
- The seed data is reused: run `make fclean up seed` to start again from a clean database.
