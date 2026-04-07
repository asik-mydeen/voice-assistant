/*
 * Zara Voice Assistant - ESP32-S3 Firmware
 * Push-to-talk voice assistant with LED feedback
 *
 * Hardware:
 *   ESP32-S3 DevKit
 *   INMP441 I2S Mic:    SCK=GPIO4, WS=GPIO5, SD=GPIO6
 *   MAX98357A Speaker:  BCLK=GPIO15, LRC=GPIO16, DIN=GPIO17
 *   Push Button:        GPIO0 (built-in BOOT button) or GPIO38
 *   WS2812 LED Ring:    GPIO48 (8 LEDs)
 *
 * Install libraries via Arduino Library Manager:
 *   - ArduinoJson
 *   - WebSockets (by Markus Sattler)
 *   - Adafruit NeoPixel
 */

#include <WiFi.h>
#include <WebSocketsClient.h>
#include <ArduinoJson.h>
#include <driver/i2s.h>
#include <Adafruit_NeoPixel.h>
#include <base64.h>

// ========== CONFIG ==========
const char* WIFI_SSID     = "YOUR_WIFI_SSID";
const char* WIFI_PASS     = "YOUR_WIFI_PASS";
const char* SERVER_HOST   = "voice.asikmydeen.com";
const int   SERVER_PORT   = 443;
const bool  SERVER_SSL    = true;
const char* DEVICE_TOKEN  = "YOUR_DEVICE_TOKEN";  // Same as MCP_AUTH_TOKEN
const char* SPEAKER_NAME  = "Asik";

// ========== PINS ==========
#define BUTTON_PIN    0       // BOOT button on most ESP32-S3 boards
#define LED_PIN       48      // WS2812 data pin
#define LED_COUNT     8

// I2S Microphone (INMP441)
#define I2S_MIC_PORT  I2S_NUM_0
#define I2S_MIC_SCK   4
#define I2S_MIC_WS    5
#define I2S_MIC_SD    6

// I2S Speaker (MAX98357A)
#define I2S_SPK_PORT  I2S_NUM_1
#define I2S_SPK_BCLK  15
#define I2S_SPK_LRC   16
#define I2S_SPK_DIN   17

// Audio config (OpenAI Realtime uses 24kHz 16-bit mono PCM)
#define SAMPLE_RATE   24000
#define AUDIO_BUFFER  1024

// ========== STATE ==========
enum State { IDLE, CONNECTING, LISTENING, THINKING, SPEAKING, ERROR_STATE };
State currentState = IDLE;
bool buttonPressed = false;
bool isConnected = false;

WebSocketsClient ws;
Adafruit_NeoPixel leds(LED_COUNT, LED_PIN, NEO_GRB + NEO_KHZ800);

int16_t micBuffer[AUDIO_BUFFER];
uint8_t spkBuffer[AUDIO_BUFFER * 2];
int spkBufferLen = 0;

// ========== LED COLORS ==========
uint32_t colorIdle     = leds.Color(20, 20, 60);     // dim indigo
uint32_t colorConnect  = leds.Color(60, 40, 120);    // purple
uint32_t colorListen   = leds.Color(0, 120, 100);    // cyan/teal
uint32_t colorThink    = leds.Color(120, 80, 0);     // amber
uint32_t colorSpeak    = leds.Color(80, 40, 140);    // violet
uint32_t colorError    = leds.Color(120, 0, 0);      // red

// ========== SETUP ==========
void setup() {
  Serial.begin(115200);
  Serial.println("\n=== Zara ESP32-S3 ===");

  // Button
  pinMode(BUTTON_PIN, INPUT_PULLUP);

  // LEDs
  leds.begin();
  leds.setBrightness(40);
  setLeds(colorIdle);

  // WiFi
  Serial.printf("Connecting to %s...\n", WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.printf("\nWiFi connected! IP: %s\n", WiFi.localIP().toString().c_str());

  // I2S Microphone
  setupMic();

  // I2S Speaker
  setupSpeaker();

  Serial.println("Ready! Press button to talk.");
}

void setupMic() {
  i2s_config_t mic_config = {
    .mode = (i2s_mode_t)(I2S_MODE_MASTER | I2S_MODE_RX),
    .sample_rate = SAMPLE_RATE,
    .bits_per_sample = I2S_BITS_PER_SAMPLE_16BIT,
    .channel_format = I2S_CHANNEL_FMT_ONLY_LEFT,
    .communication_format = I2S_COMM_FORMAT_STAND_I2S,
    .intr_alloc_flags = ESP_INTR_FLAG_LEVEL1,
    .dma_buf_count = 4,
    .dma_buf_len = AUDIO_BUFFER,
    .use_apll = false,
    .tx_desc_auto_clear = false,
    .fixed_mclk = 0,
  };
  i2s_pin_config_t mic_pins = {
    .bck_io_num = I2S_MIC_SCK,
    .ws_io_num = I2S_MIC_WS,
    .data_out_num = I2S_PIN_NO_CHANGE,
    .data_in_num = I2S_MIC_SD,
  };
  i2s_driver_install(I2S_MIC_PORT, &mic_config, 0, NULL);
  i2s_set_pin(I2S_MIC_PORT, &mic_pins);
}

void setupSpeaker() {
  i2s_config_t spk_config = {
    .mode = (i2s_mode_t)(I2S_MODE_MASTER | I2S_MODE_TX),
    .sample_rate = SAMPLE_RATE,
    .bits_per_sample = I2S_BITS_PER_SAMPLE_16BIT,
    .channel_format = I2S_CHANNEL_FMT_ONLY_LEFT,
    .communication_format = I2S_COMM_FORMAT_STAND_I2S,
    .intr_alloc_flags = ESP_INTR_FLAG_LEVEL1,
    .dma_buf_count = 8,
    .dma_buf_len = AUDIO_BUFFER,
    .use_apll = false,
    .tx_desc_auto_clear = true,
    .fixed_mclk = 0,
  };
  i2s_pin_config_t spk_pins = {
    .bck_io_num = I2S_SPK_BCLK,
    .ws_io_num = I2S_SPK_LRC,
    .data_out_num = I2S_SPK_DIN,
    .data_in_num = I2S_PIN_NO_CHANGE,
  };
  i2s_driver_install(I2S_SPK_PORT, &spk_config, 0, NULL);
  i2s_set_pin(I2S_SPK_PORT, &spk_pins);
}

// ========== LED CONTROL ==========
void setLeds(uint32_t color) {
  for (int i = 0; i < LED_COUNT; i++) leds.setPixelColor(i, color);
  leds.show();
}

void pulseLeds(uint32_t color, int speed) {
  static int brightness = 40;
  static int dir = 1;
  brightness += dir * 2;
  if (brightness >= 80 || brightness <= 10) dir = -dir;
  leds.setBrightness(brightness);
  setLeds(color);
}

void spinLeds(uint32_t color) {
  static int pos = 0;
  for (int i = 0; i < LED_COUNT; i++) {
    leds.setPixelColor(i, (i == pos) ? color : leds.Color(5, 5, 15));
  }
  leds.show();
  pos = (pos + 1) % LED_COUNT;
}

// ========== WEBSOCKET ==========
void connectToServer() {
  currentState = CONNECTING;
  setLeds(colorConnect);

  if (SERVER_SSL) {
    ws.beginSSL(SERVER_HOST, SERVER_PORT, "/api/ws");
  } else {
    ws.begin(SERVER_HOST, SERVER_PORT, "/api/ws");
  }
  ws.onEvent(wsEvent);
  ws.setReconnectInterval(5000);
}

void wsEvent(WStype_t type, uint8_t* payload, size_t length) {
  switch (type) {
    case WStype_CONNECTED: {
      Serial.println("WS connected, sending auth...");
      // Send auth message
      StaticJsonDocument<256> doc;
      doc["type"] = "auth";
      doc["token"] = DEVICE_TOKEN;
      doc["speaker"] = SPEAKER_NAME;
      String json;
      serializeJson(doc, json);
      ws.sendTXT(json);
      break;
    }

    case WStype_TEXT: {
      StaticJsonDocument<4096> doc;
      DeserializationError err = deserializeJson(doc, payload, length);
      if (err) { Serial.printf("JSON parse error: %s\n", err.c_str()); return; }

      const char* msgType = doc["type"];
      if (!msgType) return;

      if (strcmp(msgType, "connected") == 0) {
        Serial.println("OpenAI connected! Ready to listen.");
        isConnected = true;
        currentState = LISTENING;
        setLeds(colorListen);
      }
      else if (strcmp(msgType, "session_ready") == 0) {
        Serial.println("Session ready, waiting for OpenAI...");
      }
      else if (strcmp(msgType, "audio") == 0) {
        // Decode base64 audio and play
        const char* b64 = doc["data"];
        if (b64) {
          int len = base64_decode_chars(b64, strlen(b64), (char*)spkBuffer);
          if (len > 0) {
            size_t written;
            i2s_write(I2S_SPK_PORT, spkBuffer, len, &written, portMAX_DELAY);
          }
        }
      }
      else if (strcmp(msgType, "audio_done") == 0) {
        // Playback complete
      }
      else if (strcmp(msgType, "status") == 0) {
        const char* state = doc["state"];
        if (strcmp(state, "listening") == 0) { currentState = LISTENING; setLeds(colorListen); }
        else if (strcmp(state, "thinking") == 0) { currentState = THINKING; setLeds(colorThink); }
        else if (strcmp(state, "speaking") == 0) { currentState = SPEAKING; setLeds(colorSpeak); }
        else if (strcmp(state, "error") == 0) { currentState = ERROR_STATE; setLeds(colorError); }
      }
      else if (strcmp(msgType, "transcript") == 0) {
        Serial.printf("[%s] %s\n", (const char*)doc["role"], (const char*)doc["text"]);
      }
      else if (strcmp(msgType, "error") == 0) {
        Serial.printf("Error: %s\n", (const char*)doc["message"]);
        currentState = ERROR_STATE;
        setLeds(colorError);
      }
      else if (strcmp(msgType, "disconnected") == 0) {
        isConnected = false;
        currentState = IDLE;
        setLeds(colorIdle);
      }
      break;
    }

    case WStype_DISCONNECTED:
      Serial.println("WS disconnected");
      isConnected = false;
      currentState = IDLE;
      setLeds(colorIdle);
      break;

    case WStype_ERROR:
      Serial.println("WS error");
      currentState = ERROR_STATE;
      setLeds(colorError);
      break;

    default: break;
  }
}

// ========== AUDIO STREAMING ==========
void streamMicAudio() {
  size_t bytesRead;
  i2s_read(I2S_MIC_PORT, micBuffer, sizeof(micBuffer), &bytesRead, 10);
  if (bytesRead > 0 && isConnected) {
    // Send raw PCM bytes over WebSocket binary
    ws.sendBIN((uint8_t*)micBuffer, bytesRead);
  }
}

// ========== MAIN LOOP ==========
void loop() {
  ws.loop();

  // Button handling
  bool btn = (digitalRead(BUTTON_PIN) == LOW);

  if (btn && !buttonPressed) {
    // Button just pressed
    buttonPressed = true;
    if (!isConnected) {
      Serial.println("Button pressed - connecting...");
      connectToServer();
    } else {
      Serial.println("Button pressed - disconnecting...");
      ws.sendTXT("{\"type\":\"disconnect\"}");
      ws.disconnect();
      isConnected = false;
      currentState = IDLE;
      setLeds(colorIdle);
    }
  }
  if (!btn && buttonPressed) {
    buttonPressed = false;
  }

  // Stream audio when connected and listening
  if (isConnected && (currentState == LISTENING || currentState == THINKING)) {
    streamMicAudio();
  }

  // LED animations
  static unsigned long lastLed = 0;
  if (millis() - lastLed > 50) {
    lastLed = millis();
    switch (currentState) {
      case CONNECTING: spinLeds(colorConnect); break;
      case THINKING:   pulseLeds(colorThink, 4); break;
      case SPEAKING:   pulseLeds(colorSpeak, 3); break;
      default: break;
    }
  }

  delay(1);  // Yield
}
