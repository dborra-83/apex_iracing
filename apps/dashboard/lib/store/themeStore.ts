import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Theme = "dark" | "light";

interface ThemeState {
  /** Tema actualmente elegido por el usuario. Por defecto `"dark"` (el único tema que existía antes del panel de Ajustes). */
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

/**
 * Store de Zustand para el tema claro/oscuro del Dashboard (panel de
 * Ajustes, Requisito de configuración de apariencia).
 *
 * Persistido en `localStorage` vía el middleware `persist` de Zustand
 * (clave `"apex-dashboard-theme"`): la elección del usuario sobrevive a
 * recargas de página y a reinicios del navegador, sin depender de
 * `prefers-color-scheme` del sistema operativo (el usuario elige
 * explícitamente, no se infiere).
 *
 * `ThemeProvider` (ver `components/ThemeProvider.tsx`) es el único lugar
 * que LEE este store para aplicar/quitar la clase `dark` en `<html>`; el
 * resto de la app solo necesita `setTheme`/`toggleTheme` desde el panel
 * de Ajustes.
 */
export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: "dark",
      setTheme: (theme) => set({ theme }),
      toggleTheme: () => set({ theme: get().theme === "dark" ? "light" : "dark" }),
    }),
    { name: "apex-dashboard-theme" },
  ),
);
