import type { PackedSimulation, ProblemAndSettings } from '../types';
import type { WorkerRequest, WorkerResponse } from './worker';
// Vite-specific ?worker import: returns a Worker constructor.
import SimWorker from './worker?worker';

export interface SimJob {
  onProgress?: (fraction: number) => void;
  promise: Promise<PackedSimulation>;
  cancel: () => void;
}

interface PendingEntry {
  resolve: (r: PackedSimulation) => void;
  reject: (e: Error) => void;
  onProgress?: (fraction: number) => void;
}

export class SimulationWorker {
  private worker: Worker;
  private nextId = 1;
  private pending = new Map<number, PendingEntry>();
  private terminated = false;

  constructor() {
    this.worker = new SimWorker();
    this.installHandlers();
  }

  private installHandlers() {
    this.worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      const msg = e.data;
      const entry = this.pending.get(msg.id);
      if (!entry) return;
      if (msg.type === 'progress') {
        entry.onProgress?.(msg.fraction);
      } else if (msg.type === 'result') {
        this.pending.delete(msg.id);
        entry.resolve(msg.result);
      } else if (msg.type === 'error') {
        this.pending.delete(msg.id);
        entry.reject(new Error(msg.error));
      }
    };
    this.worker.onerror = (e) => {
      for (const [id, entry] of this.pending) {
        entry.reject(new Error(e.message || 'Worker error'));
        this.pending.delete(id);
      }
    };
  }

  /**
   * Kill the current worker thread and spin up a fresh one. Used to abort
   * in-flight simulations immediately rather than letting them run to
   * completion (which holds worker memory and CPU even after the job is
   * considered "cancelled" on the main thread).
   */
  private resetWorker() {
    this.worker.terminate();
    // Reject any outstanding jobs — should be none or just the one being
    // cancelled, but clear defensively.
    for (const [, e] of this.pending) e.reject(new Error('Cancelled'));
    this.pending.clear();
    if (this.terminated) return;
    this.worker = new SimWorker();
    this.installHandlers();
  }

  run(
    settings: ProblemAndSettings,
    aspect: number,
    onProgress?: (fraction: number) => void,
  ): SimJob {
    if (this.terminated) {
      return {
        promise: Promise.reject(new Error('Worker terminated')),
        cancel: () => {},
      };
    }
    const id = this.nextId++;
    const promise = new Promise<PackedSimulation>((resolve, reject) => {
      this.pending.set(id, { resolve, reject, onProgress });
      const req: WorkerRequest = { type: 'simulate', settings, aspect, id };
      this.worker.postMessage(req);
    });
    return {
      promise,
      onProgress,
      cancel: () => {
        const entry = this.pending.get(id);
        if (!entry) return;
        // Kill the underlying thread so the in-flight simulate() call stops
        // immediately and its intermediate buffers are freed. A fresh worker
        // replaces it so the next run() works.
        this.pending.delete(id);
        this.resetWorker();
        entry.reject(new Error('Cancelled'));
      },
    };
  }

  terminate() {
    this.terminated = true;
    this.worker.terminate();
    for (const [, entry] of this.pending) entry.reject(new Error('Worker terminated'));
    this.pending.clear();
  }
}
