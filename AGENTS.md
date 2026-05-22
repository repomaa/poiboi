# poiboi — AGENTS.md

> A POI Explorer for the Pebble smartwatch. Uses the watch compass and GPS to point the user toward nearby OpenStreetMap points of interest.

## Project Architecture

This is a **watchapp** (not a watchface) built for modern Pebble devices using the **Alloy** framework — the Moddable SDK ported to PebbleOS. It runs embedded JavaScript (TypeScript) on the XS engine inside a minimal C bootstrap.

| Layer | Responsibility |
|-------|--------------|
| `src/c/mdbl.c` | C bootstrap. Creates a Pebble Window, starts `moddable_createMachine(NULL)`, then cleans up on exit. |
| `src/embeddedjs/main.ts` | Main Alloy/TypeScript application. Handles UI, sensors, vibrations, and phone communication. |
| `src/embeddedjs/manifest.json` | Moddable manifest declaring modules, includes, and TypeScript compiler options. |
| `package.json` | Pebble app metadata (UUID, display name, target platforms, message keys). |

## Build System

- **Build environment:** [CloudPebble](https://cloudpebble.net/) — the app is compiled in the cloud when code is pushed to the repository. No local build toolchain (`mcconfig`, Moddable SDK) is required for day-to-day development.
- **Manifest:** `src/embeddedjs/manifest.json` (Moddable-style, not to be confused with legacy Pebble `appinfo.json`). CloudPebble reads this to know which modules to include and how to compile TypeScript.
- **TypeScript:** First-class support in Alloy. The `manifest.json` declares `typescript` compiler options that CloudPebble uses during the cloud build.
- **Local editor support:** `tsconfig.json` is gitignored and only for local IDE IntelliSense (e.g., VS Code). It must not affect CloudPebble builds.

## Target Platforms

The app is configured for modern Pebble platforms:

- `emery` — Pebble 2 Duo (monochrome, button-only)
- `gabbro` — Pebble Time 2 (color, buttons + touchscreen)

Pebble Round 2 (`diorite`-class or similar round platform) will also be supported. Round-screen considerations (e.g., clipping to a circular viewport) must be handled in UI code.

## Key Runtime Concepts

### Globals
The Alloy runtime injects globals such as `watch`, `console`, `setTimeout`/`setInterval`, `fetch`, `URL`, `WebSocket`, `localStorage`, and Piu constructors (`Application`, `Label`, `Container`, etc.). See `alloy-runtime` skill.

### `watch` global
- `watch.addEventListener("secondchange", ...)` — fired every second.
- `watch.addEventListener("minutechange" | "hourchange" | "daychange", ...)` — time ticks.
- `watch.addEventListener("connected", ...)` — Bluetooth/connectivity state changes.
- `watch.connected` — `{ app: boolean, pebblekit: boolean }`.
- `watch.light(enable?)` — controls backlight.
- `watch.model` — numeric hardware identifier.

### Sensors & Actuators
- **Compass:** `Compass` class (`pebble/compass`) provides `heading` in degrees via `sample()` or `onSample` callbacks. See `alloy-sensors` skill.
- **Location:** `Location` class (`pebble/location`) provides GPS latitude/longitude. See `alloy-sensors` skill.
- **Vibes:** `Vibes` class (`pebble/vibes`) provides `shortPulse()`, `longPulse()`, `doublePulse()`, and custom `pattern(durations[])`. See `alloy-sensors` skill.
- **Buttons:** `Button` class (`pebble/button`) listens to physical button presses (`back`, `up`, `down`, `select`). See `alloy-sensors` skill.

### Phone Communication
`Message` class (`pebble/message`) sends/receives key-value dictionaries to the Pebble mobile app (PebbleKit JS companion). This is how we:
1. Request POI data from the phone.
2. Receive OSM POI results.
3. Sync the configurable search radius from phone settings.

The companion phone-side JavaScript (or the Pebble mobile app’s built-in JS sandbox) makes the actual HTTPS requests to OSM Overpass API or Nominatim. See `alloy-messaging` skill.

## App Flow (Intended UX)

1. **Launch** → App requests POIs in a configurable radius via `Message` to the phone.
2. **Phone** fetches OSM data and returns a list of POIs with lat/lon + metadata.
3. **Watch** enters "sonar" mode:
   - Reads `Compass` heading and `Location` continuously.
   - Vibrates with an accelerating pattern as the watch heading converges on a POI bearing.
   - Vibration stops when the user holds the watch pointing directly at a POI for **2 seconds**.
4. **Reveal** → App displays the POI info (name, type, distance) on screen.
5. The user can aim at a different POI to trigger another reveal.

### Orientation Handling
When the user extends their arm, the watch could be worn with buttons on either side. The app must account for which physical edge of the watch case is currently pointing forward. On button-only models (Pebble 2 Duo) this means treating the vector from the back button toward the select/up/down edge as the forward vector, or the reverse depending on strap orientation. On touchscreen models, the app may also use the touchscreen for supplemental input. See `pebble-platforms` skill.

## Settings

- **Search radius** is the primary phone-configurable setting (e.g., 50 m – 2 km).
- It is persisted in `localStorage` on the watch and in the phone companion app’s preferences.
- Changes are pushed to the watch via `Message`.

## Relevant Agent Skills

| Skill | What it covers |
|-------|---------------|
| `pebble-hardware` | Physical hardware specs for Pebble 2 Duo, Pebble Time 2, and Pebble Round 2. |
| `pebble-platforms` | Platform differences: screen resolutions, shapes, input methods, orientation, vibration. |
| `alloy-manifest` | `manifest.json` structure, TypeScript compiler options, C bootstrap. |
| `alloy-runtime` | XS engine, injected globals (`watch`, `console`, timers, `localStorage`, `fetch`, etc.). |
| `alloy-sensors` | Sensor/actuator APIs: `Compass`, `Location`, `Vibes`, `Button`. |
| `alloy-messaging` | `Message` class, phone communication, PebbleKit JS companion, settings sync. |
| `alloy-ui` | Piu UI framework, Poco graphics, resource bundling, round-screen UI considerations. |

## External Resources

- [Rebble Developer Docs](https://developer.rebble.io/)
- [Moddable SDK Documentation](https://moddable.com/documentation/)
- [Pebble C API Docs](https://developer.rebble.io/docs/c/)
- [Pebble App Store](https://apps.rebble.io/)
