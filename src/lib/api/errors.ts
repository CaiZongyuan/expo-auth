import { isAxiosError } from 'axios';

export type NormalizedApiError = {
  status: number | null;
  message: string;
  detail?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function extractFastApiDetailMessage(detail: unknown): string | null {
  if (typeof detail === 'string') return detail;

  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) => (isRecord(item) && typeof item.msg === 'string' ? item.msg : null))
      .filter((m): m is string => Boolean(m));

    if (messages.length > 0) return messages.join('\n');
  }

  return null;
}

export function normalizeApiError(error: unknown): NormalizedApiError {
  if (isAxiosError(error)) {
    const status = error.response?.status ?? null;
    const data = error.response?.data;

    if (typeof data === 'string') {
      return { status, message: data };
    }

    if (isRecord(data)) {
      if (typeof data.message === 'string') {
        return { status, message: data.message, detail: data };
      }

      if ('detail' in data) {
        const message = extractFastApiDetailMessage(data.detail) ?? 'Request failed';
        return { status, message, detail: data.detail };
      }
    }

    return { status, message: error.message || 'Request failed' };
  }

  if (error instanceof Error) {
    return { status: null, message: error.message };
  }

  return { status: null, message: 'Unknown error' };
}

export function getApiErrorMessage(error: unknown): string {
  return normalizeApiError(error).message;
}

