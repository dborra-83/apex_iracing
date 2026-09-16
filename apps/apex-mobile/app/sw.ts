import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist } from "serwist";

/**
 * Código fuente del Service Worker de Apex Mobile (tarea 16.2, Requisito
 * 8.2), compilado por `@serwist/next` (ver `next.config.ts`) a
 * `public/sw.js` durante `next build`.
 *
 * `injectionPoint` (declarado implícitamente por `SerwistGlobalConfig`)
 * es el marcador que Serwist reemplaza en tiempo de build con la lista
 * real de assets a precachear (`self.__SW_MANIFEST`); no se edita a
 * mano.
 *
 * Si el registro del Service Worker falla (navegador sin soporte), la
 * app SHALL seguir funcionando como página web normal sin capacidad
 * offline/instalable (ver design.md, "Error Handling"): esta app no
 * bloquea su propio renderizado en ese registro, ya que
 * `RootLayout`/`page.tsx` no dependen de que el Service Worker exista.
 */
declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
});

serwist.addEventListeners();
