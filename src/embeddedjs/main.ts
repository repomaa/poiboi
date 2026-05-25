// @ts-ignore — runtime resolves via manifest
import Compass from "pebble/compass";
// @ts-ignore
import Location from "pebble/location";
// @ts-ignore
import Vibes from "pebble/vibes";
// @ts-ignore
import Button from "pebble/button";
// @ts-ignore
import Message from "pebble/message";

const BLACK = 0;
const WHITE = 0xffffff;

interface POI {
  name: string;
  lat: number;
  lon: number;
  dist: number;
  type: string;
}

type AppState = "loading" | "sonar" | "reveal";

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function toDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

function normalizeAngle(deg: number): number {
  deg = deg % 360;
  if (deg < 0) deg += 360;
  return deg;
}

function angleDifference(a: number, b: number): number {
  const diff = Math.abs(normalizeAngle(a) - normalizeAngle(b));
  return Math.min(diff, 360 - diff);
}

function computeBearing(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const dLon = toRad(lon2 - lon1);
  const lat1r = toRad(lat1);
  const lat2r = toRad(lat2);
  const y = Math.sin(dLon) * Math.cos(lat2r);
  const x =
    Math.cos(lat1r) * Math.sin(lat2r) -
    Math.sin(lat1r) * Math.cos(lat2r) * Math.cos(dLon);
  let bearing = toDeg(Math.atan2(y, x));
  return normalizeAngle(bearing);
}

function haversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

class POIBoiApp {
  private state: AppState = "loading";
  private pois: POI[] = [];
  private currentPOI: POI | null = null;
  private radius: number = 500;

  private compass!: Compass;
  private location!: Location;
  private message!: Message;
  private button!: Button;

  private app!: Application;
  private sonarPort!: Port;
  private statusLabel!: Label;
  private poiNameLabel!: Label;
  private poiInfoLabel!: Label;
  private hintLabel!: Label;

  private heading: number = 0;
  private userLat: number = 0;
  private userLon: number = 0;
  private hasLocation: boolean = false;
  private hasCompass: boolean = false;

  private pointingStartTime: number = 0;
  private isPointingAtPOI: boolean = false;
  private readonly POINTING_THRESHOLD_MS = 2000;

  private readonly MIN_ANGLE_TOLERANCE = 5;
  private readonly MAX_ANGLE_TOLERANCE = 30;

  private readonly RING_WIDTH_RATIO = 0.3;

  private sonarTimer: number | null = null;
  private vibeCooldown: number = 0;

  // Orientation offset in degrees. Assumes the watch is held roughly flat
  // (face-up like a compass) so that the compass heading matches the forward
  // pointing direction. Future versions may auto-calibrate or expose this as
  // a configurable setting to account for strap orientation.
  private readonly ORIENTATION_OFFSET = 0;

  constructor() {
    console.log("[poiboi] App constructor starting");
    this.buildUI();
    this.initSensors();
    this.initMessaging();
    this.initButtons();

    const savedRadius = localStorage.getItem("searchRadius");
    if (savedRadius) {
      this.radius = parseInt(savedRadius, 10);
      console.log("[poiboi] Restored radius from localStorage:", this.radius);
    }

    this.setState("loading");
    this.requestPOIs();
    console.log("[poiboi] App constructor complete");
  }

  private buildUI(): void {
    const blackSkin = new Skin({ fill: "black" });
    const whiteText = new Style({
      color: "white",
      font: "18px",
      horizontal: "center",
      vertical: "middle",
    });
    const smallText = new Style({
      color: "white",
      font: "14px",
      horizontal: "center",
      vertical: "middle",
    });
    const bigText = new Style({
      color: "white",
      font: "24px",
      horizontal: "center",
      vertical: "middle",
    });

    this.statusLabel = new Label(null, {
      style: smallText,
      string: "poiboi",
      top: 10,
      left: 15,
      right: 15,
      height: 20,
    });

    const appRef = this;
    this.sonarPort = new Port(null, {
      top: 35,
      left: 0,
      right: 0,
      bottom: 60,
      Behavior: class extends Behavior {
        onDraw(port: Port, poco: any) {
          appRef.drawSonar(port, poco);
        }
      },
    }) as Port;

    this.poiNameLabel = new Label(null, {
      style: bigText,
      string: "",
      left: 15,
      right: 15,
      bottom: 55,
      height: 30,
    });

    this.poiInfoLabel = new Label(null, {
      style: whiteText,
      string: "",
      left: 15,
      right: 15,
      bottom: 35,
      height: 18,
    });

    this.hintLabel = new Label(null, {
      style: smallText,
      string: "",
      left: 15,
      right: 15,
      bottom: 12,
      height: 18,
    });

    this.app = new Application(null, {
      skin: blackSkin,
      contents: [
        this.statusLabel,
        this.sonarPort,
        this.poiNameLabel,
        this.poiInfoLabel,
        this.hintLabel,
      ],
    });
  }

  private drawSonar(port: Port, poco: any): void {
    const w = port.width;
    const h = port.height;
    const cx = w / 2;
    const cy = h / 2;

    poco.begin();
    poco.fillRectangle(BLACK, 0, 0, w, h);

    if (this.state !== "sonar" || !this.hasLocation || !this.currentPOI) {
      // Idle crosshair when not actively scanning a target
      poco.fillCircle(WHITE, cx, cy, 3);
      poco.end();
      return;
    }

    const targetBearing = computeBearing(
      this.userLat,
      this.userLon,
      this.currentPOI.lat,
      this.currentPOI.lon,
    );
    const diff = angleDifference(
      this.heading + this.ORIENTATION_OFFSET,
      targetBearing,
    );
    const strength = Math.max(0, 1 - diff / 90);

    // Pulsing ring whose radius grows as the user points closer
    const ringRadius = 20 + strength * 35;
    poco.fillCircle(WHITE, cx, cy, ringRadius);
    poco.fillCircle(BLACK, cx, cy, ringRadius - 2);

    // Direction indicator dot on the outer edge pointing toward the POI
    const relAngle = toRad(
      targetBearing - (this.heading + this.ORIENTATION_OFFSET),
    );
    const dotRadius = Math.min(w, h) / 2 - 10;
    const dx = cx + Math.sin(relAngle) * dotRadius;
    const dy = cy - Math.cos(relAngle) * dotRadius;
    poco.fillCircle(WHITE, dx, dy, 3 + strength * 4);

    poco.end();
  }

  private initSensors(): void {
    console.log("[poiboi] Initializing sensors...");
    this.compass = new Compass({
      onSample: () => {
        const sample = this.compass.sample();
        if (sample) {
          this.heading = sample.heading;
          this.hasCompass = true;
          if (this.state === "sonar") {
            this.sonarPort.invalidate();
          }
        }
      },
    });
    this.compass.configure({ filter: 1 });

    this.location = new Location({
      onSample: () => {
        const sample = this.location.sample();
        if (sample) {
          this.userLat = sample.latitude;
          this.userLon = sample.longitude;
          this.hasLocation = true;
          console.log(
            "[poiboi] Location updated:",
            this.userLat.toFixed(4),
            this.userLon.toFixed(4),
          );
          this.updatePOIDistances();
        }
      },
      onError: (err: Error) => {
        console.log("[poiboi] Location error:", err);
      },
    });
    this.location.configure({
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 60000,
    });
  }

  private getRingBounds(): { inner: number; outer: number } {
    const width = this.radius * this.RING_WIDTH_RATIO;
    return {
      inner: Math.max(0, this.radius - width / 2),
      outer: this.radius + width / 2,
    };
  }

  private getNearestRingPOI(): POI | null {
    const { inner, outer } = this.getRingBounds();
    let nearest: POI | null = null;
    let nearestDist = Infinity;
    for (const poi of this.pois) {
      if (poi.dist >= inner && poi.dist <= outer) {
        if (poi.dist < nearestDist) {
          nearestDist = poi.dist;
          nearest = poi;
        }
      }
    }
    return nearest;
  }

  private updateCurrentPOI(): void {
    this.currentPOI = this.getNearestRingPOI();
    if (this.state === "sonar") {
      this.updateStatusLine();
    }
  }

  private updatePOIDistances(): void {
    if (this.pois.length === 0) return;
    for (const poi of this.pois) {
      poi.dist = haversineMeters(this.userLat, this.userLon, poi.lat, poi.lon);
    }
    this.pois.sort((a, b) => a.dist - b.dist);
    this.updateCurrentPOI();
  }

  private initMessaging(): void {
    this.message = new Message({
      onReadable: () => {
        const data = this.message.read();
        if (!data) return;
        this.handleMessage(data);
      },
      format: "map",
      keys: [
        "radius",
        "ring_width",
        "request_pois",
        "poi_count",
        "poi_index",
        "poi_name",
        "poi_lat",
        "poi_lon",
        "poi_dist",
        "poi_type",
        "user_lat",
        "user_lon",
      ],
    });
  }

  private handleMessage(
    data: Map<string | number, number | string | ArrayBuffer>,
  ): void {
    var msgEntries: any = {};
    data.forEach(function (v: any, k: any) {
      msgEntries[k] = v;
    });
    console.log("[poiboi] Received message:", JSON.stringify(msgEntries));
    if (data.has("radius")) {
      const r = data.get("radius");
      if (typeof r === "number") {
        this.radius = r;
        localStorage.setItem("searchRadius", String(r));
        console.log("[poiboi] Updated radius from phone:", r);
      }
    }

    if (data.has("poi_name")) {
      const poi: POI = {
        name: String(data.get("poi_name") || "Unknown"),
        lat: Number(data.get("poi_lat") || 0),
        lon: Number(data.get("poi_lon") || 0),
        dist: Number(data.get("poi_dist") || 0),
        type: String(data.get("poi_type") || ""),
      };
      this.pois.push(poi);
      console.log("[poiboi] Received POI:", poi.name, "@", poi.dist, "m");
      if (this.hasLocation) {
        poi.dist = haversineMeters(
          this.userLat,
          this.userLon,
          poi.lat,
          poi.lon,
        );
      }
      this.pois.sort((a, b) => a.dist - b.dist);
      this.updateCurrentPOI();
      if (this.state === "loading") {
        this.setState("sonar");
      }
    }
  }

  private requestPOIs(): void {
    if (!watch.connected.app) {
      console.log("[poiboi] Phone not connected, waiting...");
      this.statusLabel.string = "Waiting for phone...";
      return;
    }
    const width = this.radius * this.RING_WIDTH_RATIO;
    const payload = new Map<string, number | string | boolean>([
      ["request_pois", true],
      ["radius", this.radius],
      ["ring_width", Math.round(width)],
    ]);
    if (this.hasLocation) {
      payload.set("user_lat", this.userLat);
      payload.set("user_lon", this.userLon);
    }
    console.log(
      "[poiboi] Requesting POIs — radius:",
      this.radius,
      "location:",
      this.hasLocation,
    );
    this.message.write(payload as Map<string, number | string | boolean>);
    this.statusLabel.string = "Loading POIs...";
  }

  private initButtons(): void {
    this.button = new Button({
      types: ["back", "up", "down", "select"],
      onPush: (pushed, type) => {
        if (pushed !== 1) return;
        if (type === "back") {
          if (this.state === "reveal") {
            this.setState("sonar");
          } else {
            this.shutdown();
          }
          return;
        }
        // Any non-back button returns to sonar from reveal
        if (this.state === "reveal") {
          this.setState("sonar");
        }
      },
    });
  }

  private setState(newState: AppState): void {
    if (this.state === newState) return;
    console.log("[poiboi] State transition:", this.state, "->", newState);
    this.state = newState;

    if (newState === "loading") {
      this.statusLabel.string = "Loading POIs...";
      this.poiNameLabel.string = "";
      this.poiInfoLabel.string = "";
      this.hintLabel.string = "";
      this.stopSonarLoop();
    } else if (newState === "sonar") {
      this.isPointingAtPOI = false;
      this.pointingStartTime = 0;
      this.poiNameLabel.string = "";
      this.poiInfoLabel.string = "";
      this.hintLabel.string = "";
      this.updateStatusLine();
      this.sonarPort.invalidate();
      this.startSonarLoop();
    } else if (newState === "reveal") {
      this.stopSonarLoop();
      Vibes.doublePulse();
      this.statusLabel.string = "Found!";
      if (this.currentPOI) {
        this.poiNameLabel.string = this.currentPOI.name;
        this.poiInfoLabel.string = `${this.currentPOI.type || "POI"} | ${this.currentPOI.dist}m`;
      } else {
        this.poiNameLabel.string = "Unknown";
        this.poiInfoLabel.string = "";
      }
      this.hintLabel.string = "Press button to scan";
    }
  }

  private startSonarLoop(): void {
    if (this.sonarTimer !== null) return;
    this.sonarTimer = setInterval(() => {
      this.sonarTick();
    }, 200);
  }

  private stopSonarLoop(): void {
    if (this.sonarTimer !== null) {
      clearInterval(this.sonarTimer);
      this.sonarTimer = null;
    }
    Vibes.cancel();
    this.vibeCooldown = 0;
  }

  private getAngleTolerance(): number {
    const minRadius = 50;
    const maxRadius = 2000;
    const clamped = Math.max(minRadius, Math.min(maxRadius, this.radius));
    const ratio = (clamped - minRadius) / (maxRadius - minRadius);
    return (
      this.MAX_ANGLE_TOLERANCE -
      ratio * (this.MAX_ANGLE_TOLERANCE - this.MIN_ANGLE_TOLERANCE)
    );
  }

  private updateStatusLine(): void {
    if (this.state === "loading") {
      this.statusLabel.string = "Loading POIs...";
      return;
    }
    if (this.state !== "sonar") return;
    if (this.currentPOI) {
      this.statusLabel.string = `${this.currentPOI.dist}m`;
    } else if (this.pois.length > 0) {
      this.statusLabel.string = "No POIs in range";
    } else {
      this.statusLabel.string = "Scanning... (extend your arm)";
    }
  }

  private sonarTick(): void {
    const now = Date.now();

    if (!this.hasCompass || !this.currentPOI || !this.hasLocation) {
      if (this.state === "sonar") {
        this.statusLabel.string = this.hasLocation
          ? "Scanning... (extend your arm)"
          : "Waiting for GPS...";
      }
      return;
    }

    const targetBearing = computeBearing(
      this.userLat,
      this.userLon,
      this.currentPOI.lat,
      this.currentPOI.lon,
    );
    const diff = angleDifference(
      this.heading + this.ORIENTATION_OFFSET,
      targetBearing,
    );

    this.updateStatusLine();

    if (diff < this.getAngleTolerance()) {
      if (!this.isPointingAtPOI) {
        this.isPointingAtPOI = true;
        this.pointingStartTime = now;
        console.log("[poiboi] Pointing at POI:", this.currentPOI.name);
      }
      const held = now - this.pointingStartTime;
      if (held >= this.POINTING_THRESHOLD_MS) {
        console.log("[poiboi] Reveal triggered for:", this.currentPOI.name);
        this.setState("reveal");
        return;
      }
      if (now >= this.vibeCooldown) {
        Vibes.pattern([40, 60, 40]);
        this.vibeCooldown = now + 140;
      }
    } else {
      this.isPointingAtPOI = false;
      this.pointingStartTime = 0;

      const closeness = Math.max(0, 1 - diff / 90);
      if (now >= this.vibeCooldown) {
        if (closeness > 0.7) {
          Vibes.pattern([60, 100]);
          this.vibeCooldown = now + 160;
        } else if (closeness > 0.4) {
          Vibes.pattern([50, 300]);
          this.vibeCooldown = now + 350;
        } else if (closeness > 0.15) {
          Vibes.pattern([30, 700]);
          this.vibeCooldown = now + 730;
        }
      }
    }

    if (this.state === "sonar") {
      this.sonarPort.invalidate();
    }
  }

  private shutdown(): void {
    this.stopSonarLoop();
    this.compass.close();
    this.location.close();
    this.message.close();
    this.button.close();
  }
}

new POIBoiApp();
