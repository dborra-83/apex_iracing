import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Locale } from "@/lib/i18n/dictionary";

interface LocaleState {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

/**
 * Store de Zustand para el idioma elegido por el usuario (panel de
 * Ajustes), persistido en `localStorage` (clave `"apex-mobile-locale"`).
 *
 * Por defecto `"es"`: el resto de la app (labels de componentes,
 * documentación) ya está en español, así que ese es el idioma nativo del
 * producto; `"en"` es la alternativa ofrecida por el panel de Ajustes.
 */
export const useLocaleStore = create<LocaleState>()(
  persist(
    (set) => ({
      locale: "es",
      setLocale: (locale) => set({ locale }),
    }),
    { name: "apex-mobile-locale" },
  ),
);
