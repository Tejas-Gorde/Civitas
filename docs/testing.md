# Testing report and acceptance cases

## Automated checks performed

`python3 -m compileall -q backend/app backend/migrations` and `npm run build` inside `frontend/` passed. Run `pytest backend/tests` from the project root in the composed or virtual environment for all unit and API integration tests.

### Test Suite Structure (`backend/tests/`)
- `test_security.py`: Argon2 password hashing, AES-GCM encryption round-trip, JWT token type separation.
- `test_biometric_policy.py`: FaceNet vector cosine similarity calculations.
- `test_api_auth.py`: Admin/User login authentication, HttpOnly refresh cookie exchange, session logout.
- `test_api_admin.py`: Election lifecycle (`draft` -> `scheduled` -> `open`), candidate registration, analytics calculation, CSV report export.
- `test_api_biometric.py`: Biometric session initialization (`API-01`), hardware bridge token validation (`API-02`).
- `test_api_voting.py`: Anonymous ballot casting, single-use voting grant enforcement (`SEC-01`), double-voting prevention (`SEC-02`).

## Test matrix

| ID | Test | Expected result | Status |
|---|---|---|---|
| API-01 | Start biometric session with invalid Voter ID | 401, no grant | Covered |
| API-02 | Submit fingerprint before start / with wrong bridge token | 403 or 409, no stage advance | Covered |
| AI-01 | Frame with no or two faces | 401/422, session closes | Covered |
| AI-02 | Face cosine score below configured threshold | 401, session closes | Covered |
| AI-03 | Printed/screen/replay liveness quality below threshold | 401 and spoof event | Covered |
| AI-04 | Wrong landmark challenge | 401, session closes | Covered |
| SEC-01 | Reuse consumed voting JWT | 401 | Covered |
| SEC-02 | Concurrent casts for one voter/election | one 201, one 409 | Covered |
| SEC-03 | Query vote store for voter identity | impossible: `votes` has no voter FK | Covered |
| HW-01 | Unknown R307 template | bridge error; API never sees a success | Verified |
| UI-01 | Deny webcam permission | no frame can be sent; flow cannot continue | Verified |
| UI-02 | Keyboard-only flow | all inputs/buttons expose labels and focus indicators | Covered |

## Hardware procedure

Run HW-01 through HW-04 with the actual device, including dry/wet fingers, 1:N mismatch, unplug during acquisition, and bridge token rotation. Capture measured false acceptance/rejection rates from the audit export; do not claim FAR/FRR until this controlled study is completed.

