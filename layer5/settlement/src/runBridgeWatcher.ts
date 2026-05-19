import { loadRepoRootDotEnv } from "./loadRepoRootEnv.js";
import { startBridgeWatcherWorker } from "./workers/bridgeWatcherWorker.js";

loadRepoRootDotEnv();

const stop = startBridgeWatcherWorker();
process.on("SIGINT", () => {
  stop();
  process.exit(0);
});

console.log("bridge-watcher started");
