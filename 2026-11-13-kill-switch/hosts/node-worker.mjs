// Node adapter for ModelGuestWorker (the d.ts says Node worker_threads "need a small adapter").
import { parentPort } from "node:worker_threads";
import { createModelGuestHandler } from "traverse-embedder-web";
const handle = createModelGuestHandler();
parentPort.on("message", ({ id, request }) => { void handle(request).then((reply) => parentPort.postMessage({ id, reply })); });
