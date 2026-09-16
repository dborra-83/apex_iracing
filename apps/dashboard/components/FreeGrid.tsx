"use client";

import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { Move } from "lucide-react";
import type { WidgetRect } from "@/lib/store/layoutStore";

/**
 * FreeGrid: grilla de posicionamiento LIBRE (drag-and-drop + resize) para
 * los paneles del mosaico del Dashboard, mismo componente/enfoque que
 * `apps/apex-mobile/components/FreeGrid.tsx` (Pointer Events nativos,
 * sin librería de grid de terceros — ver esa implementación para el
 * razonamiento completo de la decisión de diseño).
 */
export interface FreeGridItem {
  id: string;
  rect: WidgetRect;
  content: ReactNode;
}

export interface FreeGridProps {
  items: FreeGridItem[];
  columns: number;
  rowHeightPx: number;
  minW: number;
  minH: number;
  isEditing: boolean;
  onRectChange: (id: string, rect: WidgetRect) => void;
}

type DragKind = "move" | "resize";

interface DragState {
  id: string;
  kind: DragKind;
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startRect: WidgetRect;
}

export default function FreeGrid({
  items,
  columns,
  rowHeightPx,
  minW,
  minH,
  isEditing,
  onRectChange,
}: FreeGridProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [cellWidthPx, setCellWidthPx] = useState(0);
  const [liveRect, setLiveRect] = useState<{ id: string; rect: WidgetRect } | null>(null);
  const dragRef = useRef<DragState | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setCellWidthPx(entry.contentRect.width / columns);
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [columns]);

  const gridHeightRows = Math.max(
    1,
    ...items.map((item) => {
      const rect = liveRect?.id === item.id ? liveRect.rect : item.rect;
      return rect.y + rect.h;
    }),
  );

  function clampRect(rect: WidgetRect): WidgetRect {
    const w = Math.max(minW, Math.min(columns, rect.w));
    const h = Math.max(minH, rect.h);
    const x = Math.max(0, Math.min(columns - w, rect.x));
    const y = Math.max(0, rect.y);
    return { x, y, w, h };
  }

  function handlePointerDown(
    event: PointerEvent<HTMLDivElement>,
    id: string,
    kind: DragKind,
    startRect: WidgetRect,
  ): void {
    if (!isEditing) return;
    event.preventDefault();
    event.stopPropagation();
    (event.target as HTMLElement).setPointerCapture(event.pointerId);
    dragRef.current = {
      id,
      kind,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startRect,
    };
    setLiveRect({ id, rect: startRect });
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>): void {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId || cellWidthPx === 0) return;

    const deltaXCols = Math.round((event.clientX - drag.startClientX) / cellWidthPx);
    const deltaYRows = Math.round((event.clientY - drag.startClientY) / rowHeightPx);

    const nextRect: WidgetRect =
      drag.kind === "move"
        ? clampRect({
            ...drag.startRect,
            x: drag.startRect.x + deltaXCols,
            y: drag.startRect.y + deltaYRows,
          })
        : clampRect({
            ...drag.startRect,
            w: drag.startRect.w + deltaXCols,
            h: drag.startRect.h + deltaYRows,
          });

    setLiveRect({ id: drag.id, rect: nextRect });
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>): void {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    (event.target as HTMLElement).releasePointerCapture(event.pointerId);
    if (liveRect !== null && liveRect.id === drag.id) {
      onRectChange(drag.id, liveRect.rect);
    }
    dragRef.current = null;
    setLiveRect(null);
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full"
      style={{ height: gridHeightRows * rowHeightPx }}
    >
      {items.map((item) => {
        const rect = liveRect?.id === item.id ? liveRect.rect : item.rect;
        return (
          <div
            key={item.id}
            className={`absolute overflow-hidden rounded-md border border-border bg-card ${
              isEditing ? "ring-1 ring-primary/50 ring-dashed" : ""
            }`}
            style={{
              left: rect.x * cellWidthPx,
              top: rect.y * rowHeightPx,
              width: rect.w * cellWidthPx,
              height: rect.h * rowHeightPx,
              touchAction: isEditing ? "none" : undefined,
            }}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          >
            <div className="h-full w-full overflow-hidden">{item.content}</div>

            {isEditing && (
              <>
                <div
                  className="absolute left-0 top-0 flex size-6 cursor-move items-center justify-center rounded-br-md bg-primary/80 text-primary-foreground"
                  style={{ touchAction: "none" }}
                  onPointerDown={(e) => handlePointerDown(e, item.id, "move", item.rect)}
                  aria-label="Mover panel"
                  role="button"
                >
                  <Move className="size-3.5" />
                </div>
                <div
                  className="absolute bottom-0 right-0 size-5 cursor-se-resize rounded-tl-md bg-primary/80"
                  style={{ touchAction: "none" }}
                  onPointerDown={(e) => handlePointerDown(e, item.id, "resize", item.rect)}
                  aria-label="Redimensionar panel"
                  role="button"
                />
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
