"use client";

import { useSyncExternalStore } from "react";

/**
 * Punto de quiebre (px) por debajo del cual el Dashboard se considera
 * "viewport angosto" (tablet/celular) y cambia de un mosaico libre
 * (`FreeGrid`, pensado para una pantalla de escritorio ancha con varios
 * paneles simultáneos lado a lado) a una única columna apilada de ancho
 * completo. Coincide con el breakpoint `md` de Tailwind (768px), el
 * mismo umbral que ya usa `AppHeader` para ocultar sus stats compactos
 * (`HeaderStat`), para que ambos cambios de densidad ocurran en el mismo
 * punto en vez de en umbrales distintos.
 */
const NARROW_BREAKPOINT_PX = 768;

/**
 * Hook de responsividad real para el Dashboard: hasta ahora el único
 * mecanismo de adaptación a pantallas angostas eran un par de `hidden
 * ...:flex`/`:inline` en `AppHeader` — el mosaico de paneles (`FreeGrid`)
 * no tenía ningún comportamiento distinto en tablet/celular, así que un
 * layout pensado para escritorio (varios paneles lado a lado, columnas
 * de grilla fijas) se apretaba en columnas cada vez más finas en vez de
 * apilarse.
 *
 * Usa `window.matchMedia` (no `ResizeObserver` sobre un contenedor: el
 * criterio es el viewport completo del navegador, no el tamaño de un
 * elemento) vía `useSyncExternalStore` — la API de React pensada
 * exactamente para suscribirse a una fuente de verdad externa (el
 * viewport del navegador) sin el patrón `useState` + `setState` dentro
 * de un `useEffect`, que dispara un render en cascada evitable. La
 * "snapshot" del servidor (`getServerSnapshot`) es `false`: el mosaico
 * de escritorio es el valor por defecto seguro para el render inicial en
 * el servidor/antes de la hidratación (no hay `window` ahí), y el
 * cambio a la vista apilada ocurre tan pronto el cliente puede evaluar
 * la media query real.
 */
const QUERY = `(max-width: ${NARROW_BREAKPOINT_PX - 1}px)`;

function subscribe(callback: () => void): () => void {
  const mediaQuery = window.matchMedia(QUERY);
  mediaQuery.addEventListener("change", callback);
  return () => mediaQuery.removeEventListener("change", callback);
}

function getSnapshot(): boolean {
  return window.matchMedia(QUERY).matches;
}

function getServerSnapshot(): boolean {
  return false;
}

export function useIsNarrowViewport(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
