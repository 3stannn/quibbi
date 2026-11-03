import type { SessionResponse } from '@quibbi/shared';
export type { Card, Deck, PublicUser as User } from '@quibbi/shared';
export type Session = SessionResponse;
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
export async function api<T>(
  path: string,
  init: RequestInit = {},
  retryCsrf = true,
): Promise<T> {
  const response = await fetch(path, {
    credentials: 'same-origin',
    ...init,
    headers: {
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  });
  const body = await response.json().catch(() => null);
  if (
    response.status === 403 &&
    body?.error?.code === 'CSRF_REJECTED' &&
    retryCsrf &&
    init.method &&
    !['GET', 'HEAD'].includes(init.method)
  ) {
    const session = await api<Session>('/api/session', {}, false);
    if (session.csrfToken)
      return api<T>(
        path,
        {
          ...init,
          headers: { ...init.headers, 'x-csrf-token': session.csrfToken },
        },
        false,
      );
  }
  if (!response.ok)
    throw new ApiError(
      response.status,
      body?.error?.code ?? 'NETWORK_ERROR',
      body?.error?.message ??
        'We could not reach your study space. Please try again.',
    );
  return body as T;
}
export function safeReturnPath(value: string | null) {
  if (
    !value ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    value.includes('\\')
  )
    return '/library';
  try {
    const url = new URL(value, window.location.origin);
    return url.origin === window.location.origin
      ? url.pathname + url.search
      : '/library';
  } catch {
    return '/library';
  }
}
export async function authAction(
  action: 'signin/google' | 'signout',
  callbackUrl: string,
) {
  const { csrfToken } = await api<{ csrfToken: string }>('/auth/csrf');
  if (!csrfToken) throw new Error('Sign-in is unavailable. Please try again.');
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = `/auth/${action}`;
  for (const [name, value] of Object.entries({
    csrfToken,
    callbackUrl: safeReturnPath(callbackUrl),
  })) {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = name;
    input.value = value;
    form.append(input);
  }
  document.body.append(form);
  form.submit();
}
