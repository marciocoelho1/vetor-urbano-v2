import type { RiskAreaSnapshot } from '../domain/persisted-risk-areas';

const API = 'http://127.0.0.1:8080/api/v1';
export class RiskAreaApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function riskAreaRequest<T>(
  path: string,
  body?: unknown,
  csrf?: string,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    credentials: 'include',
    signal,
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      Accept: 'application/json',
      ...(body === undefined
        ? {}
        : { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf || '' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (!response.ok) {
    if (response.status === 401) window.dispatchEvent(new Event('vu-session-invalid'));
    throw new RiskAreaApiError(
      response.status,
      response.status === 409
        ? 'Conflito de versão. Atualize e confira antes de tentar novamente; nada foi sobrescrito.'
        : response.status === 403
          ? 'Acesso recusado. Administração exige sessão ADMIN com MFA.'
          : 'Não foi possível carregar ou salvar as Áreas de Risco. Tente novamente.',
    );
  }
  return response.json() as Promise<T>;
}
export async function fetchRiskAreas(signal?: AbortSignal): Promise<RiskAreaSnapshot[]> {
  return (
    await riskAreaRequest<{ items: RiskAreaSnapshot[] }>(
      '/risk-areas',
      undefined,
      undefined,
      signal,
    )
  ).items;
}
