"use client";

import { useEffect, type ReactNode } from "react";
import { useThemeStore } from "@/lib/store/themeStore";

/**
 * Componente cliente que sincroniza la clase `dark` en `<html>` con
 * `useThemeStore` (panel de Ajustes).
 *
 * Antes de este panel de Ajustes, `app/layout.tsx` aplicaba la clase
 * `dark` de forma estática (`className={"dark ..."}`), ya que el
 * Dashboard no tenía alternancia de tema. Ahora esa clase la controla
 * este componente en tiempo de ejecución: se suscribe a `useThemeStore`
 * y añade/quita `dark` de `document.documentElement` cada vez que
 * `theme` cambia, incluyendo la hidratación inicial desde `localStorage`
 * (el middleware `persist` de Zustand resuelve el valor persistido de
 * forma asíncrona tras el montaje, por lo que el primer render en el
 * cliente puede no coincidir todavía con la preferencia guardada; este
 * efecto corrige la clase en cuanto la hidratación completa).
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
