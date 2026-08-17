# Installation, User, Admin, and Deployment Guide

## Installation

Copy the root environment template, set unique values, and start the Compose stack as described in the README. The API migration runs before the service is started. Do not use the development fallback encryption key outside a local developer machine.

For the sensor: load `hardware/arduino/fingerprint_enrollment.ino` onto the UNO, enrol a template ID while physically present, record the sensor serial and template ID in the voter registration request, and use `hardware/fingerprint_bridge.py` on the host connected to the device. The bridge reports a match only after `finger_fast_search` from the physical R307/AS608 succeeds.

## Voter guide

1. Choose an open election and enter the assigned Voter ID.
2. Place the enrolled finger on the connected sensor.
3. Allow camera access, remain alone and in good light, then capture the identity and liveness frames.
4. Perform the random movement exactly as shown.
5. Review the candidate selection and confirm once. Store the receipt ID; it does not disclose the selection.

Any failed check terminates the session. Start again rather than attempting to navigate around a failed step.

## Administrator guide

1. Sign in through `/admin` using the issued administrator credentials.
2. Create an election, schedule it, add candidates, then transition it to `open` at the approved time.
3. Enrol voters through `POST /api/v1/admin/voters` in the OpenAPI console or an approved administrative client. This endpoint requires three live webcam frames, physical sensor enrolment information, and identity data.
4. Monitor `/api/v1/admin/analytics`, download the authentication CSV, pause if an incident is active, and only publish after closing.

State progression is strictly `draft → scheduled → open ↔ paused → closed → published`.

## Deployment checklist

- Use HTTPS, HSTS, hardened Nginx configuration, private DB/Redis networks, secrets manager injection, regular encrypted backups, monitoring, and time synchronization.
- Place the fingerprint bridge on a dedicated controlled host; rotate its token if that host is lost.
- Set model weights during image build and validate checksum/licensing. Test exact hardware/camera combinations before opening the election.
- Test recovery from database, bridge, and web-node loss. Create a documented manual exception process that preserves voter privacy.
