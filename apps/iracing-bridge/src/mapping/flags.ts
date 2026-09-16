import type { FlagV1 } from "@apex/contrato-datos";

/**
 * Bits del bitfield `SessionFlags` de iRacing (`irsdk_Flags` en la SDK
 * C++ nativa). No están expuestos como enum público en
 * `@irsdk-node/types` (que solo tipa `SessionFlags` como un número
 * plano), así que se definen aquí como constantes propias, verificadas
 * contra la fuente pública de la SDK.
 *
 * Fuente: [iFlag sdk.cs](https://github.com/simracer-cz/iFlag/blob/master/source/software/iFlag/sdk.cs),
 * que documenta los valores hexadecimales de `irsdk_Flags` tal como los
 * expone la SDK oficial de iRacing.
 */
const FLAG_CHECKERED = 0x00000001;
const FLAG_WHITE = 0x00000002;
const FLAG_GREEN = 0x00000004;
const FLAG_YELLOW = 0x00000008;
const FLAG_RED = 0x00000010;
const FLAG_YELLOW_WAVING = 0x00000100;
const FLAG_CAUTION = 0x00004000;
const FLAG_CAUTION_WAVING = 0x00008000;

/**
 * Traduce el bitfield `SessionFlags` a `FlagV1` (`"green" | "yellow" |
 * "red" | "checkered" | "white"`, ver `packages/contrato-datos/src/v1/session.ts`).
 *
 * `FlagV1` es deliberadamente un enum simple de 5 valores (heredado del
 * Generador_Demo), mientras que `SessionFlags` es un bitfield con
 * decenas de banderas simultáneas posibles (debris, black, disqualify,
 * start lights, etc.). Se prioriza en este orden — el más severo/
 * urgente primero — porque varias banderas pueden estar activas a la
 * vez (p. ej. `caution` + `yellowWaving` juntas durante una bandera
 * amarilla en curso) y el HUD solo puede mostrar una:
 *
 * 1. `checkered` (fin de sesión, máxima prioridad informativa)
 * 2. `red` (sesión detenida)
 * 3. `yellow`/`caution`/`yellowWaving` (precaución, cualquiera de los 3 bits)
 * 4. `white` (última vuelta)
 * 5. `green` (default también si no hay ningún bit reconocido, ya que
 *    `irsdk_noFlag` — el valor de "sin banderas" — no debe mostrarse
 *    como si la pista estuviera en peligro)
 */
export function mapFlag(sessionFlags: number): FlagV1 {
  if (sessionFlags & FLAG_CHECKERED) return "checkered";
  if (sessionFlags & FLAG_RED) return "red";
  if (sessionFlags & (FLAG_YELLOW | FLAG_CAUTION | FLAG_YELLOW_WAVING | FLAG_CAUTION_WAVING)) {
    return "yellow";
  }
  if (sessionFlags & FLAG_WHITE) return "white";
  if (sessionFlags & FLAG_GREEN) return "green";
  return "green";
}
