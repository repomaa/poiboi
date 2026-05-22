# alloy-ui

> UI framework and graphics in Alloy (Moddable SDK on PebbleOS). Covers Piu, Poco, resources, and round-screen considerations.

## Piu UI Framework

Piu is the Moddable SDK’s retained-mode UI framework. It provides a tree of `Content` nodes that the framework renders automatically. Construct the tree programmatically using Piu constructors (available as globals or via `import`):

- `Application` — root container for the whole app.
- `Container` / `Column` / `Row` — layout containers.
- `Label` / `Text` — text display.
- `Port` — custom drawing surface (low-level Poco access).
- `Skin` / `Style` — appearance definitions (colors, fonts, borders).
- `Texture` — bitmaps and patterns.
- `Transition` — animated scene changes.

### Example

```typescript
const app = new Application(null, {
  skin: new Skin({ fill: "black" }),
  contents: [
    new Label(null, {
      style: new Style({ color: "white", font: "24px" }),
      string: "Hello Pebble"
    })
  ]
});
```

### Style & Skin

```typescript
const whiteText = new Style({
  color: "white",
  font: "18px",
  horizontal: "center",
  vertical: "middle"
});

const blackSkin = new Skin({ fill: "black" });
const borderedSkin = new Skin({ fill: "black", stroke: "white", borders: { left: 1, right: 1, top: 1, bottom: 1 } });
```

- Colors can be strings (e.g., `"black"`, `"white"`, `"red"`) or numeric values.
- On monochrome screens (`emery`), only black/white are meaningful.
- On color screens (`gabbro`, `diorite`), a 64-color palette is available.

### Layout Containers

```typescript
new Column(null, {
  top: 0, left: 0, right: 0, bottom: 0,
  contents: [
    new Label(null, { style: whiteText, string: "Top" }),
    new Label(null, { style: whiteText, string: "Bottom" })
  ]
});
```

- `top`, `left`, `right`, `bottom` define margins from the parent edges.
- `width` and `height` can be used for fixed sizing.
- `Column` stacks children vertically; `Row` stacks horizontally.

## Poco Renderer

For raw graphics (paths, primitives, bitmaps), use `Poco` inside a `Port` or through direct drawing commands. This is useful for compass needles, radar-style sonar UIs, or custom watch faces.

```typescript
import Poco from "commodetto/Poco";

const port = new Port(null, {
  width: 144,
  height: 168,
  behavior: class extends Behavior {
    onDraw(port, poco: Poco) {
      poco.begin();
      poco.fillRectangle("black", 0, 0, 144, 168);
      poco.fillCircle("white", 72, 84, 10);
      poco.end();
    }
  }
});
```

- `Poco.begin()` starts a frame.
- `Poco.fillRectangle()`, `fillCircle()`, `drawLine()`, etc. draw primitives.
- `Poco.end()` commits the frame.
- Poco is low-level and efficient, ideal for sensor-driven visualizations.

## Resource Bundling

Images and fonts are declared in `manifest.json` and referenced at runtime:

```json
{
  "resources": {
    "*": ["./assets/icon.png"]
  }
}
```

Runtime usage:

```typescript
const texture = new Texture({ path: "./assets/icon.png" });
const skin = new Skin({ texture, x: 0, y: 0, width: 32, height: 32 });
```

Or via the `Resource` global for direct binary access:

```typescript
const data = Resource("./assets/data.json");
```

## Round-Screen UI Considerations

The Pebble Round 2 (`diorite`) has a circular screen (260 × 260). When building for round platforms:

- **Avoid corners:** Critical text and UI elements should be centered. The extreme edges of the rectangular bounding box are clipped by the circular viewport.
- **Use `Port` with circular clipping:** Piu automatically clips to the screen shape on round devices, but custom `Port` drawing may need manual circular masks.
- **Status bar:** On round Pebbles, the system status bar is often curved or absent. Do not assume a rectangular safe area at the top.
- **Resize events:** Use `watch.addEventListener("resize", callback)` to handle layout changes if the app needs to adapt dynamically.

### Platform-Conditional Layouts

```typescript
const isRound = watch.model === /* diorite model id */;

const app = new Application(null, {
  skin: new Skin({ fill: "black" }),
  contents: [
    new Label(null, {
      style: new Style({ color: "white", font: isRound ? "20px" : "18px" }),
      string: "POI Name",
      top: isRound ? 40 : 20,
      horizontal: "center"
    })
  ]
});
```

## UI Performance Notes

- Piu is retained-mode: modifying the tree triggers automatic re-rendering. Avoid creating/destroying nodes inside high-frequency loops (e.g., every compass sample). Instead, update `string`, `style`, or `skin` properties.
- For high-frequency visualizations (sonar, compass needle), use a `Port` with a `Behavior.onDraw` that draws via Poco rather than rebuilding Piu nodes.
- Keep the node tree shallow to reduce layout cost.
