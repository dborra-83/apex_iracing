import { useLocaleStore } from "@/lib/store/localeStore";
import { translate, type DictionaryKey } from "@/lib/i18n/dictionary";

/**
 * Hook de traducción: devuelve una función `t(key)` ligada al idioma
 * actual (`useLocaleStore`). Se suscribe al store para que un cambio de
 * idioma desde el panel de Ajustes re-renderice automáticamente todo
 * componente que use este hook.
 */
export function useTranslation(): { t: (key: DictionaryKey) => string } {
  const locale = useLocaleStore((state) => state.locale);
  return { t: (key: DictionaryKey) => translate(locale, key) };
}
