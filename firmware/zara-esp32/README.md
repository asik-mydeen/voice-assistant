# Zara ESP32-S3 Voice Assistant

## Hardware Wiring

### INMP441 I2S Microphone
```
INMP441    ESP32-S3
-------    --------
VDD     -> 3.3V
GND     -> GND
SCK     -> GPIO 4
WS      -> GPIO 5
SD      -> GPIO 6
L/R     -> GND (left channel)
```

### MAX98357A I2S Amplifier
```
MAX98357A  ESP32-S3
---------  --------
VIN     -> 3.3V (or 5V for louder)
GND     -> GND
BCLK    -> GPIO 15
LRC     -> GPIO 16
DIN     -> GPIO 17
GAIN    -> (leave unconnected for 9dB, or connect to GND for 3dB)
```

### WS2812 LED Ring (8 LEDs)
```
WS2812     ESP32-S3
------     --------
VCC     -> 3.3V
GND     -> GND
DIN     -> GPIO 48
```

### Push Button
```
Using built-in BOOT button on GPIO 0
Or connect external button between GPIO 38 and GND
```

## Setup

1. Install Arduino IDE or PlatformIO
2. Install ESP32 board support (Espressif ESP32-S3)
3. Install libraries:
   - `ArduinoJson` (by Benoit Blanchon)
   - `WebSockets` (by Markus Sattler)
   - `Adafruit NeoPixel`
4. Open `zara-esp32.ino`
5. Edit the CONFIG section at top:
   ```cpp
   const char* WIFI_SSID    = "YourWiFi";
   const char* WIFI_PASS    = "YourPassword";
   const char* DEVICE_TOKEN = "your-mcp-auth-token";
   const char* SPEAKER_NAME = "Asik";  // Default speaker
   ```
6. Select board: `ESP32-S3 Dev Module`
7. Upload!

## Usage

1. Power on -> LED ring shows dim indigo (idle)
2. Press BOOT button -> connects to Zara backend
3. LED turns cyan = listening, speak naturally
4. LED turns amber = thinking
5. LED turns purple = speaking (audio plays through speaker)
6. Press button again to disconnect

## LED Colors
| State      | Color        |
|------------|-------------|
| Idle       | Dim indigo  |
| Connecting | Purple spin |
| Listening  | Cyan/teal   |
| Thinking   | Amber pulse |
| Speaking   | Violet pulse|
| Error      | Red         |

## Troubleshooting

- **No audio from mic**: Check INMP441 L/R pin is connected to GND
- **No sound from speaker**: Check MAX98357A GAIN pin, try connecting to VIN for louder
- **WiFi issues**: Ensure 2.4GHz network (ESP32 doesn't support 5GHz)
- **WebSocket fails**: Check DEVICE_TOKEN matches MCP_AUTH_TOKEN in Dokploy env vars
- **Audio quality**: Adjust I2S buffer sizes in code if crackling
