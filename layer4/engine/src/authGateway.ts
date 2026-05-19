import type { ExecutionId, ExecutionRequest } from "./types.js";

export interface ThresholdConfig {
  readonly m: number;
  readonly n: number;
}

export interface AuthGatewayConfig {
  readonly threshold: ThresholdConfig;
  readonly authorizedSigners?: readonly `0x${string}`[];
}

/**
 * Lane AUTH — M-of-N signature gate (Gate 4.6.1–4.6.3).
 * Production: Safe SDK + EIP-712; tests use pre-collected sig placeholders.
 */
export class AuthGateway {
  constructor(private readonly config: AuthGatewayConfig) {}

  validate(request: ExecutionRequest, executionId: ExecutionId): void {
    const { m, n } = this.config.threshold;
    const sigs = request.eip712Signatures;
    if (sigs.length < m) {
      throw new AuthError(1105, `threshold not met: ${sigs.length}/${m} of ${n}`, executionId);
    }
    const unique = new Set(sigs.map((s) => s.slice(0, 42)));
    if (unique.size < m) {
      throw new AuthError(1101, "duplicate signer", executionId);
    }
    if (request.zkProof.proof.length <= 2) {
      throw new AuthError(1102, "ZK proof invalid", executionId);
    }
  }
}

export class AuthError extends Error {
  constructor(
    readonly code: number,
    message: string,
    readonly executionId: ExecutionId,
  ) {
    super(message);
    this.name = "AuthError";
  }
}
