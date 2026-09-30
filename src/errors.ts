import { ApiError } from './api/client';

// 401 = el Authorizer rechazó el token (iss/aud/firma/exp)
// 403 = token válido pero sin el rol/scope que exige la Lambda
export function describeError(err: unknown): string {
  if (err instanceof ApiError) {
    return `API ${err.status} ${err.statusText} — ${JSON.stringify(err.body)}`;
  }
  return err instanceof Error ? err.message : 'Error desconocido';
}
