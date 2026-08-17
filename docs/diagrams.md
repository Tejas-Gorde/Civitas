# System diagrams

## Class/data responsibilities

```mermaid
classDiagram
  class User {+UUID id +email +role +password_hash}
  class Voter {+voter_id +aadhaar_digest +mobile}
  class AuthSession {+stage +challenge +expires_at +metrics}
  class Election {+state +starts_at +ends_at}
  class Candidate {+party +manifesto}
  class Vote {+receipt_id +cast_at}
  User "1" --> "0..1" Voter
  Voter "1" --> "many" AuthSession
  Election "1" --> "many" Candidate
  Election "1" --> "many" Vote
```

## Use cases

```mermaid
flowchart LR
 V[Voter] --> A[Verify identity]
 V --> B[Cast private ballot]
 A[Administrator] --> C[Register voter/candidate]
 A --> D[Manage election state]
 A --> E[Review audit analytics]
 H[Fingerprint bridge] --> A
```

## Activity and sequence

```mermaid
sequenceDiagram
 participant V as Voter browser
 participant F as Sensor bridge
 participant A as API
 participant D as Database
 V->>A: Start(Voter ID, election)
 A->>D: Create timed auth session
 F->>A: Signed physical sensor result
 V->>A: Live camera frames
 A->>A: FaceNet, liveness, challenge, risk
 A->>V: Single-use voting grant
 V->>A: Candidate + grant
 A->>D: Lock voter status; write anonymous vote; consume grant
 A->>V: Receipt ID
```

## Data-flow diagram

```mermaid
flowchart TD
 C[Browser webcam frame] --> AI[In-memory AI inference]
 S[R307/AS608] --> HB[Authorized bridge] --> API[Authentication API]
 AI --> API
 API --> ES[(Encrypted biometric templates)]
 API --> AS[(Auth/audit session records)]
 API --> VB[(Anonymous vote table)]
```
