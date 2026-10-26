import type { TFunction } from 'i18next';

import { RequestError } from '@/api/client';
import { API_URL } from '@/api/config';

export function requestErrorMessage(t: TFunction, error: unknown): string {
  const code = error instanceof RequestError ? error.code : 'network';
  return t(`errors.${code}`, { url: API_URL, defaultValue: t('errors.generic') });
}
