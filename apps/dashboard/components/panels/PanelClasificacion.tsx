"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { StandingsEntryV1, StandingsEntryV1_1 } from "@apex/contrato-datos";
import { computeGaps, type DriverGaps } from "@apex/telemetry-core";
import { PanelHeader } from "@/components/hud/PanelHeader";
import { useStandingsStore } from "@/lib/store/standingsStore";
import { useSelectedDriverStore } from "@/lib/store/selectedDriverStore";
import {
  buildStandingsViewModel,
  groupStandingsByClass,
} from "@/lib/view-models/standings";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

/**
 * Paleta de acento por índice de clase (orden de primera aparición en el
 * Evento_Standings, ver `groupStandingsByClass`). Se reutilizan las
 * variables de tema `--chart-1`..`--chart-5` del HUD neón (Requisito 16.1)
 * para que cada clase tenga un color distintivo consistente con el resto
 * del Dashboard.
 */
const CLASS_ACCENT_CLASSES = [
  "border-(--chart-1) text-(--chart-1)",
  "border-(--chart-2) text-(--chart-2)",
  "border-(--chart-3) text-(--chart-3)",
  "border-(--chart-4) text-(--chart-4)",
  "border-(--chart-5) text-(--chart-5)",
] as const;

function classAccentClass(classIndex: number): string {
  return CLASS_ACCENT_CLASSES[classIndex % CLASS_ACCENT_CLASSES.length];
}

/**
 * Colores crudos por índice de clase (mismo orden que `CLASS_ACCENT_CLASSES`
 * / `SECTOR_COLORS` en Panel_Mapa), usados donde se necesita un valor CSS
 * directo en vez de una clase Tailwind (p. ej. `boxShadow`/`background`
 * inline de la fila divisoria de clase, meta de rediseño 5).
 */
const CLASS_ACCENT_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
] as const;

function classAccentColor(classIndex: number): string {
  return CLASS_ACCENT_COLORS[classIndex % CLASS_ACCENT_COLORS.length];
}

/**
 * Estilo de la insignia de posición (meta de rediseño 5): el top-3 recibe
 * un tratamiento dorado/plateado/bronce (colores fijos, independientes
 * del tema, ya que son un código de color universal de podio en
 * motorsport), y el resto de posiciones usa el color primario neón del
 * tema. Puramente presentacional: no reordena ni filtra pilotos.
 */
const PODIUM_BADGE_COLORS: Record<number, string> = {
  1: "oklch(0.85 0.15 95)",
  2: "oklch(0.82 0.02 260)",
  3: "oklch(0.68 0.13 55)",
};

function positionBadgeColor(position: number): string {
  return PODIUM_BADGE_COLORS[position] ?? "var(--primary)";
}

/**
 * Formatea un tiempo de vuelta en segundos (o `null` si el piloto todavía
 * no ha registrado ninguna) como `m:ss.mmm`, en línea con la tipografía
 * `.hud-number` del resto del HUD.
 */
function formatLapTime(seconds: number | null): string {
  if (seconds === null) {
    return "—";
  }
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds - minutes * 60;
  return `${minutes}:${remainder.toFixed(3).padStart(6, "0")}`;
}

/**
 * Formatea el gap respecto al líder/piloto de referencia con el signo
 * explícito habitual en clasificaciones de motorsport.
 *
 * También reutilizada para Gap_Adelante/Gap_Atras (Requisito 7.1): estos
 * valores pueden ser `null` (líder sin Gap_Adelante, último sin
 * Gap_Atras), en cuyo caso se muestra el mismo "—" que ya se usaba para un
 * gap de cero al líder.
 */
function formatGap(gap: number | null): string {
  if (gap === null || gap === 0) {
    return "—";
  }
  const sign = gap > 0 ? "+" : "";
  return `${sign}${gap.toFixed(3)}`;
}

/**
 * Panel_Clasificacion: tabla de clasificación multi-clase que se actualiza
 * de forma reactiva con cada nuevo Evento_Standings recibido por el
 * Dashboard.
 *
 * - Renderiza, para cada piloto, posición, clase, gap, última vuelta,
 *   mejor vuelta y estado en pits/fuera de pista (Requisito 10.1) usando
 *   el `Table` de shadcn/ui.
 * - Usa el view-model de `lib/view-models/standings.ts` para agrupar los
 *   pilotos contiguamente por clase y distingue cada clase visualmente
 *   mediante una fila divisoria con el `class_id` y un acento de color por
 *   clase (Requisito 10.2).
 * - Anima el reordenamiento de filas con Framer Motion: cada fila usa
 *   `driver_id` como `key` estable y el prop `layout` para que, al llegar
 *   un nuevo Evento_Standings con un orden distinto, las filas se desplacen
 *   suavemente hasta su nueva posición en vez de saltar (Requisito 10.3).
 */
export default function PanelClasificacion() {
  const latestEvent = useStandingsStore((state) => state.latestEvent);
  const selectedDriverId = useSelectedDriverStore((state) => state.selectedDriverId);
  const toggleDriver = useSelectedDriverStore((state) => state.toggleDriver);

  if (!latestEvent) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-muted-foreground">
        Esperando el primer Evento_Standings…
      </div>
    );
  }

  const groups = groupStandingsByClass(latestEvent);
  // Se conserva también la lista plana (Requisito 10.1) para futuros usos,
  // aunque el renderizado en sí itera por grupo para poder insertar la fila
  // divisoria de clase.
  buildStandingsViewModel(latestEvent);

  // Gap_Adelante / Gap_Atras (Requisito 7.1, 7.2): `computeGaps` solo lee
  // `position`/`gap`/`driver_id`, campos presentes tanto en
  // `StandingsEntryV1` (1.0.0) como en `StandingsEntryV1_1` (1.1.0) — su
  // firma exige `StandingsEntryV1_1[]` porque en la práctica el
  // Generador_Demo siempre emite 1.1.0, pero el cálculo en sí no depende
  // de los campos nuevos (Requisito 13.2), por lo que es seguro adaptar un
  // `StandingsEntryV1` (1.0.0) a la firma requerida.
  const gaps = computeGaps(latestEvent.drivers as StandingsEntryV1_1[]);
  const gapsByDriverId = new Map<string, DriverGaps>(
    gaps.map((driverGaps) => [driverGaps.driverId, driverGaps])
  );

  return (
    <div className="flex h-full flex-col gap-2 p-4">
      <PanelHeader title="Clasificación" />
      <div className="min-h-0 flex-1 overflow-x-auto overflow-y-auto rounded-md border border-border">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="hud-number py-1.5 text-[11px] tracking-wider text-muted-foreground uppercase">
                Pos
              </TableHead>
              <TableHead className="py-1.5 text-[11px] tracking-wider text-muted-foreground uppercase">
                Clase
              </TableHead>
              <TableHead className="hud-number py-1.5 text-[11px] tracking-wider text-muted-foreground uppercase">
                Gap
              </TableHead>
              <TableHead className="hud-number py-1.5 text-[11px] tracking-wider text-muted-foreground uppercase">
                Gap Adelante
              </TableHead>
              <TableHead className="hud-number py-1.5 text-[11px] tracking-wider text-muted-foreground uppercase">
                Gap Atrás
              </TableHead>
              <TableHead className="hud-number py-1.5 text-[11px] tracking-wider text-muted-foreground uppercase">
                Última vuelta
              </TableHead>
              <TableHead className="hud-number py-1.5 text-[11px] tracking-wider text-muted-foreground uppercase">
                Mejor vuelta
              </TableHead>
              <TableHead className="py-1.5 text-[11px] tracking-wider text-muted-foreground uppercase">
                Estado
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {groups.map((group, classIndex) => (
              <ClassGroupRows
                key={group.classId}
                classId={group.classId}
                drivers={group.drivers}
                accentClass={classAccentClass(classIndex)}
                accentColor={classAccentColor(classIndex)}
                gapsByDriverId={gapsByDriverId}
                selectedDriverId={selectedDriverId}
                onToggleDriver={toggleDriver}
              />
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

interface ClassGroupRowsProps {
  classId: string;
  drivers: StandingsEntryV1[];
  accentClass: string;
  accentColor: string;
  gapsByDriverId: Map<string, DriverGaps>;
  selectedDriverId: string | null;
  onToggleDriver: (id: string) => void;
}

/**
 * Renderiza la fila divisoria de una clase seguida de las filas animadas de
 * sus pilotos. Se extrae en su propio componente para mantener la clave de
 * `AnimatePresence`/`motion.tr` acotada al `driver_id` de cada piloto.
 *
 * La fila divisoria (meta de rediseño 5) ahora es una franja de color
 * sólido de ancho completo (fondo mezclado con el acento de la clase al
 * 22%, con un borde superior/inferior del color puro) en vez de una fila
 * apenas distinguible con `bg-muted/30`, para que el cambio de clase sea
 * inmediatamente evidente al recorrer visualmente la tabla, tal como en
 * las pantallas de timing de motorsport reales.
 */
function ClassGroupRows({
  classId,
  drivers,
  accentClass,
  accentColor,
  gapsByDriverId,
  selectedDriverId,
  onToggleDriver,
}: ClassGroupRowsProps) {
  return (
    <>
      <TableRow
        className="hover:bg-transparent"
        style={{
          backgroundColor: `color-mix(in oklch, ${accentColor}, transparent 82%)`,
          borderTop: `1px solid ${accentColor}`,
          borderBottom: `1px solid ${accentColor}`,
        }}
      >
        <TableCell
          colSpan={8}
          className={cn("hud-number py-1 text-xs tracking-wider uppercase", accentClass)}
        >
          Clase {classId}
        </TableCell>
      </TableRow>
      <AnimatePresence initial={false}>
        {drivers.map((driver) => {
          const isSelected = selectedDriverId === driver.driver_id;
          return (
            <motion.tr
              key={driver.driver_id}
              layout
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ type: "spring", stiffness: 500, damping: 40 }}
              data-slot="table-row"
              onClick={() => onToggleDriver(driver.driver_id)}
              aria-pressed={isSelected}
              className={cn(
                "cursor-pointer border-b transition-colors hover:bg-muted/50",
                isSelected && "bg-primary/15 hover:bg-primary/20",
              )}
              style={
                isSelected
                  ? { boxShadow: "inset 3px 0 0 0 var(--primary)" }
                  : undefined
              }
            >
              <TableCell className="py-1">
                <span
                  className="hud-number inline-flex size-6 items-center justify-center rounded-sm text-xs text-background"
                  style={{
                    backgroundColor: positionBadgeColor(driver.position),
                    boxShadow:
                      driver.position <= 3
                        ? `0 0 8px 1px ${positionBadgeColor(driver.position)}`
                        : undefined,
                  }}
                >
                  {driver.position}
                </span>
              </TableCell>
              <TableCell className={cn("py-1 text-xs", accentClass)}>
                {driver.class_id}
              </TableCell>
              <TableCell className="hud-number py-1">{formatGap(driver.gap)}</TableCell>
              <TableCell className="hud-number py-1">
                {formatGap(gapsByDriverId.get(driver.driver_id)?.gapAhead ?? null)}
              </TableCell>
              <TableCell className="hud-number py-1">
                {formatGap(gapsByDriverId.get(driver.driver_id)?.gapBehind ?? null)}
              </TableCell>
              <TableCell className="hud-number py-1">
                {formatLapTime(driver.last_lap_time)}
              </TableCell>
              <TableCell className="hud-number py-1">
                {formatLapTime(driver.best_lap_time)}
              </TableCell>
              <TableCell className="py-1">
                <DriverStatusBadge inPits={driver.in_pits} offTrack={driver.off_track} />
              </TableCell>
            </motion.tr>
          );
        })}
      </AnimatePresence>
    </>
  );
}

interface DriverStatusBadgeProps {
  inPits: boolean;
  offTrack: boolean;
}

/** Insignia de estado en pista: en pits, fuera de pista, o en pista. */
function DriverStatusBadge({ inPits, offTrack }: DriverStatusBadgeProps) {
  if (inPits) {
    return (
      <span className="rounded-sm border border-(--chart-3) px-1.5 py-0.5 text-xs text-(--chart-3)">
        PITS
      </span>
    );
  }
  if (offTrack) {
    return (
      <span className="rounded-sm border border-destructive px-1.5 py-0.5 text-xs text-destructive">
        OFF TRACK
      </span>
    );
  }
  return <span className="text-xs text-muted-foreground">En pista</span>;
}
