import { loadRepoRootDotEnv } from "./loadRepoRootEnv.js";
import { createPersistenceFromEnv } from "./persistence/createPersistenceFromEnv.js";
import { startSettlementBackendServer } from "./settlementBackendServer.js";
import { SettlementOrchestrator } from "./settlementOrchestrator.js";
import { suiPtbConfigFromEnv } from "./config/deploymentFromEnv.js";

loadRepoRootDotEnv();

const port = Number(process.env.SETTLEMENT_API_PORT ?? "3750");
const persistence = createPersistenceFromEnv();
const orchestrator = new SettlementOrchestrator(suiPtbConfigFromEnv());

const server = startSettlementBackendServer(
  { audit: persistence.audit, persistence, orchestrator },
  port,
);

server.on("listening", () => {
  // eslint-disable-next-line no-console
  console.log(
    `settlement-backend :${port} — GET /health /audit /audit/stream /v1/gates — POST /v1/redemption/dry-run /submit /v1/settlement/process`,
  );
});
