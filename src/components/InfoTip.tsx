import { useRef, useState } from 'react';

interface Props {
  text: string;
}

/**
 * A small circular "?" icon that shows a popover on hover/focus. Uses
 * position: fixed so the popover escapes the scrolling controls panel.
 */
export function InfoTip({ text }: Props) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number }>({ left: 0, top: 0 });
  const ref = useRef<HTMLSpanElement>(null);

  const show = () => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    setPos({ left: r.right + 6, top: r.top + r.height / 2 });
    setOpen(true);
  };
  const hide = () => setOpen(false);

  return (
    <>
      <span
        ref={ref}
        className="info-icon"
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        tabIndex={0}
        role="button"
        aria-label="More information"
      >
        ?
      </span>
      {open && (
        <div className="info-tip" style={{ left: pos.left, top: pos.top }} role="tooltip">
          {text}
        </div>
      )}
    </>
  );
}
