"use client";

import { useEffect, useState } from "react";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function useVirtualWindow(opts: {
  containerRef: React.RefObject<HTMLDivElement>;
  itemCount: number;
  rowHeight: number;
  overscan: number;
}) {
  const [scrollTop, setScrollTop] = useState(0);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const el = opts.containerRef.current;
    if (!el) return;
    const onScroll = () => setScrollTop(el.scrollTop);
    const ro = new ResizeObserver(() => setHeight(el.clientHeight));
    setHeight(el.clientHeight);
    el.addEventListener("scroll", onScroll, { passive: true });
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", onScroll);
      ro.disconnect();
    };
  }, [opts.containerRef]);

  const startIndex = Math.floor(scrollTop / opts.rowHeight);
  const visibleCount = Math.ceil(height / opts.rowHeight);
  const from = clamp(startIndex - opts.overscan, 0, Math.max(0, opts.itemCount - 1));
  const to = clamp(startIndex + visibleCount + opts.overscan, 0, opts.itemCount);
  const padTop = from * opts.rowHeight;
  const padBottom = Math.max(0, (opts.itemCount - to) * opts.rowHeight);
  return { from, to, padTop, padBottom };
}

