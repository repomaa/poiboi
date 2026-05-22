# alloy-manifest

> The Moddable manifest (`manifest.json`) and C bootstrap for Alloy watchapps built on PebbleOS.

## Manifest (`manifest.json`)

A Moddable manifest declares modules, resources, includes, TypeScript options, and build configuration. CloudPebble reads this file to know which modules to include and how to compile TypeScript during the cloud build.

### Minimal Example

```json
{
  "include": [
    "$(MODDABLE)/examples/manifest_mod.json",
    "$(MODDABLE)/examples/manifest_typings.json"
  ],
  "modules": {
    "*": "./main"
  },
  "typescript": {
    "tsconfig": {
      "compilerOptions": {
        "target": "es2020",
        "module": "es2020",
        "lib": ["es2020"],
        "baseUrl": "."
      }
    }
  }
}
```

### Key Fields

- **`include`** — Pulls in shared manifests (e.g., base modules, typings). Uses `$(MODDABLE)` to reference the SDK root.
- **`modules`** — Maps import specifiers to source files. `"*": "./main"` means `import * from "main"` resolves to `./main.ts`.
- **`typescript`** — Compiler options used by the build pipeline. `target` and `module` are typically `es2020`.
- **`resources`** / **`data`** — Bundles images, fonts, and other static assets referenced at runtime via `Resource` or `Texture`.

### Resource Bundling

Images, fonts, and other assets are declared in `manifest.json` and referenced at runtime:

```json
{
  "resources": {
    "*": ["./assets/icon.png"]
  }
}
```

At runtime: `new Texture({ path: "./assets/icon.png" })` or via the `Resource` global.

### Preload & Optimization

XS preloads modules into ROM where possible to reduce RAM use. Add `preload` hints in the manifest for static data modules to reduce startup time.

## C Bootstrap

A tiny C file creates a Pebble window and starts the XS JavaScript machine:

```c
#include <pebble.h>

int main(void) {
  Window *w = window_create();
  window_stack_push(w, true);

  moddable_createMachine(NULL);

  window_destroy(w);
}
```

- This is required for every Alloy watchapp.
- `window_create()` + `window_stack_push()` establishes the PebbleOS native window.
- `moddable_createMachine(NULL)` starts the XS engine and runs the JS entry point declared in the manifest.
- `window_destroy(w)` cleans up on exit.
- The JS runtime lives inside this window lifecycle.

## TypeScript Configuration

The project uses TypeScript with types from the Moddable SDK:

- `moddable/xs/includes/xs` — XS engine types.
- `moddable/typings/global` — base globals (`setTimeout`, `console`, etc.).
- `moddable/typings/pebble/global` — Pebble-specific globals (`watch`, `Resource`, etc.).
- `moddable/typings/pebble/piu` — Piu UI types.
- `moddable/typings/pebble/poco` — Poco graphics types.

Because `tsconfig.json` is gitignored (to avoid interfering with CloudPebble), developers can generate it locally for IDE support. It must not affect the CloudPebble build.
