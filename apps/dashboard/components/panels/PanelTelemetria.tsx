"use client";

import { useEffect, useMemo, useRef, type ChangeEvent } from "react";
import { ChevronDown } from "lucide-react";
import type {
  StandingsEventV1,
  StandingsEventV1_1,
  TelemetryEventV1,
} from "@apex/contrato-datos";
import {
  compareSectorTimes,
  classifyDelta,
  statusVar,
  type SectorComparison,
} from "@apex/telemetry-core";
import { PanelHeader } from "@/components/hud/PanelHeader";
import { useTelemetryStore } from "@/lib/store/telemetryStore";
import { useStandingsStore } from "@/lib/store/standingsStore";
import {
  useCompletedLapsStore,
  type CompletedLap,
} from "@/lib/store/completedLapsStore";
import {
  useReferenceLapStore,
  type ReferenceLapId,
} from "@/lib/store/referenceLapStore";
import { useSelectedDriverStore } from "@/lib/store/selectedDriverStore";
import { buildTelemetrySeries } from "@/lib/view-models/telemetry-series";

/**
 * Panel_Telemetria (tareas 17.1 y 17.2): trace de throttle/brake de la
 * vuelta en curso, dibujado imperativamente en un `<canvas>`, con el
 * overlay opcional de una Vuelta_Referencia y el delta de sector.
 *
 * Estrategia de rendimiento a 60Hz (Requisitos 15.1, 15.2 / diseño
 * "Refs directos para el gráfico"): el `Evento_Telemetry` llega a
 * `useTelemetryStore` ya agrupado a 1 actualización por frame por el
 * batcher de la tarea 10.5. Este panel NO usa el hook reactivo
 * `useTelemetryStore()` para el trace en sí (que re-renderizaría el árbol
 * de React en cada actualización del store); en su lugar se suscribe
 * imperativamente con `useTelemetryStore.subscribe(...)` dentro de un
 * `useEffect` y empuja cada punto nuevo a un buffer circular
 * (`RingBuffer`) guardado en un `useRef`. Un bucle propio de
 * `requestAnimationFrame` lee ese buffer y dibuja el trace en el
 * `<canvas>` en cada frame, totalmente desacoplado del ciclo de render de
 * React (Requisito 17.4: canvas como enfoque de gráfico elegido en el
 * diseño para este panel).
 *
 * Tarea 17.1 cubrió únicamente el trace de throttle/brake de la vuelta
 * actual (Requisito 11.1). Esta tarea (17.2) añade, sobre el MISMO buffer
 * y el MISMO bucle de `requestAnimationFrame` (no se crea un segundo loop
 * competidor):
 *
 * - Captura de vueltas completadas: la suscripción imperativa también
 *   acumula los `Evento_Telemetry` de la vuelta en curso en un array
 *   aparte; al detectar el mismo cruce de línea de meta que reinicia el
 *   buffer de dibujo, esa serie se congela vía `buildTelemetrySeries`
 *   (tarea 12.5) y se archiva en `useCompletedLapsStore` (historial
 *   acotado de vueltas recientes).
 * - Selector de Vuelta_Referencia: un `<select>` nativo listando las
 *   vueltas completadas disponibles, que llama a
 *   `useReferenceLapStore.getState().selectReferenceLap(id)` al elegir
 *   una (Requisito 11.3).
 * - Overlay de la Vuelta_Referencia: el mismo `drawFrame` de la tarea
 *   17.1 dibuja además, con trazo discontinuo y colores distintos
 *   (`--chart-3`/`--chart-4`), el trace de la vuelta seleccionada como
 *   referencia (Requisito 11.3). `useReferenceLapStore` es
 *   deliberadamente independiente del pipeline de telemetría (ver su
 *   propio JSDoc), por lo que la selección NUNCA se pierde ni se reinicia
 *   cuando el buffer de la vuelta actual se reinicia en cada cruce de
 *   meta (Requisito 11.4).
 * - HUD de delta de sector: `delta_to_best`/`delta_to_prev` del último
 *   `Evento_Telemetry` se muestran como texto vía el hook reactivo normal
 *   `useTelemetryStore()` (Requisito 11.2). A diferencia del trace, esto
 *   son solo un par de etiquetas numéricas, no un redibujado de canvas,
 *   así que un re-render reactivo aquí es aceptable y no compite con el
 *   presupuesto de los 60Hz del gráfico.
 */

/** Capacidad fija del buffer circular de puntos del trace. */
const RING_BUFFER_CAPACITY = 2048;

/**
 * Umbrales de detección de cruce de meta: si `lap_dist_pct` cae de un
 * valor alto (cerca de 1, fin de vuelta) a uno bajo (cerca de 0, inicio
 * de vuelta) entre dos eventos consecutivos, se interpreta como el
 * comienzo de una nueva vuelta y el buffer se reinicia para que el trace
 * de cada vuelta empiece limpio.
 */
const LAP_WRAP_HIGH_THRESHOLD = 0.9;
const LAP_WRAP_LOW_THRESHOLD = 0.1;

/** Un punto crudo (throttle/brake) a insertar en el buffer circular. */
interface ThrottleBrakePoint {
  lapDistPct: number;
  throttle: number;
  brake: number;
}

/**
 * Buffer circular (ring buffer) de puntos {lap_dist_pct, throttle, brake}
 * respaldado por `TypedArray`s de tamaño fijo, para evitar asignaciones
 * dinámicas por frame. Vive fuera del estado de React (dentro de un
 * `useRef`) precisamente para no disparar re-renders a 60Hz.
 */
interface RingBuffer {
  lapDistPct: Float32Array;
  throttle: Float32Array;
  brake: Float32Array;
  /** Índice donde se escribirá el PRÓXIMO punto. */
  writeIndex: number;
  /** Cantidad de puntos válidos actualmente almacenados (<= capacity). */
  count: number;
  /** Último `lap_dist_pct` insertado, usado para detectar el cruce de meta. */
  lastLapDistPct: number | null;
}

function createRingBuffer(capacity: number): RingBuffer {
  return {
    lapDistPct: new Float32Array(capacity),
    throttle: new Float32Array(capacity),
    brake: new Float32Array(capacity),
    writeIndex: 0,
    count: 0,
    lastLapDistPct: null,
  };
}

function resetRingBuffer(buffer: RingBuffer): void {
  buffer.writeIndex = 0;
  buffer.count = 0;
}

/**
 * Determina si, al pasar de `previous` a `current`, se cruzó la línea de
 * meta (fin de una vuelta y comienzo de la siguiente).
 */
function isLapBoundaryCrossed(previous: number | null, current: number): boolean {
  if (previous === null) return false;
  return previous > LAP_WRAP_HIGH_THRESHOLD && current < LAP_WRAP_LOW_THRESHOLD;
}

/**
 * Formatea un delta de sector (`delta_to_best`/`delta_to_prev`) con el
 * signo explícito y 3 decimales habituales en los HUD de motorsport
 * (Requisito 11.2), o "—" cuando el valor es `null` (todavía no hay un
 * delta disponible para el punto actual).
 */
function formatDelta(delta: number | null): string {
  if (delta === null) return "—";
  const sign = delta > 0 ? "+" : delta < 0 ? "-" : "";
  return `${sign}${Math.abs(delta).toFixed(3)}`;
}

/**
 * Type guard que distingue un `Evento_Standings` en Version_Contrato_1_1
 * (`StandingsEventV1_1`, con `last_sector_times`/`best_sector_times` por
 * piloto) de uno en Version_Contrato_1_0 (`StandingsEventV1`, sin dichos
 * campos).
 *
 * La Comparativa_Sectores (tarea 10.1, Requisito 4.1) solo puede
 * calcularse cuando el Evento_Standings trae los tiempos de sector por
 * piloto; ante un evento v1.0.0 (Requisito 13.1) el sub-panel SHALL
 * mostrar un estado "no disponible" en vez de asumir valores por defecto.
 */
function isStandingsV1_1(
  event: StandingsEventV1 | StandingsEventV1_1
): event is StandingsEventV1_1 {
  return event.version_contrato === "1.1.0";
}

/**
 * Formatea un tiempo de sector individual en segundos con 3 decimales
 * (mismo formato que el resto del HUD, p. ej. `formatLapTime` de
 * Panel_Clasificacion), o "—" cuando el sector todavía no fue completado
 * (`null`).
 */
function formatSectorTime(seconds: number | null): string {
  if (seconds === null) return "—";
  return seconds.toFixed(3);
}

/** Texto literal mostrado cuando `deltaSeconds` es `null` (Requisito 4.3). */
const NO_DELTA_LABEL = "sin diferencia calculable";

/**
 * Determina el color de acento del delta de un sector de la
 * Comparativa_Sectores usando `classifyDelta`/`statusVar` de
 * `@apex/telemetry-core` (mismo vocabulario ok/warning/critical/neutral
 * que Apex Mobile — antes este componente usaba `--chart-4` para "más
 * rápido" mientras Apex Mobile usaba `--primary`, inconsistencia ya
 * corregida): verde/`--success` (más rápido, `deltaSeconds < 0`, ya que
 * `deltaSeconds = rivalTime - referenceTime`), rojo/`--destructive` o
 * ámbar/`--warning` según la magnitud (más lento, `deltaSeconds > 0`), o
 * el color neutro si no hay diferencia calculable.
 */
function sectorDeltaColor(deltaSeconds: number | null): string {
  return statusVar(classifyDelta(deltaSeconds));
}

/** Formatea `deltaSeconds` con signo explícito, o el texto de "sin diferencia calculable" (Requisito 4.3). */
function formatSectorDelta(deltaSeconds: number | null): string {
  if (deltaSeconds === null) return NO_DELTA_LABEL;
  const sign = deltaSeconds > 0 ? "+" : deltaSeconds < 0 ? "-" : "";
  return `${sign}${Math.abs(deltaSeconds).toFixed(3)}`;
}

/**
 * Inserta un punto nuevo en el buffer circular, reiniciándolo primero si
 * `boundaryCrossed` indica que el punto marca el comienzo de una nueva
 * vuelta.
 *
 * `boundaryCrossed` se calcula UNA sola vez por evento entrante en la
 * suscripción imperativa (tarea 17.2) reutilizando `isLapBoundaryCrossed`,
 * y se comparte con la lógica de captura de vueltas completadas (ver
 * `currentLapEventsRef` en el componente) para no evaluar el mismo cruce
 * de meta dos veces con criterios potencialmente distintos.
 */
function pushPoint(
  buffer: RingBuffer,
  point: ThrottleBrakePoint,
  boundaryCrossed: boolean
): void {
  if (boundaryCrossed) {
    resetRingBuffer(buffer);
  }

  const capacity = buffer.lapDistPct.length;
  buffer.lapDistPct[buffer.writeIndex] = point.lapDistPct;
  buffer.throttle[buffer.writeIndex] = point.throttle;
  buffer.brake[buffer.writeIndex] = point.brake;
  buffer.writeIndex = (buffer.writeIndex + 1) % capacity;
  buffer.count = Math.min(buffer.count + 1, capacity);
  buffer.lastLapDistPct = point.lapDistPct;
}

/**
 * Recorre los puntos válidos del buffer en orden cronológico (del más
 * antiguo al más reciente), sin asignar arrays intermedios.
 */
function forEachPoint(
  buffer: RingBuffer,
  callback: (lapDistPct: number, throttle: number, brake: number) => void
): void {
  const capacity = buffer.lapDistPct.length;
  const { count } = buffer;
  if (count === 0) return;
  const start = count < capacity ? 0 : buffer.writeIndex;
  for (let i = 0; i < count; i++) {
    const idx = (start + i) % capacity;
    callback(buffer.lapDistPct[idx], buffer.throttle[idx], buffer.brake[idx]);
  }
}

/**
 * Colores neón de las trazas, alineados con la paleta HUD del tema.
 * `referenceThrottle`/`referenceBrake` (tarea 17.2, Requisito 11.3) son
 * los colores del overlay de la Vuelta_Referencia, distintos de los de
 * la vuelta actual para poder distinguir visualmente ambos traces aunque
 * se dibujen ambos con línea discontinua.
 */
interface TraceColors {
  throttle: string;
  brake: string;
  referenceThrottle: string;
  referenceBrake: string;
  grid: string;
  placeholder: string;
}

/**
 * Lee los colores del tema (`--chart-1` cian para throttle, `--chart-2`
 * magenta para brake, `--chart-3`/`--chart-4` para el overlay de
 * referencia) desde las variables CSS ya definidas en `app/globals.css`,
 * para que el gráfico use la misma paleta neón que el resto del Dashboard
 * en vez de colores fijos duplicados.
 */
function readTraceColors(): TraceColors {
  if (typeof window === "undefined") {
    return {
      throttle: "#22d3ee",
      brake: "#ec4899",
      referenceThrottle: "#eab308",
      referenceBrake: "#4ade80",
      grid: "rgba(255,255,255,0.08)",
      placeholder: "rgba(255,255,255,0.4)",
    };
  }
  const styles = getComputedStyle(document.documentElement);
  const throttle = styles.getPropertyValue("--chart-1").trim() || "#22d3ee";
  const brake = styles.getPropertyValue("--chart-2").trim() || "#ec4899";
  const referenceThrottle = styles.getPropertyValue("--chart-3").trim() || "#eab308";
  const referenceBrake = styles.getPropertyValue("--chart-4").trim() || "#4ade80";
  return {
    throttle,
    brake,
    referenceThrottle,
    referenceBrake,
    grid: "rgba(255,255,255,0.08)",
    placeholder: "rgba(255,255,255,0.45)",
  };
}

/**
 * Dibuja el trace de una vuelta completada (`CompletedLap`, tarea 17.2)
 * usada como Vuelta_Referencia, con línea discontinua y colores propios
 * para distinguirla del trace de la vuelta en curso (Requisito 11.3).
 */
function drawReferenceTrace(
  ctx: CanvasRenderingContext2D,
  points: CompletedLap["points"],
  width: number,
  height: number,
  colors: TraceColors
): void {
  if (points.length === 0) return;

  const toX = (lapDistPct: number) => lapDistPct * width;
  const toY = (value: number) => height - value * height;

  ctx.save();
  ctx.setLineDash([6, 5]);
  ctx.lineWidth = 2;
  ctx.lineJoin = "round";

  ctx.strokeStyle = colors.referenceThrottle;
  ctx.beginPath();
  points.forEach((point, index) => {
    const x = toX(point.lapDistPct);
    const y = toY(point.throttle);
    if (index === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });
  ctx.stroke();

  ctx.strokeStyle = colors.referenceBrake;
  ctx.beginPath();
  points.forEach((point, index) => {
    const x = toX(point.lapDistPct);
    const y = toY(point.brake);
    if (index === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });
  ctx.stroke();

  ctx.restore();
}

/**
 * Dibuja un frame completo del trace de throttle/brake sobre el
 * contexto 2D del canvas, mapeando `lap_dist_pct` -> eje X y el valor
 * [0,1] de throttle/brake -> eje Y (Requisito 11.1), superponiendo
 * además el trace de la Vuelta_Referencia si hay una seleccionada y
 * disponible (`referenceLap`, Requisito 11.3). Ambos traces se dibujan
 * en el MISMO frame/bucle de `requestAnimationFrame`, sin un segundo loop
 * de dibujo competidor.
 */
function drawFrame(
  ctx: CanvasRenderingContext2D,
  buffer: RingBuffer,
  width: number,
  height: number,
  colors: TraceColors,
  referenceLap: CompletedLap | null
): void {
  ctx.clearRect(0, 0, width, height);
  if (width === 0 || height === 0) return;

  // Grid horizontal de referencia en 0 / 0.25 / 0.5 / 0.75 / 1.
  ctx.strokeStyle = colors.grid;
  ctx.lineWidth = 1;
  for (const fraction of [0, 0.25, 0.5, 0.75, 1]) {
    const y = height - fraction * height;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  if (referenceLap !== null) {
    drawReferenceTrace(ctx, referenceLap.points, width, height, colors);
  }

  if (buffer.count === 0) {
    ctx.fillStyle = colors.placeholder;
    ctx.font = "500 14px ui-sans-serif, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Esperando datos de telemetría...", width / 2, height / 2);
    return;
  }

  const toX = (lapDistPct: number) => lapDistPct * width;
  const toY = (value: number) => height - value * height;

  ctx.lineWidth = 2;
  ctx.lineJoin = "round";

  ctx.strokeStyle = colors.throttle;
  ctx.beginPath();
  let started = false;
  forEachPoint(buffer, (lapDistPct, throttle) => {
    const x = toX(lapDistPct);
    const y = toY(throttle);
    if (!started) {
      ctx.moveTo(x, y);
      started = true;
    } else {
      ctx.lineTo(x, y);
    }
  });
  ctx.stroke();

  ctx.strokeStyle = colors.brake;
  ctx.beginPath();
  started = false;
  forEachPoint(buffer, (lapDistPct, _throttle, brake) => {
    const x = toX(lapDistPct);
    const y = toY(brake);
    if (!started) {
      ctx.moveTo(x, y);
      started = true;
    } else {
      ctx.lineTo(x, y);
    }
  });
  ctx.stroke();
}

export default function PanelTelemetria() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bufferRef = useRef<RingBuffer>(createRingBuffer(RING_BUFFER_CAPACITY));

  // Eventos crudos de la vuelta EN CURSO, acumulados en paralelo al
  // buffer circular de dibujo (tarea 17.2, Requisitos 11.1, 11.2, 11.3).
  // Al cerrarse la vuelta (mismo cruce de meta que reinicia
  // `bufferRef`), esta serie se congela vía `buildTelemetrySeries` y se
  // archiva en `useCompletedLapsStore` para poder elegirla luego como
  // Vuelta_Referencia.
  const currentLapEventsRef = useRef<TelemetryEventV1[]>([]);
  // Contador local incremental para asignar un `id` a cada vuelta
  // capturada (Requisito 11.3). Es puramente local a este panel: ni el
  // Contrato_Datos ni el motor de simulación exponen un número de vuelta
  // explícito en el Evento_Telemetry.
  const nextLapIdRef = useRef<number>(0);

  // Suscripción imperativa al store: NO usar el hook reactivo
  // `useTelemetryStore()` aquí, ya que eso re-renderizaría este
  // componente (y su árbol) en cada actualización del store, justo lo
  // que este panel debe evitar a 60Hz (Requisitos 15.1, 15.2).
  useEffect(() => {
    const unsubscribe = useTelemetryStore.subscribe((state) => {
      const event = state.latestEvent;
      if (event === null) return;

      const buffer = bufferRef.current;
      const boundaryCrossed = isLapBoundaryCrossed(
        buffer.lastLapDistPct,
        event.lap_dist_pct
      );

      pushPoint(
        buffer,
        {
          lapDistPct: event.lap_dist_pct,
          throttle: event.throttle,
          brake: event.brake,
        },
        boundaryCrossed
      );

      if (boundaryCrossed && currentLapEventsRef.current.length > 0) {
        const completedLap: CompletedLap = {
          id: nextLapIdRef.current,
          lapTime:
            currentLapEventsRef.current[currentLapEventsRef.current.length - 1]
              .last_lap_time,
          points: buildTelemetrySeries(currentLapEventsRef.current),
        };
        nextLapIdRef.current += 1;
        useCompletedLapsStore.getState().addCompletedLap(completedLap);
        currentLapEventsRef.current = [];
      }

      currentLapEventsRef.current.push(event);
    });
    return unsubscribe;
  }, []);

  // Bucle de dibujo imperativo en <canvas> vía requestAnimationFrame,
  // independiente del ciclo de render de React (Requisito 17.4).
  useEffect(() => {
    const canvasEl = canvasRef.current;
    const containerEl = containerRef.current;
    if (!canvasEl || !containerEl) return;
    // Bindings no-nulos capturados una vez: TypeScript no puede seguir
    // garantizando la no-nulidad de `canvasRef.current` dentro de los
    // closures de abajo, así que se fijan estas referencias locales.
    const canvas: HTMLCanvasElement = canvasEl;
    const container: HTMLDivElement = containerEl;

    const ctx2d = canvas.getContext("2d");
    if (!ctx2d) return;
    const ctx: CanvasRenderingContext2D = ctx2d;

    const colors = readTraceColors();

    function resizeCanvas() {
      const dpr = window.devicePixelRatio || 1;
      const rect = container.getBoundingClientRect();
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
    }

    resizeCanvas();
    const resizeObserver = new ResizeObserver(resizeCanvas);
    resizeObserver.observe(container);

    let rafHandle: number;
    function tick() {
      // La selección de Vuelta_Referencia cambia raramente (acción
      // explícita del usuario), así que leer `.getState()` de ambos
      // stores en cada frame es simple y suficientemente eficiente: no
      // hace falta suscribirse imperativamente como con la telemetría a
      // 60Hz (Requisito 11.3, 11.4).
      const { referenceLapId } = useReferenceLapStore.getState();
      const referenceLap =
        referenceLapId === null
          ? null
          : useCompletedLapsStore
              .getState()
              .laps.find((lap) => lap.id === referenceLapId) ?? null;

      drawFrame(
        ctx,
        bufferRef.current,
        canvas.width,
        canvas.height,
        colors,
        referenceLap
      );
      rafHandle = requestAnimationFrame(tick);
    }
    rafHandle = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafHandle);
      resizeObserver.disconnect();
    };
  }, []);

  // Estos dos hooks reactivos son deliberadamente livianos: la lista de
  // vueltas completadas y la selección de referencia cambian con poca
  // frecuencia (una vez por vuelta / por interacción del usuario), no a
  // 60Hz, así que re-renderizar este selector con `useCompletedLapsStore`
  // y `useReferenceLapStore` no compite con el presupuesto de dibujo del
  // canvas (Requisito 11.3).
  const completedLaps = useCompletedLapsStore((state) => state.laps);
  const referenceLapId = useReferenceLapStore((state) => state.referenceLapId);
  // HUD de delta de sector (Requisito 11.2): solo un par de etiquetas de
  // texto, así que el hook reactivo normal `useTelemetryStore()` es
  // aceptable aquí (no dibuja en el canvas).
  const latestEvent = useTelemetryStore((state) => state.latestEvent);

  function handleReferenceLapChange(
    event: ChangeEvent<HTMLSelectElement>
  ): void {
    const { value } = event.target;
    const id: ReferenceLapId | null = value === "" ? null : Number(value);
    useReferenceLapStore.getState().selectReferenceLap(id);
  }

  // Comparativa_Sectores (tarea 10.1, Requisito 4): la clasificación se
  // actualiza a 1-5Hz (mucho más lenta que la telemetría a 60Hz), así que
  // el hook reactivo normal `useStandingsStore()` es aceptable aquí y no
  // compite con el bucle de dibujo del canvas.
  const standingsEvent = useStandingsStore((state) => state.latestEvent);
  // El rival seleccionado vive en `useSelectedDriverStore`, compartido con
  // `Panel_Clasificacion` y `Panel_Mapa`: un click en la fila de un piloto
  // en Clasificación o en su marcador en el Mapa selecciona
  // automáticamente ese mismo piloto aquí como rival de la
  // Comparativa_Sectores, sin que el usuario tenga que volver a elegirlo
  // en el `<select>` de abajo. La relación es bidireccional: elegir un
  // rival desde este `<select>` también actualiza el store compartido,
  // por lo que ese piloto queda resaltado en los otros dos paneles.
  const selectedRivalId = useSelectedDriverStore((state) => state.selectedDriverId);
  const selectDriver = useSelectedDriverStore((state) => state.selectDriver);

  function handleRivalChange(event: ChangeEvent<HTMLSelectElement>): void {
    const { value } = event.target;
    selectDriver(value === "" ? null : value);
  }

  // Lista de rivales disponibles en el selector: todos los pilotos del
  // Evento_Standings_Ampliado excepto el Piloto_Observado (Requisito 4.1).
  // Solo tiene sentido ofrecer rivales cuando el evento trae los tiempos
  // de sector por piloto (Version_Contrato_1_1); ante un evento v1.0.0 la
  // lista queda vacía y el sub-panel muestra su estado "no disponible"
  // (Requisito 13.1).
  const observedDriverId = latestEvent?.driver_id ?? null;
  const rivalOptions =
    standingsEvent !== null && isStandingsV1_1(standingsEvent)
      ? standingsEvent.drivers.filter((driver) => driver.driver_id !== observedDriverId)
      : [];

  // Comparativa de sectores del rival seleccionado contra el Piloto_Observado
  // (Requisito 4.2): se invoca `compareSectorTimes` con los
  // `last_sector_times` de ambos, sin tocar el trace de throttle/brake ya
  // existente (que sigue dibujándose desde el ring buffer, más abajo).
  const sectorComparison: SectorComparison[] | null = useMemo(() => {
    if (standingsEvent === null || !isStandingsV1_1(standingsEvent)) return null;
    if (observedDriverId === null || selectedRivalId === null) return null;

    const observedEntry = standingsEvent.drivers.find(
      (driver) => driver.driver_id === observedDriverId
    );
    const rivalEntry = standingsEvent.drivers.find(
      (driver) => driver.driver_id === selectedRivalId
    );
    if (!observedEntry || !rivalEntry) return null;

    return compareSectorTimes(
      observedEntry.last_sector_times,
      rivalEntry.last_sector_times
    );
  }, [standingsEvent, observedDriverId, selectedRivalId]);

  return (
    <div className="flex h-full flex-col gap-3 p-4">
      <PanelHeader title="Telemetría" />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="hud-number flex items-center gap-4 text-[11px] tracking-wide text-muted-foreground uppercase">
          <LegendSwatch color="var(--chart-1)" label="Throttle" />
          <LegendSwatch color="var(--chart-2)" label="Brake" />
          {referenceLapId !== null && (
            <>
              <LegendSwatch color="var(--chart-3)" label="Throttle ref." dashed />
              <LegendSwatch color="var(--chart-4)" label="Brake ref." dashed />
            </>
          )}
        </div>

        {/*
         * Selector de Vuelta_Referencia (meta de rediseño 7): un
         * `<select>` nativo sigue siendo suficiente dado el alcance de
         * este rediseño (evitar introducir un componente de listbox
         * personalizado solo por estética), pero se le da un tratamiento
         * HUD deliberado: fondo oscuro, borde con resplandor sutil al
         * enfocar, tipografía condensada y un ícono `ChevronDown`
         * superpuesto en vez de la flecha nativa del navegador.
         */}
        <label className="hud-number flex items-center gap-2 text-[11px] tracking-wide text-muted-foreground uppercase">
          Vuelta_Referencia
          <span className="relative inline-flex items-center">
            <select
              className="hud-number appearance-none rounded-md border border-border bg-card px-2 py-1 pr-6 text-xs text-foreground transition-shadow focus-visible:border-primary focus-visible:hud-glow-primary-sm focus-visible:outline-none"
              value={referenceLapId ?? ""}
              onChange={handleReferenceLapChange}
            >
              <option value="">Ninguna</option>
              {completedLaps.map((lap) => (
                <option key={lap.id} value={lap.id}>
                  Vuelta #{lap.id} ·{" "}
                  {lap.lapTime !== null ? `${lap.lapTime.toFixed(3)}s` : "—"}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-1.5 size-3.5 text-muted-foreground" />
          </span>
        </label>

        {/*
         * Selector de rival (tarea 10.1, Requisito 4.1): mismo tratamiento
         * HUD que el selector de Vuelta_Referencia de arriba, listando
         * `rivalOptions` (todos los pilotos del Evento_Standings_Ampliado
         * salvo el Piloto_Observado). Ante un evento v1.0.0 (sin tiempos de
         * sector por piloto) o sin standings aún, `rivalOptions` queda
         * vacía y el `<select>` solo ofrece "Ninguno" (Requisito 13.1).
         */}
        <label className="hud-number flex items-center gap-2 text-[11px] tracking-wide text-muted-foreground uppercase">
          Rival
          <span className="relative inline-flex items-center">
            <select
              className="hud-number appearance-none rounded-md border border-border bg-card px-2 py-1 pr-6 text-xs text-foreground transition-shadow focus-visible:border-primary focus-visible:hud-glow-primary-sm focus-visible:outline-none"
              value={selectedRivalId ?? ""}
              onChange={handleRivalChange}
            >
              <option value="">Ninguno</option>
              {rivalOptions.map((driver) => (
                <option key={driver.driver_id} value={driver.driver_id}>
                  Piloto {driver.driver_id}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-1.5 size-3.5 text-muted-foreground" />
          </span>
        </label>
      </div>

      <div className="flex items-center gap-6 text-[11px] tracking-wide text-muted-foreground uppercase">
        <span className="flex items-center gap-1.5">
          Delta vs. mejor
          <span className="hud-number text-sm text-primary hud-text-glow">
            {formatDelta(latestEvent?.delta_to_best ?? null)}
          </span>
        </span>
        <span className="flex items-center gap-1.5">
          Delta vs. anterior
          <span className="hud-number text-sm text-accent hud-text-glow">
            {formatDelta(latestEvent?.delta_to_prev ?? null)}
          </span>
        </span>
      </div>

      {/*
       * Comparativa_Sectores (tarea 10.1/10.2, Requisitos 4.1, 4.2, 4.3,
       * 4.4, 13.1): sub-panel siempre visible (sin colapsar) que muestra,
       * sector a sector, el tiempo del Piloto_Observado, el del rival
       * seleccionado y el delta entre ambos. No toca `drawFrame`, el ring
       * buffer, ni el bucle de `requestAnimationFrame` del trace de
       * throttle/brake de más abajo.
       */}
      <div className="rounded-lg border border-border bg-card p-3">
        <div className="hud-number mb-2 text-[11px] tracking-wide text-muted-foreground uppercase">
          Comparativa de sectores
        </div>
        {sectorComparison === null ? (
          <p className="text-xs text-muted-foreground">
            {selectedRivalId === null
              ? "Selecciona un rival para comparar sectores."
              : "Comparativa no disponible."}
          </p>
        ) : (
          <table className="w-full">
            <thead>
              <tr>
                <th className="hud-number py-1 text-left text-[11px] tracking-wider text-muted-foreground uppercase">
                  Sector
                </th>
                <th className="hud-number py-1 text-left text-[11px] tracking-wider text-muted-foreground uppercase">
                  Observado
                </th>
                <th className="hud-number py-1 text-left text-[11px] tracking-wider text-muted-foreground uppercase">
                  Rival
                </th>
                <th className="hud-number py-1 text-left text-[11px] tracking-wider text-muted-foreground uppercase">
                  Delta
                </th>
              </tr>
            </thead>
            <tbody>
              {sectorComparison.map((sector) => (
                <tr key={sector.sectorIndex}>
                  <td className="hud-number py-0.5 text-xs text-foreground">
                    S{sector.sectorIndex + 1}
                  </td>
                  <td className="hud-number py-0.5 text-xs text-foreground">
                    {formatSectorTime(sector.referenceTime)}
                  </td>
                  <td className="hud-number py-0.5 text-xs text-foreground">
                    {formatSectorTime(sector.rivalTime)}
                  </td>
                  <td
                    className="hud-number py-0.5 text-xs"
                    style={{ color: sectorDeltaColor(sector.deltaSeconds) }}
                  >
                    {formatSectorDelta(sector.deltaSeconds)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/*
       * Marco del gráfico con etiquetas de eje (meta de rediseño 7): se
       * añade un pequeño overlay HTML/CSS con las etiquetas 0%/25%/…/100%
       * de ambos ejes, superpuesto sobre el `<canvas>` mediante
       * posicionamiento absoluto. Esto es puramente cosmético — no toca
       * `drawFrame`, el ring buffer, ni ningún cálculo del trace — y usa
       * las mismas fracciones (`AXIS_TICKS`) que ya dibuja `drawFrame`
       * para la grilla horizontal, para que las etiquetas queden
       * alineadas con las líneas de grid existentes.
       */}
      <div
        ref={containerRef}
        className="relative min-h-[280px] flex-1 rounded-lg bg-card ring-1 ring-foreground/10"
      >
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
        <div className="pointer-events-none absolute inset-y-0 left-0 flex flex-col justify-between py-1 pl-1.5">
          {AXIS_TICKS.map((fraction) => (
            <span
              key={fraction}
              className="hud-number text-[10px] text-muted-foreground/70"
            >
              {Math.round(fraction * 100)}%
            </span>
          ))}
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-between px-2 pb-1">
          {AXIS_TICKS.map((fraction) => (
            <span
              key={fraction}
              className="hud-number text-[10px] text-muted-foreground/70"
            >
              {Math.round(fraction * 100)}%
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Fracciones del eje mostradas como etiquetas, coincidentes con la grilla dibujada por `drawFrame`. */
const AXIS_TICKS = [0, 0.25, 0.5, 0.75, 1] as const;

interface LegendSwatchProps {
  color: string;
  label: string;
  dashed?: boolean;
}

/** Ítem de leyenda del trace (color + etiqueta), con trazo discontinuo opcional para el overlay de referencia. */
function LegendSwatch({ color, label, dashed = false }: LegendSwatchProps) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        className="inline-block h-2 w-2 rounded-full"
        style={{
          backgroundColor: color,
          boxShadow: `0 0 5px 0px ${color}`,
          outline: dashed ? `1px dashed ${color}` : undefined,
          outlineOffset: dashed ? 2 : undefined,
        }}
      />
      {label}
    </span>
  );
}
