import { useLocaleStore } from "@/lib/store/localeStore";
import { translate, type DictionaryKey } from "@/lib/i18n/dictionary";

/**
 * Hook de traducción del Dashboard, mismo patrón que
 * `apps/apex-mobile/lib/i18n/useTranslation.ts`.
 */
export function useTranslation(): { t: (key: DictionaryKey) => string } {
  const locale = useLocaleStore((state) => state.locale);
  return { t: (key: DictionaryKey) => translate(locale, key) };
}
