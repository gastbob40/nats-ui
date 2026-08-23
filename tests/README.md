# Tests

Three suites, all running against real NATS servers — no mocked broker anywhere.

| Suite | Tool | What it covers |
|---|---|---|
| `tests/unit/` | Vitest (happy-dom) | Pure logic: storage, subject tracker, custom topics, config derivation, hooks, `NatsProvider` state machine (service mocked) |
| `tests/integration/` | Vitest (node) | The exact browser code path — `wsconnect` over WebSocket, raw `$JS.API` requests — against a real server: pub/sub, auth, streams, consumers, KV, monitoring fetchers |
| `tests/e2e/` | Playwright (Chromium) | The app's use cases through the real UI on the production build, verified server-side with a Node NATS client |

## Commands

```bash
pnpm test               # unit + integration
pnpm test:unit
pnpm test:integration
pnpm test:coverage      # enforces thresholds (90% lines/functions, 85% branches)
pnpm test:e2e           # builds, serves via vite preview, runs Playwright

pnpm test:env           # start the NATS test servers (docker compose)
pnpm test:env:down      # stop them
```

## Test environment

`docker/docker-compose.test.yml` starts three throwaway NATS servers (no
volumes — state is wiped on restart):

| Server | Client | Monitor | WebSocket | Auth |
|---|---|---|---|---|
| main | 4222 | 8222 | 9222 | none |
| auth-user | 4223 | 8223 | 9223 | `testuser` / `testpass` |
| auth-token | 4224 | 8224 | 9224 | token `test-token-secret` |

You don't have to start it yourself: the vitest and Playwright global setups
bring the compose stack up when nothing answers on the health ports, and only
tear down what they started. Keeping `pnpm test:env` running makes repeated
local runs instant.

Coverage is scoped to the logic-bearing modules (`services`, `lib`, `hooks`,
`contexts`, `config`); pages are exercised end-to-end by Playwright, whose
coverage is not merged into the vitest report (yet).

Tests share the servers, so anything created on the broker uses `uniq()` names
(see `tests/support/nats-client.ts`) and cleans up after itself.

`tests/manual/` holds the old demo scripts for driving the UI by hand — they
are not part of the automated suites.
