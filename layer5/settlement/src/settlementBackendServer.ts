import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { SettlementOrchestrator } from "./settlementOrchestrator.js";
import { SettlementService } from "./settlementService.js";
import type { SettlementPersistence } from "./persistence/createPersistenceFromEnv.js";
import type { SettlementAudit } from "./persistence/settlementPersistenceTypes.js";
import type { ContractId, ExecutionId, ExecutionResult } from "./types.js";
import { runGateChecklist } from "./gates/gateChecklist.js";
import {
  applyCors,
  applySecurityHeaders,
  assertApiKey,
  assertRateLimit,
  isApiKeyRequired,
  isPublicReadAllowed,
} from "./security/apiSecurity.js";
import type { RedemptionPlan } from "./settlementOrchestrator.js";

function bigintSafeJson(value: unknown): string {
  return JSON.stringify(value, (_k, v) => (typeof v === "bigint" ? v.toString() : v));
}

function auditStreamPollMs(): number {
  const raw = process.env.SETTLEMENT_AUDIT_STREAM_POLL_MS?.trim();
  const n = raw ? Number(raw) : 2000;
  if (!Number.isFinite(n) || n < 500) return 500;
  return Math.min(n, 60_000);
}

async function readJsonBody(req: IncomingMessage, maxBytes = 1_048_576): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buf.length;
    if (size > maxBytes) throw new Error("request body too large");
    chunks.push(buf);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw.trim()) return {};
  return JSON.parse(raw) as unknown;
}

function parseRedemptionPlan(body: Record<string, unknown>): RedemptionPlan {
  const consumer = String(body.consumer ?? "");
  if (!consumer.startsWith("0x")) throw new Error("consumer must be 0x address");
  return {
    redemptionId: String(body.redemptionId ?? crypto.randomUUID().replace(/-/g, "").slice(0, 32)),
    consumer,
    kwhClaim: BigInt(String(body.kwhClaim ?? "1")),
    coinBalanceMicro: BigInt(String(body.coinBalanceMicro ?? body.kwhClaim ?? "1000000")),
    batchKwh: BigInt(String(body.batchKwh ?? body.kwhClaim ?? "1")),
    batchRedeemed: Boolean(body.batchRedeemed ?? false),
    billingPeriodEndMs: Number(body.billingPeriodEndMs ?? Date.now()),
  };
}

function parseExecutionResult(body: Record<string, unknown>): ExecutionResult {
  return {
    contractId: String(body.contractId) as ContractId,
    executionId: String(body.executionId) as ExecutionId,
    txHash: String(body.txHash) as `0x${string}`,
    executionBlock: Number(body.executionBlock ?? 0),
    confirmationBlock: Number(body.confirmationBlock ?? 0),
    settled: Boolean(body.settled ?? true),
    rollbackReason: String(body.rollbackReason ?? "0x" + "0".repeat(64)) as `0x${string}`,
    proofIds: Array.isArray(body.proofIds) ? (body.proofIds as string[]).map((p) => p as `0x${string}`) : [],
    regulatoryReportCid: String(body.regulatoryReportCid ?? "0x" + "0".repeat(64)) as `0x${string}`,
    gasUsed: BigInt(String(body.gasUsed ?? "0")),
  };
}

export interface BackendServerDeps {
  readonly audit: SettlementAudit;
  readonly persistence: SettlementPersistence;
  readonly orchestrator?: SettlementOrchestrator;
  readonly settlement?: SettlementService;
}

export function createSettlementBackendServer(deps: BackendServerDeps): Server {
  const orchestrator = deps.orchestrator ?? new SettlementOrchestrator();
  const settlement =
    deps.settlement ??
    new SettlementService({
      audit: deps.persistence.audit,
      archive: deps.persistence.archive,
      reporter: deps.persistence.reporter,
    });

  return createServer(async (req, res) => {
    if (applyCors(req, res)) return;
    applySecurityHeaders(res);
    const url = req.url?.split("?")[0] ?? "";
    const method = req.method ?? "GET";
    const isWrite = method === "POST" || method === "PUT" || method === "DELETE";

    if (!assertRateLimit(req, res, isWrite)) return;

    const needsAuth =
      isWrite || (isApiKeyRequired() && !isPublicReadAllowed());
    if (needsAuth && !assertApiKey(req, res)) return;

    try {
      if (method === "GET" && url === "/health") {
        res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ ok: true, service: "layer5-settlement-backend" }));
        return;
      }

      if (method === "GET" && url === "/audit") {
        res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
        res.end(bigintSafeJson({ records: deps.audit.list() }));
        return;
      }

      if (method === "GET" && url === "/audit/stream") {
        res.writeHead(200, {
          "content-type": "text/event-stream; charset=utf-8",
          "cache-control": "no-cache, no-transform",
          connection: "keep-alive",
          "x-accel-buffering": "no",
        });
        let lastIndex = 0;
        const pushNew = () => {
          if (res.writableEnded) return;
          const list = deps.audit.list();
          for (; lastIndex < list.length; lastIndex++) {
            res.write(`data: ${bigintSafeJson(list[lastIndex])}\n\n`);
          }
        };
        pushNew();
        const poll = setInterval(pushNew, auditStreamPollMs());
        const ping = setInterval(() => {
          if (res.writableEnded) return;
          res.write(`: ping ${Date.now()}\n\n`);
        }, 25_000);
        const cleanup = () => {
          clearInterval(poll);
          clearInterval(ping);
        };
        req.on("close", cleanup);
        res.on("error", cleanup);
        return;
      }

      if (method === "GET" && (url === "/v1/gates" || url === "/gates")) {
        const checklist = await runGateChecklist({
          withRpc: process.env.GATE_CHECK_RPC !== "false",
        });
        res.writeHead(checklist.ready ? 200 : 503, {
          "content-type": "application/json; charset=utf-8",
        });
        res.end(bigintSafeJson(checklist));
        return;
      }

      if (method === "POST" && url === "/v1/redemption/dry-run") {
        const body = (await readJsonBody(req)) as Record<string, unknown>;
        const plan = parseRedemptionPlan(body);
        const outcome = await orchestrator.planRedemption(plan);
        const dry = await orchestrator.suiPtb.dryRun(plan);
        res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
        res.end(
          bigintSafeJson({
            plan: { ...plan, kwhClaim: plan.kwhClaim.toString() },
            outcome,
            dryRun: { ...dry, gasUsed: dry.gasUsed.toString() },
          }),
        );
        return;
      }

      if (method === "POST" && url === "/v1/redemption/submit") {
        const body = (await readJsonBody(req)) as Record<string, unknown>;
        const plan = parseRedemptionPlan(body);
        await orchestrator.planRedemption(plan);
        const { digest } = await orchestrator.suiPtb.submit(plan);
        res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ ok: true, digest }));
        return;
      }

      if (method === "POST" && url === "/v1/bridge/track") {
        const body = (await readJsonBody(req)) as Record<string, unknown>;
        const { trackBridgeMessage } = await import("./workers/bridgeWatcherWorker.js");
        trackBridgeMessage(
          String(body.bridgeTxId ?? `wh-${Date.now()}`),
          Number(body.emitterChain ?? 21),
          String(body.emitterAddress ?? ""),
          Number(body.sequence ?? 0),
        );
        res.writeHead(202, { "content-type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ ok: true, tracked: true }));
        return;
      }

      if (method === "POST" && url === "/v1/settlement/process") {
        const body = (await readJsonBody(req)) as Record<string, unknown>;
        const result = parseExecutionResult(body);
        const options = (body.options ?? {}) as Record<string, unknown>;
        const outcome = await settlement.process(result, {
          consumer: options.consumer ? String(options.consumer) : undefined,
          kwhClaim: options.kwhClaim != null ? BigInt(String(options.kwhClaim)) : undefined,
          coinBalanceMicro:
            options.coinBalanceMicro != null
              ? BigInt(String(options.coinBalanceMicro))
              : undefined,
          batchKwh: options.batchKwh != null ? BigInt(String(options.batchKwh)) : undefined,
          batchRedeemed:
            options.batchRedeemed != null ? Boolean(options.batchRedeemed) : undefined,
        });
        res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
        res.end(bigintSafeJson(outcome));
        return;
      }

      res.writeHead(404, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ error: "not_found" }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      res.writeHead(400, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ error: msg }));
    }
  });
}

export function startSettlementBackendServer(
  deps: BackendServerDeps,
  port = Number(process.env.SETTLEMENT_API_PORT ?? "3750"),
): Server {
  const server = createSettlementBackendServer(deps);
  server.listen(port);
  return server;
}

/** Read-only audit routes with minimal deps (legacy entry). */
export function startSettlementApiServer(
  audit: SettlementAudit,
  port?: number,
): Server {
  const persistence = {
    audit,
    archive: {
      archive: async () => {
        throw new Error("archive not configured");
      },
      get: () => undefined,
    },
    reporter: {
      generateReport: async () => {
        throw new Error("reporter not configured");
      },
      getReport: () => undefined,
    },
  };
  return startSettlementBackendServer({ audit, persistence }, port);
}
