/**
 * In-process event bus for Scan-to-URL document arrivals.
 * Scanner route emits here; SSE endpoint listens and pushes to browser clients.
 */
import { EventEmitter } from "node:events";

export interface ScanEvent {
  docId: number;
  fileName: string;
}

class ScannerEventBus extends EventEmitter {}
export const scannerBus = new ScannerEventBus();
scannerBus.setMaxListeners(200); // allow many concurrent SSE clients
