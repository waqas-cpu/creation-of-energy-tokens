/** Lane SFT — circuit breaker (horizontal decomp §2.6) */

export interface BreakerMetrics {
  readonly windowStart: number;
  readonly attempts: number;
  readonly failures: number;
}

export class CircuitBreaker {
  private open = false;
  private metrics: BreakerMetrics = { windowStart: Date.now(), attempts: 0, failures: 0 };
  private readonly windowMs = 10 * 60 * 1000;
  private readonly maxPerMinute = 10;

  isOpen(): boolean {
    return this.open;
  }

  assertClosed(): void {
    if (this.open) {
      throw new Error("Layer4: circuit breaker OPEN — executions rejected");
    }
  }

  recordAttempt(success: boolean): void {
    const now = Date.now();
    if (now - this.metrics.windowStart > this.windowMs) {
      this.metrics = { windowStart: now, attempts: 0, failures: 0 };
    }
    this.metrics = {
      ...this.metrics,
      attempts: this.metrics.attempts + 1,
      failures: this.metrics.failures + (success ? 0 : 1),
    };
    const rate = this.metrics.attempts / (this.windowMs / 60_000);
    if (rate > this.maxPerMinute) {
      this.open = true;
    }
    if (this.metrics.attempts >= 3 && this.metrics.failures / this.metrics.attempts > 0.3) {
      this.open = true;
    }
  }

  trip(): void {
    this.open = true;
  }

  reset(): void {
    this.open = false;
    this.metrics = { windowStart: Date.now(), attempts: 0, failures: 0 };
  }
}
