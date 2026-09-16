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
 * Store de Zustand para el tema claro/oscuro de Apex Mobile (panel de
 * Ajustes), mismo patrón que `apps/dashboard/lib/store/themeStore.ts`.
 *
 * Persistido en `localStorage` (clave `"apex-mobile-theme"`, distinta de
 * la del Dashboard para que ambas apps recuerden su preferencia de forma
 * independiente incluso si se abren en el mismo navegador).
 */
export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: "dark",
      setTheme: (theme) => set({ theme }),
      toggleTheme: () => set({ theme: get().theme === "dark" ? "light" : "dark" }),
    }),
    { name: "apex-mobile-theme" },
  ),
);
