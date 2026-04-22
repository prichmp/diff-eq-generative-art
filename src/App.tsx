import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CanvasStage } from './components/CanvasStage';
import { ControlsPanel } from './components/ControlsPanel';
import { DEFAULT_SETTINGS } from './presets';
import { Animator } from './render/animator';
import { compileEquation } from './simulation/compileEquation';
import { SimulationWorker } from './simulation/workerClient';
import type { PackedSimulation, ProblemAndSettings } from './types';

export default function App() {
  const [settings, setSettings] = useState<ProblemAndSettings>(DEFAULT_SETTINGS);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('Ready.');
  const [needsRerender, setNeedsRerender] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animatorRef = useRef<Animator | null>(null);
  const workerRef = useRef<SimulationWorker | null>(null);
  const currentJobRef = useRef<{ cancel: () => void } | null>(null);
  const hasRenderedRef = useRef(false);

  const getWorker = useCallback(() => {
    if (!workerRef.current) workerRef.current = new SimulationWorker();
    return workerRef.current;
  }, []);

  const dxValid = useMemo(() => compileEquation(settings.dxExpr).ok, [settings.dxExpr]);
  const dyValid = useMemo(() => compileEquation(settings.dyExpr).ok, [settings.dyExpr]);
  const canRender = dxValid && dyValid && settings.xmax > settings.xmin;

  const patchSettings = useCallback((patch: Partial<ProblemAndSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  // Tear down animator and worker on unmount. Null the ref so a remount
  // (e.g. React StrictMode's double-invoke) recreates the worker instead of
  // reusing the terminated one.
  useEffect(() => {
    return () => {
      animatorRef.current?.dispose();
      animatorRef.current = null;
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  // Keep the canvas backing store in sync with its CSS size. The simulation
  // was integrated for a specific aspect ratio, so nudge the user to rerender
  // after any resize.
  useEffect(() => {
    const onResize = () => {
      animatorRef.current?.resize();
      if (hasRenderedRef.current) setNeedsRerender(true);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const stop = useCallback(() => {
    currentJobRef.current?.cancel();
    currentJobRef.current = null;
    animatorRef.current?.stop();
    setBusy(false);
  }, []);

  const startAnimation = useCallback(
    (sim: PackedSimulation, currentSettings: ProblemAndSettings) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      animatorRef.current?.dispose();
      const a = new Animator({ canvas, sim, settings: currentSettings });
      animatorRef.current = a;
      a.start();
    },
    [],
  );

  const render = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!canRender) return;
    const worker = getWorker();

    currentJobRef.current?.cancel();
    animatorRef.current?.stop();
    setBusy(true);
    setStatus('Starting…');
    setNeedsRerender(false);

    const rect = canvas.getBoundingClientRect();
    const aspect = rect.width / Math.max(1, rect.height);
    const snapshot = settings;

    const job = worker.run(snapshot, aspect, (frac) => {
      setStatus(`Simulating… ${(frac * 100).toFixed(0)}%`);
    });
    currentJobRef.current = job;

    try {
      const sim = await job.promise;
      currentJobRef.current = null;
      const paths = sim.offsets.length - 1;
      setStatus(`${paths} paths · ${sim.steps} steps`);
      startAnimation(sim, snapshot);
      hasRenderedRef.current = true;
    } catch (e) {
      const msg = (e as Error).message;
      if (msg !== 'Cancelled') setStatus(`Error: ${msg}`);
    } finally {
      setBusy(false);
    }
  }, [canRender, settings, startAnimation, getWorker]);

  // Auto-render on first mount.
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      render();
    });
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onRandomize = useCallback(() => {
    patchSettings({ seed: Math.floor(Math.random() * 1e9) });
  }, [patchSettings]);

  const onSavePng = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `diff-eq-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 'image/png');
  }, []);

  return (
    <div className="app">
      <ControlsPanel
        settings={settings}
        onChange={patchSettings}
        onRender={render}
        onStop={stop}
        onRandomize={onRandomize}
        onSavePng={onSavePng}
        busy={busy}
        status={status}
        canRender={canRender}
        notice={needsRerender ? 'Window was resized — click Render to rerun the simulation for the new aspect.' : null}
      />
      <CanvasStage ref={canvasRef} />
    </div>
  );
}
