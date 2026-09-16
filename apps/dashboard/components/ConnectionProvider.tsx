"use client";

import type { ReactNode } from "react";
import { useDashboardConnection } from "@/lib/ws-client/useDashboardConnection";

/**
 * Componente cliente que establece la Conexion_WebSocket con el
 * Generador_Demo en cuanto el Dashboard se monta (Requisito 14.1),
 * envolviendo `children` sin alterar su renderizado.
 *
 * Se monta desde `app/layout.tsx` (Server Component) para poder invocar
 * `useDashboardConnection`, que depende de APIs de navegador
 * (`WebSocket`, `requestAnimationFrame`) y por tanto requiere un límite
 * `"use client"`.
 */
export function ConnectionProvider({ children }: { children: ReactNode }) {
  useDashboardConnection();
  return <>{children}</>;
}
