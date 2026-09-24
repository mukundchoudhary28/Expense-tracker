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