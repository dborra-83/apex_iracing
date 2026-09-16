import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Locale } from "@/lib/i18n/dictionary";

interface LocaleState {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

/**
 * Store de Zustand para el idioma elegido por el usuario del Dashboard
 * (panel de Ajustes), persistido en `localStorage` (clave
 * `"apex-dashboard-locale"`, independiente de la de Apex Mobile).
 */
export const useLocaleStore = create<LocaleState>()(
  persist(
    (set) => ({
      locale: "es",
      setLocale: (locale) => set({ locale }),
    }),
    { name: "apex-dashboard-locale" },
  ),
);
