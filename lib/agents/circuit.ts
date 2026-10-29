/**
 * Circuit breaker for the voice-agent vendor. After `threshold` failed
 * hand-offs within `windowMs`, new callers skip the agent for `coolOffMs`
 * and go straight to capture, instead of each waiting out a timeout.
 *
 * Per server instance (in memory). That is enough here: the breaker only
 * saves callers a few seconds; correctness never depends on it.
 */
export class VendorCircuit {
  private failures: number[] = [];
  private openUntil = 0;

  constructor(
    private readonly threshold = 3,
    private readonly windowMs = 120_000,
    private readonly coolOffMs = 60_000,
  ) {}

  healthy(now = Date.now()): boolean {
    return now >= this.openUntil;
  }

  recordFailure(now = Date.now()): void {
    this.failures = this.failures.filter((t) => now - t < this.windowMs);
    this.failures.push(now);
    if (this.failures.length >= this.threshold) {
      this.openUntil = now + this.coolOffMs;
      this.failures = [];
    }
  }

  recordSuccess(): void {
    this.failures = [];
  }
}
