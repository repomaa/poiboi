# alloy-sensors

> Sensor and actuator APIs in Alloy (Moddable SDK on PebbleOS): Compass, Location, Vibes, and Button.

## Compass (`pebble/compass`)

Provides magnetic heading in degrees.

```typescript
import Compass from "pebble/compass";

const compass = new Compass({
  onSample: () => {
    const { heading } = compass.sample(); // 0–360 degrees
    // heading is relative to magnetic north, increasing clockwise
  }
});

// Or poll manually:
const { heading } = compass.sample();

compass.configure({ filter: 1 }); // optional filtering to smooth noisy readings
compass.close();
```

### API Reference

```typescript
interface CompassOptions {
  onSample?: () => void;
}

interface CompassConfigureOptions {
  filter?: number;
}

interface CompassSample {
  heading: number;
}

class Compass {
  constructor(options: CompassOptions);
  close(): void;
  configure(options: CompassConfigureOptions): void;
  sample(): CompassSample;
}
```

- `heading` increases clockwise: 0 = north, 90 = east, 180 = south, 270 = west.
- Use `configure({ filter })` to reduce jitter.
- Always `close()` when done to save power.

## Location (`pebble/location`)

Provides GPS coordinates from the paired phone.

```typescript
import Location from "pebble/location";

const loc = new Location({
  onSample: () => {
    const sample = loc.sample(); // LocationSample | undefined
    if (sample) {
      console.log(sample.latitude, sample.longitude, sample.accuracy);
    }
  },
  onError: (err) => console.error(err)
});

loc.configure({ enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 });
loc.close();
```

### API Reference

```typescript
interface LocationSample {
  latitude: number;
  longitude: number;
  altitude?: number;
  accuracy?: number;
  altitudeAccuracy?: number;
  heading?: number;
  speed?: number;
  timestamp?: number;
}

interface LocationOptions {
  onSample?: () => void;
  onError?: (error: Error) => void;
}

interface LocationConfiguration {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
}

class Location {
  constructor(options: LocationOptions);
  close(): void;
  configure(options: LocationConfiguration): void;
  sample(): LocationSample | undefined;
}
```

- `sample()` returns `undefined` if no GPS fix is available yet.
- `accuracy` is in meters (lower is better).
- There is no standalone GPS on the watch; data comes from the phone.
- Always `close()` when the screen is off or the app exits.

## Vibes (`pebble/vibes`)

Controls the vibration motor.

```typescript
import Vibes from "pebble/vibes";

Vibes.shortPulse();
Vibes.longPulse();
Vibes.doublePulse();

// Custom pattern: on 200ms, off 100ms, on 200ms, off 100ms, on 400ms
Vibes.pattern([200, 100, 200, 100, 400]);

Vibes.cancel();
```

### API Reference

```typescript
class Vibes {
  static cancel(): void;
  static shortPulse(): void;
  static longPulse(): void;
  static doublePulse(): void;
  static pattern(durations: number[]): void;
}
```

- `pattern(durations[])` accepts an array of millisecond durations.
- Even indices = motor on, odd indices = motor off.
- Use custom patterns to create sonar-style accelerating feedback.
- Be mindful that extended vibration drains battery.
- `cancel()` stops any ongoing vibration immediately.

## Button (`pebble/button`)

Listens to physical button presses and releases.

```typescript
import Button from "pebble/button";

const btn = new Button({
  types: ["select", "up", "down"],
  onPush: (pushed, type) => {
    if (pushed) console.log(`Button ${type} pressed`);
    else console.log(`Button ${type} released`);
  }
});

btn.close();
```

### API Reference

```typescript
type ButtonType = "back" | "up" | "down" | "select";

class Button {
  constructor(options: {
    type: ButtonType;              // for a single button
    onPush: (pushed: 0 | 1, type: ButtonType) => void;
  } | {
    types: ButtonType[];            // for multiple buttons
    onPush: (pushed: 0 | 1, type: ButtonType) => void;
  });
  close(): void;
}
```

- `types` can be any combination of `"back"`, `"up"`, `"down"`, `"select"`.
- `pushed` is `1` on press, `0` on release.
- On touchscreen models (`gabbro`, `diorite`), button events still fire normally alongside touch events.
- Always `close()` when the screen is off or the app exits to avoid leaked listeners.
