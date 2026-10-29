/**
 * UXH-20 — envio do feedback do piloto.
 *
 * O destino é o endpoint interno da própria API (`POST /api/v1/feedback`, migração V24),
 * decidido pelo @arquiteto: sem serviço externo, sem contrato de terceiro. Só o que o
 * formulário envia é gravado — nada de captura de sessão, localização ou imagem.
 */
export interface FeedbackPayload {
  rating: number;
  message: string;
  contactOptIn: boolean;
  route: string;
}

export async function sendPilotFeedback(
  payload: FeedbackPayload,
  csrf: string,
  signal?: AbortSignal,
): Promise<string> {
  const response = await fetch('http://127.0.0.1:8080/api/v1/feedback', {
    method: 'POST',
    credentials: 'include',
    signal,
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
    body: JSON.stringify(payload),
  });
  if (response.status === 401 || response.status === 403) {
    throw new Error('Sessão ausente ou expirada. Entre novamente para enviar.');
  }
  if (response.status === 429) {
    throw new Error('Limite de envios atingido. Tente novamente em alguns minutos.');
  }
  if (!response.ok) {
    throw new Error(
      response.status === 400
        ? 'Revise a nota e o comentário antes de enviar.'
        : 'Não foi possível enviar o feedback. Tente novamente.',
    );
  }
  const body = (await response.json()) as { id?: string };
  return body.id ?? '';
}
