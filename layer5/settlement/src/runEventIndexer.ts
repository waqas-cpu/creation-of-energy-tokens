import { loadRepoRootDotEnv } from "./loadRepoRootEnv.js";
import { startEventIndexerWorker } from "./workers/eventIndexerWorker.js";

loadRepoRootDotEnv();

const packageId = process.env.L5_PACKAGE_ID?.trim();
if (!packageId) {
  console.error("L5_PACKAGE_ID required for event indexer");
  process.exit(1);
}

const stop = startEventIndexerWorker(packageId);
process.on("SIGINT", () => {
  stop();
  process.exit(0);
});

console.log(`event-indexer started for package ${packageId}`);
