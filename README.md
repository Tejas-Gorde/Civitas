# Civitas — AI-Enhanced Secure Digital Voting

Production-oriented, multimodal voting software using a live laptop webcam, an external R307/AS608 fingerprint sensor, FaceNet/RetinaFace verification, MediaPipe landmark liveness/challenge checks, encrypted biometric templates, and anonymous ballots.

Read [the system architecture](docs/architecture.md) before deploying. This repository does not fabricate a biometric match: a fingerprint result is accepted only from the authorized sensor bridge, and all face captures run real local model inference.

## Quick start

1. Install Docker Desktop, connect your fingerprint sensor bridge host, and copy `.env.example` to `.env`.
2. Generate secrets. `BIOMETRIC_ENCRYPTION_KEY` must be a base64 encoding of 32 random bytes; use distinct long random values for all remaining secrets.
3. Change all example passwords and set `CORS_ORIGINS`, `NEXT_PUBLIC_API_URL`, and `COOKIE_SECURE` for your TLS domain.
4. Run `docker compose up --build`.
5. Open `http://localhost`, admin analytics at `/admin`, and the API contract at `http://localhost:8000/docs`.
6. On the USB bridge host, install `hardware/requirements.txt`, set the hardware variables from `.env`, then run `python fingerprint_bridge.py AUTHENTICATION_SESSION_ID` when the voter is at the sensor.

The initial admin account is created only if `INITIAL_ADMIN_EMAIL` and `INITIAL_ADMIN_PASSWORD` are supplied. Remove the bootstrap password from the deployment environment after creating a managed administrator.

## Important deployment controls

- Terminate TLS before exposing the system. Set `COOKIE_SECURE=true` and restrict `CORS_ORIGINS` to the web origin.
- Never run PostgreSQL or Redis on the public network. Back up PostgreSQL encrypted, restrict access, and rotate the biometric encryption key through a planned re-encryption process.
- Keep the sensor bridge on a controlled network. Its bearer token is a hardware credential, not a browser credential.
- FaceNet/RetinaFace model packages download their weights on first use. Build a reviewed image cache and pin the reviewed model artefacts before an offline or regulated deployment.
- Anti-spoof performance must be calibrated on the population, cameras, lighting, and attack types used. Run the supplied test plan and an independent security review before a binding election.

## Project map

| Directory | Purpose |
|---|---|
| `frontend/` | Next.js TypeScript UI with live camera capture and API clients |
| `backend/` | FastAPI services, SQLAlchemy data layer, Alembic migration |
| `hardware/` | R307/AS608 Python bridge and Arduino enrollment sketch |
| `deploy/` | Nginx reverse-proxy configuration |
| `docs/` | architecture, diagrams, operator guides, tests |

## API summary

- `POST /api/v1/auth/login` – administrator session with HttpOnly refresh cookie.
- `POST /api/v1/admin/voters`, `/elections`, `/elections/{id}/candidates` – protected enrolment and management.
- `POST /api/v1/biometric/start → fingerprint → face → liveness → challenge → risk` – ordered, fail-closed verification.
- `POST /api/v1/voting/cast` – one anonymous ballot, protected by an unspent three-minute grant.

Full request/response definitions are live at `/docs`; [API design](docs/architecture.md#api-design) defines the boundaries.

## Verification

Run Python syntax checks with `python3 -m compileall -q backend/app backend/migrations`. After installing frontend dependencies, run `npm run build` inside `frontend`. See [testing.md](docs/testing.md) for API, security, UI, AI, and hardware test cases.

## Legal and ethical use

Biometrics and voting are high-risk contexts. Do not deploy for a legal election without statutory authorization, independent red-team testing, accessibility accommodations, privacy impact assessment, retention/deletion policy, incident response, and observable paper/audit procedures required by the relevant jurisdiction.
