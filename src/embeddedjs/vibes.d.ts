declare module "pebble/vibes" {
  class Vibes {
    static cancel(): void;
    static shortPulse(): void;
    static longPulse(): void;
    static doublePulse(): void;
    static pattern(durations: number[]): void;
  }
  export default Vibes;
}
