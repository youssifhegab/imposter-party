import { useEffect, useState } from 'react';

import { fetchCategories } from '@/api/rooms';
import type { Category, WordLanguage } from '@/protocol/types';

/** Categories for [lang], or undefined while loading or if the request failed (Random still works). */
export function useCategories(lang: WordLanguage): Category[] | undefined {
  const [loaded, setLoaded] = useState<{ lang: WordLanguage; list: Category[] }>();
  useEffect(() => {
    let cancelled = false;
    fetchCategories(lang)
      .then((list) => !cancelled && setLoaded({ lang, list }))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [lang]);
  return loaded?.lang === lang ? loaded.list : undefined;
}
