"use client";

import type { ReactNode } from "react";
import { useApexMobileConnection } from "@/lib/ws-client/useApexMobileConnection";

/**
 * Componente cliente que establece la Conexion_WebSocket con el
 * Generador_Demo en cuanto Apex Mobile se monta (tarea 17.1/17.3,
 * Requisito 12.5, 8.4), envolviendo `children` sin alterar su
 * renderizado.
 *
 * Se monta desde `app/layout.tsx` (Server Component) para poder invocar
 * `useApexMobileConnection`, que depende de APIs de navegador
 * (`WebSocket`, `requestAnimationFrame`) y por tanto requiere un límite
 * `"use client"`. Al vivir en el layout raíz (por encima de `page.tsx`,
 * la única Pantalla_Principal), un cambio de orientación
 * portrait↔landscape jamás desmonta este componente ni la conexión que
 * establece: solo `page.tsx` reacciona a la orientación (vía CSS), la
 * conexión y los stores permanecen intactos (Requisito 8.4).
 */
export function ConnectionProvider({ children }: { children: ReactNode }) {
  useApexMobileConnection();
  return <>{children}</>;
}
