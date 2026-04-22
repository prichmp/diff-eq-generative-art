import { forwardRef } from 'react';

interface Props {
  onResize?: () => void;
}

export const CanvasStage = forwardRef<HTMLCanvasElement, Props>(function CanvasStage(
  _props,
  ref,
) {
  return (
    <div className="stage">
      <canvas ref={ref} />
    </div>
  );
});
