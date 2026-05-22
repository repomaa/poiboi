# alloy-runtime

> The XS JavaScript engine and injected globals available in Alloy (Moddable SDK on PebbleOS).

## What is Alloy?

**Alloy** is the Moddable SDK ported to PebbleOS. It allows developers to write native Pebble watchapps in JavaScript (and TypeScript), executed by the **XS engine** — a small, high-performance ECMAScript engine designed for embedded devices. A minimal C bootstrap initializes the PebbleOS window and starts the XS machine.

Key traits:
- Native execution on the watch (not a companion webview).
- ES2020 module support.
- TypeScript compilation built into the build pipeline.

## Globals Provided by the Runtime

| Global | Description |
|--------|-------------|
| `watch` | Connectivity, time events, backlight, model info. |
| `console` | `console.log(...)` for debugging (goes to system log). |
| `setTimeout` / `clearTimeout` | Standard timer functions. |
| `setInterval` / `clearInterval` | Standard interval functions. |
| `localStorage` | Key/value string persistence on the watch. |
| `fetch` | HTTP requests (proxied through the paired phone). |
| `URL` / `URLSearchParams` | Standard WHATWG URL API. |
| `WebSocket` | WebSocket support. |
| `Resource` | Access to bundled image/font resources. |
| `Application`, `Label`, `Container`, `Column`, `Row`, `Port`, `Skin`, `Style`, `Texture`, `Transition` | Piu UI constructors (imported implicitly). |

## The `watch` Global

```typescript
interface watch {
  addEventListener(event: "secondchange" | "minutechange" | "hourchange" | "daychange", callback: (event: { date: Date }) => void): void;
  addEventListener(event: "connected", callback: () => void): void;
  addEventListener(event: "resize", callback: (progress: number) => void): void;
  addEventListener(event: "willFocus" | "didFocus", callback: (inFocus: boolean) => void): void;
  addEventListener(event: "wakeup", callback: (event: { id: number; cookie: number }) => void): void;
  removeEventListener(event: ..., callback: ...): void;

  light(enable?: boolean): void;

  readonly connected: { app: boolean; pebblekit: boolean };
  readonly hour12: boolean;
  readonly model: number;
  readonly firmwareVersion: { major: number; minor: number; patch: number };
  readonly launch: { reason: number; arguments: number };
  readonly wake: { id: number; cookie: number } | undefined;
}
```

### Key Properties

- `watch.connected.app` — `true` when the Pebble mobile app is connected.
- `watch.connected.pebblekit` — `true` when PebbleKit JS companion is active.
- `watch.model` — numeric hardware identifier (useful for platform-specific logic, e.g., detecting round vs rectangular screens).
- `watch.light(true)` — turns on the backlight.

### Time Events

```typescript
watch.addEventListener("secondchange", (event) => {
  console.log(event.date.toISOString());
});
```

- `"secondchange"` — fired every second.
- `"minutechange"` — fired every minute.
- `"hourchange"` — fired every hour.
- `"daychange"` — fired at midnight.
- `"connected"` — fired when Bluetooth/app connectivity changes.

## Timers

Standard browser-style timers are available:

```typescript
const id = setTimeout(() => { ... }, 1000);
clearTimeout(id);

const intervalId = setInterval(() => { ... }, 5000);
clearInterval(intervalId);
```

## `localStorage`

Simple key/value string persistence on the watch:

```typescript
localStorage.setItem("searchRadius", "500");
const radius = parseInt(localStorage.getItem("searchRadius") || "250", 10);
```

- Values are always strings. Convert numbers/booleans manually.
- Storage is limited (typically a few KB). Keep it small.

## Web APIs

### `fetch`

HTTP requests are proxied through the paired phone:

```typescript
fetch("https://api.example.com/data")
  .then(r => r.json())
  .then(data => console.log(data));
```

- `fetch` is available but limited by the phone's connectivity.
- For complex or batched network operations, prefer using the `Message` class to let the phone-side companion handle the request.

### `URL` / `URLSearchParams`

Standard WHATWG URL parsing:

```typescript
const url = new URL("https://example.com?radius=500");
const radius = url.searchParams.get("radius"); // "500"
```

## Memory & Performance Notes

- XS preloads modules into ROM where possible to reduce RAM use.
- Avoid creating large objects inside tight sensor loops.
- Use `preload` hints in the manifest for static data.
- The XS debugger (`xsbug`) can profile heap and CPU usage when running a debug build, but this requires a local Moddable SDK setup.
