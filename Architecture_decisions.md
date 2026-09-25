## ADR-001: Serve frontend and API from a single origin via nginx

**Decision**
nginx is the single public entry point. It serves the built React app and
reverse-proxies requests under `/api/` to the FastAPI backend over the
internal Docker network (`backend:8000`). The frontend calls the API using
relative paths only (`/api/expenses`), so the browser sees one origin.
In local development, the Vite dev server proxy performs the same role.

**Why**
- No CORS configuration needed: all requests are same-origin.
- The backend is not publicly exposed; only nginx's port is open.
- Frontend code is environment-agnostic: no API URLs to configure per
  environment.
- Adding HTTPS later (Stage 2) happens in one place, at the entry point.

**Alternatives considered**
- Frontend and API on separate origins (e.g. `app.example.com` and
  `api.example.com`): requires CORS setup and exposing the backend publicly.

**Trade-offs**
- nginx is a single point of failure for the whole app.
- Frontend and backend are coupled to the same domain; hosting the
  frontend separately (e.g. S3 + CloudFront in Stage 11) will require
  revisiting this decision.


## ADR-002: Host the application on a single EC2 instance with Docker Compose

**Status:** Accepted (Stage 1, v0.2). To be revisited in Stages 6 and 11.

**Context**
The app (nginx + FastAPI + Postgres) already runs locally via Docker Compose.
We need it publicly reachable with minimal setup, low cost, and full
visibility into how it runs.

**Decision**
Run the existing Docker Compose stack on one EC2 instance (Ubuntu 24.04,
t3.micro, ap-south-1). Only port 8080 (nginx) and SSH (restricted to my IP)
are open in the security group. Internal ports (8000, 5432) are bound to
127.0.0.1 on the host. Deployment is manual: `git pull && docker compose up
--build -d`.

**Why**
- Same Compose file runs locally and in production; no platform-specific
  config.
- Full control and visibility: networking, processes and logs are directly
  inspectable over SSH.
- Lowest cost for the whole stack at current (near-zero) traffic.
- Little vendor lock-in; portable to any VM provider.

**Alternatives considered**
- ECS Fargate: no server maintenance, built-in rolling deploys, but more
  concepts and higher base cost. Deferred to Stage 11.
- Lightsail / App Runner: simpler, but hide the infrastructure we want to
  understand first.
- RDS for the database: backups and durability, at extra cost. Deferred to
  Stage 6.

**Consequences / known risks**
- Server maintenance (OS patches, Docker upgrades, disk space) is manual.
- Single point of failure: any instance or AZ outage takes the app down.
- Data durability: Postgres data lives in a Docker volume on the root EBS
  disk. Survives container and instance restarts; lost if the instance is
  terminated. No backups exist.
- Deployments cause brief downtime, build on the production server, and
  have no automated rollback.
- Public IP changes on stop/start (fixed in Stage 2).
- Billed hourly regardless of traffic.


## ADR-003: Expose only nginx publicly; keep backend and database internal

**Status:** Accepted (Stage 1, v0.2). To be revisited in Stage 2 (HTTPS)
and Stage 6 (RDS).

**Context**
The Compose stack publishes three ports on the EC2 host: 8080 (nginx),
8000 (FastAPI) and 5432 (Postgres). Publishing 8000 and 5432 is useful for
local development (Swagger UI, running the backend with uv, inspecting the
database), but on the server these services must not be reachable from the
internet. The database uses a weak, committed password (`app`).

**Decision**
Apply two independent layers of network restriction:

1. **AWS security group** (outside the server):
   - 8080/TCP from anywhere: the only public entry point (nginx)
   - 22/TCP (SSH) from my IP only
   - Everything else denied by default

2. **Host port binding** (on the server): internal services are published
   on the loopback interface only:
   - `127.0.0.1:8000:8000` (backend)
   - `127.0.0.1:5432:5432` (database)

nginx reaches the backend, and the backend reaches Postgres, over the
internal Docker network by service name (`backend:8000`, `db:5432`),
which never touches the host's public interface.

**Why**
- Defense in depth: a mistake in one layer (e.g. an overly broad security
  group rule) does not expose the database or backend on its own.
- Minimal attack surface: the internet can only reach nginx.
- Local development is unaffected: `localhost:8000/docs` and
  `localhost:5432` still work on a laptop.
- Makes the weak dev database password acceptable for now, since it is
  unreachable from outside the host.

**Alternatives considered**
- Security group only: simpler, but a single misconfiguration would expose
  Postgres with a known password.
- Remove the 8000 and 5432 port mappings entirely: most locked down, but
  breaks local dev workflows. Could be done later with a separate
  production Compose override file.

**Consequences / known risks**
- Port 8080 serves plain HTTP: traffic is unencrypted (fixed in Stage 2).
- SSH access depends on my current IP; a changed IP requires updating the
  security group rule.
- The database password is still committed to the repository. Acceptable
  only while the database is unreachable; must move to a secret store
  before the database is exposed to other hosts (Stage 7).
- Anyone with SSH access to the server can reach all services.


## ADR-004: Terminate TLS at a Caddy reverse proxy

**Status:** Accepted (Stage 2, v0.3). Updates ADR-003 (public entry point
moves from nginx on 8080 to Caddy on 80/443).

**Context**
The app was served over plain HTTP on `http://<ip>:8080`: traffic was
unencrypted, the address changed whenever the instance was stopped, and
there was no domain name. We need a stable, human-readable address served
over HTTPS with a valid certificate, without adding manual certificate
management.

Supporting changes made in this stage:
- An Elastic IP is attached to the instance so its public address is stable.
- A learning domain was purchased (1-year, auto-renew off). DNS is hosted at
  the registrar with an A record `expenses` → Elastic IP, because Route 53 is
  not available on the AWS Free plan.

**Decision**
Add Caddy as the single public entry point in front of nginx:
- Caddy listens on 80 and 443, obtains and renews certificates from
  Let's Encrypt automatically, redirects HTTP to HTTPS, and reverse-proxies
  to `frontend:80` over the internal Docker network.
- nginx is unchanged: it still serves the React build and proxies `/api/`
  to the backend.
- Caddy runs only in production, defined in a separate override file
  (`docker-compose.prod.yml`). The base `docker-compose.yml` stays identical
  across laptop and server.
- The domain is supplied via a git-ignored `.env` file on the server
  (`DOMAIN=...`), not hardcoded in the repository.
- The frontend port is now bound to `127.0.0.1:8080`, and port 8080 is
  removed from the security group. Public ports: 22 (my IP), 80, 443.
- Certificates persist in the `caddy_data` volume.

**Why**
- Automatic HTTPS with a two-line config; no Certbot, cron jobs or manual
  renewals.
- TLS terminates at one place, so the rest of the stack needs no changes.
- Traffic from Caddy to nginx never leaves the host (internal Docker
  network), so plain HTTP behind the proxy is acceptable.
- The override file prevents Caddy from running on a laptop, where it would
  fail certificate validation and risk Let's Encrypt rate limits.

**Alternatives considered**
- nginx + Certbot: widely used, but requires separate certificate tooling,
  renewal scheduling and more configuration.
- AWS Application Load Balancer + ACM certificate: managed, free
  certificates, but adds hourly load balancer cost and complexity.
  Revisit in Stage 11 (ECS Fargate).
- Route 53 for DNS: unavailable on the Free plan; registrar DNS is
  sufficient for a single A record.

**Consequences / known risks**
- Two proxies in the request path (Caddy → nginx) add a small amount of
  complexity; they could be merged later.
- Certificate renewal depends on port 80 (or 443) staying reachable and DNS
  continuing to point at the Elastic IP. A failed renewal is not detected:
  there is no expiry monitoring, and Let's Encrypt no longer sends expiry
  emails (addressed in Stage 8).
- Losing the `caddy_data` volume forces certificate re-issuance and could
  hit Let's Encrypt rate limits.
- Plain HTTP between Caddy and nginx would be unacceptable if they ran on
  separate hosts, or under policies requiring encryption in transit
  everywhere.
- The Elastic IP incurs an hourly charge and must be released when the
  project is torn down.
- The learning domain expires in one year; any links shared using it will
  break then.


## ADR-005: Continuous integration with GitHub Actions and a protected main branch

**Status:** Accepted (Stage 3, v0.4).

**Context**
Changes were pushed directly to `main` with no automated checks. Nothing
guaranteed that code was tested, consistently formatted, or that the
Docker images still built. Bugs could reach the server unnoticed, and
quality depended entirely on remembering to check manually.

**Decision**
Every change reaches `main` through a pull request that must pass CI.

*Backend tests*
- pytest with FastAPI's `TestClient` (using `httpx2`; `httpx` triggers a
  Starlette deprecation warning).
- Tests run against a real PostgreSQL 17 database, never SQLite or mocks.
- Tests use a dedicated `expenses_test` database, never the development
  database. The table is truncated before each test so tests are
  independent of each other.
- Tests cover both accepted input and rejected input (negative/zero
  amounts, empty descriptions, invalid or missing dates).
- Dev tools (pytest, httpx2, ruff) are uv dev dependencies and are excluded
  from the production image via `uv sync --no-dev`.

*Linting and formatting*
- ruff for linting and formatting, including the `B` (bugbear) and `DTZ`
  (timezone) rule sets. CI runs `ruff format --check`, so unformatted code
  fails the build.

*CI pipeline* (`.github/workflows/ci.yml`, on every PR and push to `main`)
- `backend`: install from `uv.lock` (`--frozen`), lint, format check, tests,
  with a PostgreSQL service container.
- `frontend`: `npm ci` and `npm run build`.
- `docker`: builds all images; runs only if both jobs above pass.

*Branch protection on `main`*
- Pull request required; `backend`, `frontend` and `docker` checks must
  pass; force pushes blocked; direct pushes rejected.

*Local development*
- Docker's Postgres is published on `127.0.0.1:5433` because a Windows
  PostgreSQL installation occupies 5432. Tests connect via `127.0.0.1`
  (avoiding IPv6 `localhost` resolution issues on Windows) with a 5-second
  connection timeout so failures surface as errors rather than hangs.
- CI is unaffected: it uses its own Postgres on 5432 and sets
  `DATABASE_URL` explicitly.

**Why**
- Every change is checked the same way, automatically, before it can merge.
- Testing against real Postgres catches behaviour that SQLite or mocks
  would hide (e.g. `Numeric` precision, SQL dialect differences).
- Parallel jobs keep CI fast; the Docker job ensures the deployable
  artifact still builds.
-