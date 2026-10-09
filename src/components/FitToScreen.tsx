"use client";

import { useLayoutEffect, useRef } from "react";

// The TV never scrolls: content is scaled up to fill the space it's given (up
// to `max`), or shrunk when it would overflow. The layout width is widened by
// the same factor, so scaled content always spans the full width.
export default function FitToScreen({ children, max = 2 }: { children: React.ReactNode; max?: number }) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const box = outer.current!;
    const content = inner.current!;
    let frame = 0;
    const fits = (scale: number) => {
      content.style.width = `${box.clientWidth / scale}px`;
      return content.offsetHeight * scale <= box.clientHeight;
    };
    function fit() {
      let low = 0.25;
      let high = max;
      if (fits(high)) low = high;
      else for (let step = 0; step < 12; step++) {
        const mid = (low + high) / 2;
        if (fits(mid)) low = mid; else high = mid;
      }
      fits(low);
      content.style.top = `${Math.max(0, (box.clientHeight - content.offsetHeight * low) / 2)}px`;
      content.style.transform = `scale(${low})`;
      content.dataset.scale = low.toFixed(2);
    }
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(fit); };
    // Watching the content too catches new questions, loaded images and fonts.
    // Our own resizing settles after one extra pass.
    const resize = new ResizeObserver(schedule);
    resize.observe(box);
    resize.observe(content);
    fit();
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
    };
  }, [max]);
  return <div ref={outer} className="relative min-h-0 flex-1 overflow-hidden">
    <div ref={inner} className="absolute left-0 top-0 flow-root origin-top-left">{children}</div>
  </div>;
}
