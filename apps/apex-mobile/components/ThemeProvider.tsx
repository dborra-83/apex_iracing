"use client";

import { useEffect, type ReactNode } from "react";
import { useThemeStore } from "@/lib/store/themeStore";

/**
 * Componente cliente que sincroniza la clase `dark` en `<html>` con
 * `useThemeStore` (panel de Ajustes), mismo patrón que
 * `apps/dashboard/components/ThemeProvider.tsx`.
 *
 * Se monta cerca de la raíz del árbol (ver `app/layout.tsx`), por encima
 * de `ConnectionProvider`, para que el tema se resuelva independientemente
 * del estado de la conexión WebSocket.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useThemeStore((state) => state.theme);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
  }, [theme]);

  return <>{children}</>;
}
