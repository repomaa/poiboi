# alloy-messaging

> Phone communication in Alloy (Moddable SDK on PebbleOS). Covers the `Message` class, PebbleKit JS companion, and settings sync.

## Overview

The `Message` class (`pebble/message`) sends/receives key-value dictionaries to the Pebble mobile app. This is the primary channel for:
1. Requesting POI data from the phone (watch asks, phone fetches OSM/Nominatim).
2. Receiving OSM POI results back on the watch.
3. Syncing settings (e.g., search radius) from the phone to the watch.

The watch never makes direct HTTPS calls to OSM. Instead, it sends a message to the phone-side companion JavaScript, which performs the request and replies.

## Message (`pebble/message`)

### Basic Usage

```typescript
import Message from "pebble/message";

const msg = new Message({
  onReadable: () => {
    const data = msg.read(); // Map<string | number, number | string | ArrayBuffer>
    console.log("Received from phone:", data);
  },
  onWritable: (count) => {
    // `count` = free message slots available
  },
  format: "map",
  keys: ["radius", "poi_count", "poi_name", "poi_lat", "poi_lon", "request_pois"]
});

// Send a request to the phone
msg.write(new Map([
  ["radius", 500],
  ["request_pois", true]
]));

msg.close();
```

### API Reference

```typescript
interface MessageOptions {
  onReadable?: () => void;           // fired when a message arrives
  onWritable?: (count: number) => void; // fired when outbound queue has space
  onSuspend?: () => void;           // fired when Bluetooth/app disconnects
  format?: "map";                    // always "map" for dictionary style
  keys?: Map<string, number> | Array<string>; // key name -> integer ID mapping
}

type MessageKey = string | number;
type MessageReadValue = number | string | ArrayBuffer;
type MessageWriteValue = number | string | ByteBuffer | boolean;

class Message {
  constructor(options: MessageOptions);
  close(): void;
  read(): Map<MessageKey, MessageReadValue>;
  write(map: Map<MessageKey, MessageWriteValue>): void;
  get format(): "map";
  set format(value: "map");
  get input(): number;
  get output(): number;
}
```

- `format: "map"` uses dictionary-style messages compatible with PebbleKit JS.
- `keys` maps human-readable names to integer message keys for the wire protocol. Both sides must agree on the mapping.
- `read()` returns a `Map` of the last received message. Call it inside `onReadable`.
- `write(map)` queues a message to the phone. It may silently fail if the outbound buffer is full; check `onWritable` if you need backpressure handling.
- `close()` terminates the message channel. Re-open a new `Message` if needed.

### Phone-Side Companion (PebbleKit JS)

The companion JavaScript runs inside the Pebble mobile app on the phone. It listens for `appmessage` events, makes HTTPS requests, and sends replies back.

```javascript
// PebbleKit JS companion (runs on phone)
Pebble.addEventListener('appmessage', function(e) {
  if (e.payload.request_pois) {
    var radius = e.payload.radius || 500;
    var query = buildOverpassQuery(radius);

    fetch('https://overpass-api.de/api/interpreter?data=' + encodeURIComponent(query))
      .then(function(r) { return r.json(); })
      .then(function(data) {
        var elements = data.elements || [];
        Pebble.sendAppMessage({
          'poi_count': elements.length,
          'poi_name': elements[0] ? (elements[0].tags.name || 'Unknown') : '',
          'poi_lat': elements[0] ? elements[0].lat : 0,
          'poi_lon': elements[0] ? elements[0].lon : 0,
        });
      })
      .catch(function(err) {
        console.log('OSM fetch failed:', err);
      });
  }
});
```

- The companion JS is bundled with the watchapp and uploaded to the phone via the Pebble mobile app.
- It has full internet access, `fetch`, and can access phone APIs.
- `Pebble.sendAppMessage(dict)` sends a dictionary back to the watch. The watch receives it via `Message.read()`.
- Keep message payloads small (under ~8 KB). Large payloads may be dropped.

## Settings Sync

Settings are typically stored in the phone companion app's preferences and pushed to the watch.

### Phone → Watch Flow

1. User opens Pebble mobile app settings for this watchapp.
2. Companion JS saves the value (e.g., `radius = 1000`) to `localStorage` or phone preferences.
3. Companion JS calls `Pebble.sendAppMessage({ radius: 1000 })`.
4. Watch receives the message in `Message.onReadable` and persists it in `localStorage`.

### Watch → Phone Flow (less common)

1. Watch sends a message requesting current settings or confirming a change.
2. Companion JS reads its stored preferences and replies.

### Persistence on the Watch

```typescript
// When a setting arrives
localStorage.setItem("searchRadius", String(data.get("radius")));

// On app startup
const radius = parseInt(localStorage.getItem("searchRadius") || "500", 10);
```

## Message Keys

Define message keys in `package.json` under `pebble.messageKeys`:

```json
{
  "pebble": {
    "messageKeys": [
      "radius",
      "request_pois",
      "poi_count",
      "poi_name",
      "poi_lat",
      "poi_lon"
    ]
  }
}
```

These keys are automatically assigned integer IDs and must match the `keys` array passed to the `Message` constructor on the watch and the keys used in `Pebble.sendAppMessage()` on the phone.
