# pebble-platforms

> Platform differences across Pebble 2 Duo, Pebble Time 2, and Pebble Round 2: screen resolutions, shapes, input methods, orientation handling, and vibration considerations for developers.

## Screen Sizes

| Model | Platform | Resolution | Color | Shape |
|-------|----------|-----------|-------|-------|
| Pebble 2 Duo | `emery` | 144 × 168 | Monochrome (1-bit) | Rectangular |
| Pebble Time 2 | `gabbro` | 200 × 228 | 64-color (6-bit) | Rectangular |
| Pebble Round 2 | `diorite` (likely) | 260 × 260 | Color | Circular |

- UI must scale or adapt to three distinct resolutions and two shapes.
- On round screens, clip content to a circular viewport and avoid placing critical text near the extreme edges.
- On Pebble Time 2, legacy watch faces designed for older resolutions may show a border until updated.

## Input Differences

| Model | Buttons | Touchscreen |
|-------|---------|-------------|
| Pebble 2 Duo | 4 (back, up, down, select) | No |
| Pebble Time 2 | 4 + touch | Yes |
| Pebble Round 2 | 4 + touch | Yes |

- **Pebble 2 Duo:** Buttons only. The app must rely entirely on back/up/down/select for navigation and action.
- **Pebble Time 2 & Round 2:** Buttons + touchscreen. Touch can be used for quick actions (e.g., tapping a POI card to dismiss), but the primary interaction should remain button-friendly because users often operate Pebble watches without looking.

## Sensors Available to Apps

- **Compass** (`pebble/compass`): Heading in degrees. Available on all three models.
- **Location** (`pebble/location`): GPS lat/lon, accuracy, altitude, heading, speed. Requires paired phone for GPS on PebbleOS (watch does not have standalone GPS).
- **Vibes** (`pebble/vibes`): Custom patterns, short/long/double pulses. All models support this.

## Button Orientation

When a user extends their arm to point the watch at a POI, the "forward" edge depends on strap orientation:
- If the buttons are on the right side (default for right-handed wear on the left wrist), the forward edge is the left side of the case (back button side).
- If worn on the right wrist with buttons on the left, the forward edge flips.
- The app should ideally allow the user to configure which edge is "forward" or auto-detect based on typical usage.
- On button-only models, the vector from the back button toward the select/up/down edge is the primary directional reference.

## Vibrations

- The new motor is stronger and quieter than the original Pebble 2 motor.
- Developers should use `Vibes.pattern(durations[])` for custom sonar-like feedback.
- Be mindful that extended vibration drains battery, even though battery life is generous.

## Platform-Specific UX Notes

- **Monochrome (`emery`):** Use high-contrast black/white designs. Anti-aliasing is not available.
- **Color (`gabbro`, `diorite`):** 64-color palette. Use color sparingly for status indicators and highlights.
- **Round (`diorite`):** Center the most important information. Avoid corners. Use `watch.addEventListener("resize", ...)` or Piu's round clipping to adapt layouts.
