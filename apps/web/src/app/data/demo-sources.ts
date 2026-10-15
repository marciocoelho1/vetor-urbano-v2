/** User-provided placeholder, not an approved or connected collection source. */
export const SOURCE_PLACEHOLDER = {
  id: 'g1-rio-placeholder',
  name: 'G1 — Rio de Janeiro',
  url: 'https://g1.globo.com/rj/rio-de-janeiro/',
  format: 'Página indicada pelo responsável',
  state: 'Placeholder não avaliado',
  note: 'Coleta desativada. Outras fontes poderão ser cadastradas manualmente.',
};

/** Synthetic names and reserved URLs: they do not describe evaluated publishers. */
export const SYNTHETIC_PUBLIC_SOURCES = [
  {
    id: 'demo',
    name: 'Fonte fictícia — Demonstração local',
    url: 'https://example.invalid/fontes/demo',
    format: 'Exemplo sintético com URL',
    state: 'Dados fictícios',
    note: 'Referências e notas fictícias usadas apenas na demonstração.',
  },
  {
    id: 'demo-no-url',
    name: 'Canal fictício sem URL pública',
    url: undefined,
    format: 'Exemplo sintético sem URL',
    state: 'Dados fictícios',
    note: 'Sem URL pública. As publicações mantêm seus próprios identificadores e referências.',
  },
];
