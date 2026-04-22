/// <reference lib="webworker" />

import type { PackedSimulation, ProblemAndSettings } from '../types';
import { simulate } from './simulate';

export type WorkerRequest = {
  type: 'simulate';
  settings: ProblemAndSettings;
  aspect: number;
  id: number;
};

export type WorkerResponse =
  | { type: 'progress'; id: number; fraction: number }
  | { type: 'result'; id: number; result: PackedSimulation }
  | { type: 'error'; id: number; error: string };

const ctx = self as unknown as DedicatedWorkerGlobalScope;

ctx.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const msg = e.data;
  if (msg.type !== 'simulate') return;
  const { settings, aspect, id } = msg;

  const out = simulate(settings, aspect, (fraction) => {
    const progress: WorkerResponse = { type: 'progress', id, fraction };
    ctx.postMessage(progress);
  });

  if (!out.ok) {
    const err: WorkerResponse = { type: 'error', id, error: out.error };
    ctx.postMessage(err);
    return;
  }

  const r = out.result;
  const response: WorkerResponse = { type: 'result', id, result: r };
  ctx.postMessage(response, [r.points.buffer, r.offsets.buffer, r.seeds.buffer]);
};
