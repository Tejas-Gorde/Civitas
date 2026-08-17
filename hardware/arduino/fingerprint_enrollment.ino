#include <Adafruit_Fingerprint.h>
#include <SoftwareSerial.h>

// Arduino UNO: sensor TX -> pin 2, sensor RX -> pin 3. Use a regulated external 5V supply.
SoftwareSerial sensorSerial(2, 3);
Adafruit_Fingerprint finger = Adafruit_Fingerprint(&sensorSerial);

uint8_t enrollFingerprint(uint16_t id) {
  Serial.println("Place finger");
  while (finger.getImage() != FINGERPRINT_OK) delay(50);
  if (finger.image2Tz(1) != FINGERPRINT_OK) return 1;
  Serial.println("Remove finger"); delay(1500);
  Serial.println("Place same finger again");
  while (finger.getImage() != FINGERPRINT_OK) delay(50);
  if (finger.image2Tz(2) != FINGERPRINT_OK) return 2;
  if (finger.createModel() != FINGERPRINT_OK) return 3;
  if (finger.storeModel(id) != FINGERPRINT_OK) return 4;
  Serial.print("ENROLLED:"); Serial.println(id);
  return 0;
}

void setup() {
  Serial.begin(115200); sensorSerial.begin(57600); finger.begin(57600);
  if (!finger.verifyPassword()) { Serial.println("Fingerprint sensor unavailable"); while (true) delay(1000); }
  Serial.println("READY. Send template ID (0-127) over serial.");
}

void loop() {
  if (!Serial.available()) return;
  uint16_t id = Serial.parseInt();
  if (id > 127) { Serial.println("Invalid template ID"); return; }
  uint8_t result = enrollFingerprint(id);
  if (result) { Serial.print("ENROLLMENT_FAILED:"); Serial.println(result); }
}
