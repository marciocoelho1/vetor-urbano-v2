/**
 * Stub HTTP local da fonte autorizada **Fogo Cruzado v2** — seam de teste da fatia do ticket 20.
 *
 * PORTA FIXA: `127.0.0.1:8788` (`STUB_PORT`). O contrato observado da fonte em 19/10/2026
 * (docs/history/ticket-20-decisions-2026-10-19.md) é reproduzido aqui com valores 100 % sintéticos:
 * nenhuma credencial real, nenhuma ocorrência real, nenhuma chamada à API pública. A API aponta para
 * este servidor por `vetor.collection.source-base-url`.
 *
 * Rotas da fonte:
 *   POST /auth/login  -> 201 { msg, msgCode, code, data: { accessToken, expiresIn } }
 *   POST /auth/refresh-> 201 { data: { accessToken, expiresIn } }
 *   GET  /states      -> { data: [{ id, name }] }
 *   GET  /cities?stateId= -> { data: [{ id, name, state }] }
 *   GET  /occurrences?initialdate&finaldate&idState&idCities&order&page&take
 *                     -> { pageMeta, data[] } + cabeçalhos X-Last-Update*
 *
 * Modos controláveis (`POST /__stub/mode`):
 *   'ok'       três ocorrências sintéticas na página 1 e nenhuma na página 2 (fim da paginação);
 *              uma delas é disparo SEM vítima (`victims: []`), que o recorte aprovado coleta
 *   'empty'    página sem itens — sucesso sem novidades, nunca falha
 *   'auth401'  401 no login e em toda rota autorizada — AUTH_FAILED
 *   'error500' 500 — UPSTREAM_UNAVAILABLE
 *   'blocked'  403 com corpo `error code: 1010` — proteção de borda da fonte (UPSTREAM_BLOCKED)
 * `hold` suspende a resposta de /occurrences até `release()`, para observar RUNNING/PAUSED sem corrida.
 *
 * Rotas de controle (só deste stub): `POST /__stub/mode`, `POST /__stub/release`,
 * `POST /__stub/reset`, `GET /__stub/state`.
 *
 * Marcadores `…-NAO-PROJETADO` existem só para tornar verificável a minimização obrigatória: eles vêm
 * na resposta da fonte e NÃO podem aparecer em projeção, persistência, DOM ou resposta administrativa.
 */
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';

export const STUB_HOST = '127.0.0.1';
/** Porta fixa e documentada. Alterá-la exige mudar `vetor.collection.source-base-url` da API. */
export const STUB_PORT = 8788;
export const STUB_BASE_URL = `http://${STUB_HOST}:${STUB_PORT}/api/v2`;
export const STUB_ACCESS_TOKEN = 'fc-stub-access-token-synthetic';
/** Sufixo de todo valor da fonte que a minimização precisa manter fora da projeção e do DOM. */
export const NOT_PROJECTED_MARKER = 'NAO-PROJETADO';
export const BLOCKED_BODY = 'error code: 1010';

export type StubMode = 'ok' | 'empty' | 'auth401' | 'error500' | 'blocked';

export interface StubState {
  readonly mode: StubMode;
  readonly hold: boolean;
  readonly occurrenceCalls: readonly number[];
  /** Query crua de cada chamada a /occurrences: prova o que o coletor pediu (e o que não pediu). */
  readonly occurrenceQueries: readonly string[];
  readonly logins: number;
  readonly states: number;
  readonly cities: number;
}

export interface FogoCruzadoStub {
  readonly baseUrl: string;
  /** `false` quando outro processo já servia a porta fixa e este handle apenas a controla. */
  readonly owned: boolean;
  setMode(mode: StubMode, hold?: boolean): Promise<void>;
  release(): Promise<void>;
  reset(): Promise<void>;
  state(): Promise<StubState>;
  close(): Promise<void>;
}

const STATE_ID = 'fc-state-rio-de-janeiro';
const CITY_NAMES = [
  'Rio de Janeiro',
  'Belford Roxo',
  'Cachoeiras de Macacu',
  'Duque de Caxias',
  'Guapimirim',
  'Itaboraí',
  'Itaguaí',
  'Japeri',
  'Magé',
  'Maricá',
  'Mesquita',
  'Nilópolis',
  'Niterói',
  'Nova Iguaçu',
  'Paracambi',
  'Queimados',
  'Rio Bonito',
  'São Gonçalo',
  'São João de Meriti',
  'Seropédica',
  'Tanguá',
];

const cityId = (name: string): string =>
  `fc-city-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

function victim(id: string, situation: 'Dead' | 'Wounded'): Record<string, unknown> {
  return {
    id,
    occurrenceId: 'fc-synthetic-occurrence',
    type: 'People',
    situation,
    circumstances: [{ id: `${id}-circ`, name: 'CIRCUNSTANCIA-SINTETICA', type: 'Circunstancia' }],
    deathDate: '2026-06-01T06:30:00.000Z',
    personType: 'Civilian',
    age: 77,
    ageGroup: { id: `${id}-age`, name: `IDADE-SINTETICA-${NOT_PROJECTED_MARKER}` },
    genre: { id: `${id}-genre`, name: `GENERO-SINTETICO-${NOT_PROJECTED_MARKER}` },
    race: `RACA-SINTETICA-${NOT_PROJECTED_MARKER}`,
    place: { id: `${id}-place`, name: 'Via pública' },
    serviceStatus: {
      id: `${id}-service`,
      name: `SITUACAO-${NOT_PROJECTED_MARKER}`,
      type: 'Servico',
    },
    qualifications: [],
    politicalPosition: {
      id: `${id}-position`,
      name: `POSICAO-${NOT_PROJECTED_MARKER}`,
      type: 'Politico',
    },
    politicalStatus: {
      id: `${id}-status`,
      name: `STATUS-${NOT_PROJECTED_MARKER}`,
      type: 'Politico',
    },
    partie: null,
    coorporation: { id: `${id}-corp`, name: `CORPORACAO-SINTETICA-${NOT_PROJECTED_MARKER}` },
    agentPosition: { id: `${id}-agent`, name: `CARGO-${NOT_PROJECTED_MARKER}`, type: 'Agente' },
    agentStatus: {
      id: `${id}-agent-status`,
      name: `SITUACAO-AGENTE-${NOT_PROJECTED_MARKER}`,
      type: 'Agente',
    },
    unit: `UNIDADE-SINTETICA-${NOT_PROJECTED_MARKER}`,
  };
}

function occurrence(
  reference: number,
  municipality: string,
  victims: Array<Record<string, unknown>>,
  police: boolean,
) {
  return {
    id: `fc-synthetic-${reference}`,
    documentNumber: reference,
    address: `ENDERECO-COMPLETO-${NOT_PROJECTED_MARKER}`,
    state: { id: STATE_ID, name: 'Rio de Janeiro' },
    region: { id: 'fc-region-sudeste', region: 'Sudeste', state: 'Rio de Janeiro', enabled: true },
    city: { id: cityId(municipality), name: municipality },
    neighborhood: { id: `fc-neighborhood-${reference}`, name: `BAIRRO SINTETICO ${reference}` },
    subNeighborhood: null,
    locality: null,
    latitude: '-22.9000000',
    longitude: '-43.3000000',
    date: '2026-06-01T06:30:00.000Z',
    policeAction: police,
    agentPresence: false,
    relatedRecord: '',
    contextInfo: {
      mainReason: { id: 'fc-reason-1', name: police ? 'Operação policial' : 'Disputa' },
      complementaryReasons: [],
      clippings: [],
      massacre: false,
      policeUnit: `UNIDADE-SINTETICA-${NOT_PROJECTED_MARKER}`,
    },
    transports: [],
    victims,
    animalVictims: [],
  };
}

const PAGE_ONE = [
  occurrence(70001, 'Rio de Janeiro', [victim('fc-victim-70001', 'Dead')], true),
  occurrence(70002, 'Niterói', [victim('fc-victim-70002', 'Wounded')], false),
  // Disparo sem vítima: o recorte aprovado não descarta ocorrência por ausência de vítima.
  occurrence(70003, 'Duque de Caxias', [], false),
];

const UPSTREAM_HEADERS: Record<string, string> = {
  'X-Last-Update': '2026-10-19T11:26:28-03:00',
  'X-Last-Update-Timestamp': '1792409188',
  'X-Last-Update-State-Id': STATE_ID,
  'X-Last-Update-State': '2026-10-19T09:57:12-03:00',
  'X-Last-Update-State-Timestamp': '1792403832',
};

interface Runtime {
  mode: StubMode;
  hold: boolean;
  held: Array<() => void>;
  occurrenceCalls: number[];
  occurrenceQueries: string[];
  logins: number;
  states: number;
  cities: number;
}

function freshRuntime(): Runtime {
  return {
    mode: 'ok',
    hold: false,
    held: [],
    occurrenceCalls: [],
    occurrenceQueries: [],
    logins: 0,
    states: 0,
    cities: 0,
  };
}

function json(
  res: ServerResponse,
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    ...headers,
  });
  res.end(payload);
}

function text(res: ServerResponse, status: number, body: string): void {
  res.writeHead(status, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

async function readBody(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(chunk as Buffer);
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw.trim()) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function fault(runtime: Runtime, res: ServerResponse, what: string): boolean {
  if (runtime.mode === 'auth401') {
    json(res, 401, { msg: `Credencial recusada em ${what}`, code: 401, msgCode: 'AUTH_FAILED' });
    return true;
  }
  if (runtime.mode === 'error500') {
    json(res, 500, { msg: `Fonte indisponível em ${what}`, code: 500 });
    return true;
  }
  if (runtime.mode === 'blocked') {
    text(res, 403, BLOCKED_BODY);
    return true;
  }
  return false;
}

function holdIfAsked(runtime: Runtime): Promise<void> | null {
  if (!runtime.hold) return null;
  return new Promise<void>((resolve) => {
    // Rede de segurança: um teste que falhe no meio não deixa a execução presa para sempre.
    const timer = setTimeout(() => {
      runtime.held = runtime.held.filter((release) => release !== wrapped);
      resolve();
    }, 120_000);
    const wrapped = (): void => {
      clearTimeout(timer);
      resolve();
    };
    runtime.held.push(wrapped);
  });
}

async function route(
  request: IncomingMessage,
  res: ServerResponse,
  runtime: Runtime,
  url: URL,
): Promise<void> {
  // O cliente do produto anexa as rotas à base configurada (`…/api/v2`), como na fonte real.
  const path = url.pathname.replace(/^\/api\/v2(?=\/|$)/, '') || '/';
  const take = Number.parseInt(url.searchParams.get('take') ?? '100', 10);
  const page = Number.parseInt(url.searchParams.get('page') ?? '1', 10);

  if (path === '/__stub/state') {
    json(res, 200, {
      mode: runtime.mode,
      hold: runtime.hold,
      occurrenceCalls: runtime.occurrenceCalls,
      occurrenceQueries: runtime.occurrenceQueries,
      logins: runtime.logins,
      states: runtime.states,
      cities: runtime.cities,
    });
    return;
  }
  if (path === '/__stub/mode') {
    const body = await readBody(request);
    runtime.mode = (body['mode'] as StubMode) ?? 'ok';
    if (typeof body['hold'] === 'boolean') runtime.hold = body['hold'];
    json(res, 200, { mode: runtime.mode, hold: runtime.hold });
    return;
  }
  if (path === '/__stub/reset') {
    Object.assign(runtime, freshRuntime());
    json(res, 200, { mode: runtime.mode, hold: runtime.hold });
    return;
  }
  if (path === '/__stub/release') {
    const held = runtime.held;
    runtime.held = [];
    held.forEach((release) => release());
    json(res, 200, { released: held.length });
    return;
  }

  if (path === '/auth/login') {
    await readBody(request);
    runtime.logins += 1;
    if (fault(runtime, res, 'login')) return;
    json(res, 201, {
      msg: 'Successfully login',
      msgCode: 'AUTH_SUCCESS',
      code: 201,
      data: { accessToken: STUB_ACCESS_TOKEN, expiresIn: 3600 },
    });
    return;
  }
  if (path === '/auth/refresh') {
    await readBody(request);
    if (fault(runtime, res, 'renovação')) return;
    json(res, 201, {
      msg: 'Successfully refresh',
      code: 201,
      data: { accessToken: `${STUB_ACCESS_TOKEN}-renewed`, expiresIn: 3600 },
    });
    return;
  }
  if (path === '/states') {
    runtime.states += 1;
    if (fault(runtime, res, 'estados')) return;
    json(
      res,
      200,
      { code: 200, data: [{ id: STATE_ID, name: 'Rio de Janeiro' }] },
      UPSTREAM_HEADERS,
    );
    return;
  }
  if (path === '/cities') {
    runtime.cities += 1;
    if (fault(runtime, res, 'cidades')) return;
    // Cobertura declarada pela fonte: a lista legal da RM-RJ menos Petrópolis (ausente e relatada).
    json(
      res,
      200,
      {
        code: 200,
        data: CITY_NAMES.map((name) => ({
          id: cityId(name),
          name,
          state: { id: STATE_ID, name: 'Rio de Janeiro' },
        })),
      },
      UPSTREAM_HEADERS,
    );
    return;
  }
  if (path === '/occurrences') {
    runtime.occurrenceCalls.push(page);
    runtime.occurrenceQueries.push(url.search);
    if (fault(runtime, res, 'ocorrências')) return;
    const held = holdIfAsked(runtime);
    if (held) await held;
    const items = runtime.mode === 'empty' || page !== 1 ? [] : PAGE_ONE;
    json(
      res,
      200,
      {
        code: 200,
        pageMeta: {
          page,
          take,
          itemCount: items.length,
          pageCount: items.length ? 1 : 0,
          hasPreviousPage: false,
          hasNextPage: false,
        },
        data: items,
      },
      UPSTREAM_HEADERS,
    );
    return;
  }
  json(res, 404, { code: 404, msg: `Rota sintética ausente: ${path}` });
}

/** Sobe o stub (ou adota um já servido na porta fixa) e devolve o controle por HTTP. */
export async function startFogoCruzadoStub(port = STUB_PORT): Promise<FogoCruzadoStub> {
  const base = `http://${STUB_HOST}:${port}`;
  const runtime = freshRuntime();
  let server: Server | null = null;
  let owned = true;

  await new Promise<void>((resolve, reject) => {
    const candidate = createServer((request, response) => {
      const url = new URL(request.url ?? '/', base);
      void route(request, response, runtime, url).catch(() => {
        if (!response.headersSent)
          json(response, 500, { code: 500, msg: 'Falha interna do stub.' });
      });
    });
    candidate.once('error', (failure: NodeJS.ErrnoException) => {
      if (failure.code === 'EADDRINUSE') {
        owned = false;
        resolve();
        return;
      }
      reject(failure);
    });
    candidate.listen(port, STUB_HOST, () => {
      server = candidate;
      resolve();
    });
  });

  const control = async (path: string, body?: Record<string, unknown>): Promise<StubState> => {
    const response = await fetch(`${base}${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (!response.ok)
      throw new Error(`Stub Fogo Cruzado não respondeu em ${path}: HTTP ${response.status}`);
    return (await response.json()) as StubState;
  };

  return {
    baseUrl: `${base}/api/v2`,
    owned,
    async setMode(mode: StubMode, hold = false): Promise<void> {
      await control('/__stub/mode', { mode, hold });
    },
    async release(): Promise<void> {
      await control('/__stub/release', {});
    },
    async reset(): Promise<void> {
      await control('/__stub/reset', {});
    },
    async state(): Promise<StubState> {
      return control('/__stub/state');
    },
    async close(): Promise<void> {
      if (!owned || !server) return;
      await new Promise<void>((resolve) => {
        server!.closeAllConnections();
        server!.close(() => resolve());
      });
    },
  };
}

/**
 * Permite subir o stub manualmente: `node apps/web/e2e/helpers/fogo-cruzado-stub.ts`.
 * Sem `await` de topo: o arquivo também é importado pelo spec, que o compila como CommonJS.
 */
if (process.argv[1]?.endsWith('fogo-cruzado-stub.ts')) {
  void startFogoCruzadoStub().then((handle) => {
    console.log(
      `Stub sintético do Fogo Cruzado em ${handle.baseUrl} (porta ${STUB_PORT}, ${handle.owned ? 'iniciado' : 'já servido'}).`,
    );
  });
}
