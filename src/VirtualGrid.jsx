import { useEffect, useMemo, useRef, useState } from "react";

export default function VirtualGrid({
  items,
  renderItem,
  minItemWidth = 240,
  gap = 16,
  estimateHeight = 340,
  className = "",
  threshold = 36,
}) {
  const scrollerRef = useRef(null);
  const [metrics, setMetrics] = useState({ width: 0, height: 560, scrollTop: 0 });

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return undefined;
    const update = () => {
      setMetrics((prev) => ({
        ...prev,
        width: el.clientWidth,
        height: el.clientHeight,
      }));
    };
    const onScroll = () => {
      setMetrics((prev) => ({ ...prev, scrollTop: el.scrollTop }));
    };
    const ro = new ResizeObserver(update);
    ro.observe(el);
    el.addEventListener("scroll", onScroll, { passive: true });
    update();
    return () => {
      ro.disconnect();
      el.removeEventListener("scroll", onScroll);
    };
  }, [items.length]);

  const cols = useMemo(() => {
    const w = metrics.width || 1;
    return Math.max(1, Math.floor((w + gap) / (minItemWidth + gap)));
  }, [metrics.width, gap, minItemWidth]);

  if (!items.length) return null;

  if (items.length <= threshold) {
    return (
      <div className={`nodes ${className}`.trim()}>
        {items.map((item, index) => renderItem(item, index))}
      </div>
    );
  }

  const rowHeight = estimateHeight + gap;
  const rows = Math.ceil(items.length / cols);
  const startRow = Math.max(0, Math.floor(metrics.scrollTop / rowHeight) - 2);
  const visibleRows = Math.ceil((metrics.height || 560) / rowHeight) + 4;
  const endRow = Math.min(rows, startRow + visibleRows);
  const padTop = startRow * rowHeight;
  const padBottom = Math.max(0, (rows - endRow) * rowHeight);
  const slice = [];
  for (let row = startRow; row < endRow; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const index = row * cols + col;
      if (index < items.length) slice.push({ item: items[index], index });
    }
  }

  return (
    <div
      ref={scrollerRef}
      className="virtual-grid-scroller"
      style={{ maxHeight: "min(70vh, 820px)" }}
    >
      <div style={{ height: padTop }} />
      <div
        className={`nodes virtual-grid-window ${className}`.trim()}
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {slice.map(({ item, index }) => renderItem(item, index))}
      </div>
      <div style={{ height: padBottom }} />
    </div>
  );
}
