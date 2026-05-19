import { loadRepoRootDotEnv } from "./loadRepoRootEnv.js";
import { runGateChecklist } from "./gates/gateChecklist.js";

loadRepoRootDotEnv();

const checklist = await runGateChecklist({
  withRpc: process.env.GATE_CHECK_RPC === "true",
});

console.log(JSON.stringify(checklist, null, 2));
process.exit(checklist.ready ? 0 : 1);
