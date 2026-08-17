"""Runs beside an R307/AS608 connected through USB serial; it never emulates a match."""
import os
import time
import requests
import serial
import adafruit_fingerprint

API_URL = os.environ["API_URL"].rstrip("/") + "/api/v1/biometric/fingerprint"
BRIDGE_TOKEN = os.environ["HARDWARE_BRIDGE_TOKEN"]
SERIAL_PORT = os.getenv("FINGERPRINT_SERIAL_PORT", "/dev/ttyUSB0")
SENSOR_SERIAL = os.environ["FINGERPRINT_SENSOR_SERIAL"]


def sensor() -> adafruit_fingerprint.Adafruit_Fingerprint:
    uart = serial.Serial(SERIAL_PORT, baudrate=57600, timeout=1)
    return adafruit_fingerprint.Adafruit_Fingerprint(uart)


def wait_for_match(finger: adafruit_fingerprint.Adafruit_Fingerprint) -> tuple[int, float]:
    while finger.get_image() != adafruit_fingerprint.OK:
        time.sleep(.1)
    if finger.image_2_tz(1) != adafruit_fingerprint.OK:
        raise RuntimeError("Sensor could not convert fingerprint image")
    if finger.finger_fast_search() != adafruit_fingerprint.OK:
        raise RuntimeError("Fingerprint not recognized by the physical sensor")
    # R307 confidence is device produced; normalize conservatively for API threshold.
    return finger.finger_id, min(100.0, finger.confidence / 2.0)


def submit(session_id: str) -> None:
    fingerprint = sensor()
    template_id, score = wait_for_match(fingerprint)
    response = requests.post(API_URL, json={"session_id": session_id, "sensor_template_id": template_id, "sensor_score": score, "sensor_serial": SENSOR_SERIAL}, headers={"X-Hardware-Token": BRIDGE_TOKEN}, timeout=15)
    response.raise_for_status()
    print(response.json())


if __name__ == "__main__":
    import sys
    if len(sys.argv) != 2: raise SystemExit("Usage: fingerprint_bridge.py <authentication-session-id>")
    submit(sys.argv[1])
