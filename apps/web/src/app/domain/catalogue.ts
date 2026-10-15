/** Functional catalogue. Legacy classifications remain metadata, never inferred as new types. */
export const OCCURRENCE_CATALOGUE = [
  {
    id: 'ROUBO',
    category: 'SEGURANCA',
    label: 'Roubo/assalto',
    subtypes: [
      'A pedestre',
      'De veículo',
      'De carga',
      'A estabelecimento',
      'A residência',
      'Em transporte coletivo',
    ],
  },
  {
    id: 'FURTO',
    category: 'SEGURANCA',
    label: 'Furto',
    subtypes: [
      'De objetos pessoais',
      'De veículo',
      'De carga',
      'Em estabelecimento',
      'Em residência',
    ],
  },
  { id: 'DISPAROS', category: 'SEGURANCA', label: 'Disparos/tiroteio', subtypes: [] },
  { id: 'OPERACAO_POLICIAL', category: 'SEGURANCA', label: 'Operação policial', subtypes: [] },
  { id: 'CONFRONTO', category: 'SEGURANCA', label: 'Confronto entre grupos armados', subtypes: [] },
  {
    id: 'ACIDENTE',
    category: 'TRANSITO',
    label: 'Acidente',
    subtypes: [
      'Colisão',
      'Engavetamento',
      'Atropelamento',
      'Capotamento',
      'Tombamento',
      'Queda de motociclista ou ciclista',
    ],
  },
  {
    id: 'INTERDICAO',
    category: 'TRANSITO',
    label: 'Interdição/bloqueio',
    subtypes: ['Total', 'Parcial'],
  },
  { id: 'CONGESTIONAMENTO', category: 'TRANSITO', label: 'Congestionamento', subtypes: [] },
  { id: 'OBRAS', category: 'TRANSITO', label: 'Obras com impacto viário', subtypes: [] },
  { id: 'SEMAFOROS', category: 'TRANSITO', label: 'Semáforos desligados', subtypes: [] },
  { id: 'ALAGAMENTO', category: 'CONTINGENCIA', label: 'Alagamento/inundação', subtypes: [] },
  { id: 'DESLIZAMENTO', category: 'CONTINGENCIA', label: 'Deslizamento', subtypes: [] },
  {
    id: 'INCENDIO',
    category: 'CONTINGENCIA',
    label: 'Incêndio',
    subtypes: ['Em edificação', 'Em vegetação', 'Em veículo', 'Em outro local informado'],
  },
  { id: 'ARVORE', category: 'CONTINGENCIA', label: 'Queda de árvore', subtypes: [] },
  { id: 'ENERGIA', category: 'CONTINGENCIA', label: 'Interrupção de energia', subtypes: [] },
  {
    id: 'AGUA',
    category: 'CONTINGENCIA',
    label: 'Interrupção de abastecimento de água',
    subtypes: [],
  },
] as const;

export const UNKNOWN_SUBTYPE = 'Não informado';
