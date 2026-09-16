/**
 * Generador de números pseudoaleatorios (PRNG) con semilla explícita.
 *
 * Implementa el algoritmo mulberry32: rápido, simple, sin dependencias
 * externas y con buena distribución para simulación procedural. Dada la
 * misma semilla, sucesivas llamadas a `next()` producen siempre la misma
 * secuencia de valores (determinismo), lo que permite que el motor de
 * simulación sea reproducible (Requisito 6.1).
 */

/**
 * Interfaz mínima de un PRNG: expone un método `next()` que devuelve un
 * float en el rango [0, 1).
 */
export interface Rng {
  next(): number;
}

/**
 * Crea un PRNG determinístico (mulberry32) inicializado con `seed`.
 *
 * @param seed - Semilla numérica que determina la secuencia completa de
 *   valores generados. La misma semilla siempre produce la misma secuencia.
 */
export function createRng(seed: number): Rng {
  // Estado interno de 32 bits sin signo.
  let state = seed >>> 0;

  return {
    next(): number {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
  };
}

/**
 * Devuelve un float aleatorio en el rango [min, max) usando el `rng` dado.
 */
export function nextRange(rng: Rng, min: number, max: number): number {
  return min + rng.next() * (max - min);
}

/**
 * Devuelve un entero aleatorio en el rango [min, max] (ambos inclusive)
 * usando el `rng` dado.
 */
export function nextInt(rng: Rng, min: number, max: number): number {
  return Math.floor(nextRange(rng, min, max + 1));
}
