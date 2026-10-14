import { createMetropolitanDemoOccurrences, disperseDemoOccurrences } from '../../demo-occurrences';
import type { Coordinates } from '../../domain';

// Fixed clock and existing synthetic fixtures make comparisons repeatable.
export const REFERENCE_TIME = new Date('2026-10-13T18:00:00Z');
export const GALLERY_RECORDS = disperseDemoOccurrences(
  createMetropolitanDemoOccurrences(REFERENCE_TIME),
);
export type GalleryRecord = (typeof GALLERY_RECORDS)[number];
export type GalleryCamera = { center: Coordinates; zoom: number };
export type GalleryPlace = { id: string; label: string; hint: string; coordinates: Coordinates };
export const GALLERY_PLACES: GalleryPlace[] = [
  {
    id: 'centro',
    label: 'Centro, Rio de Janeiro',
    hint: 'Praça Exemplo, 100 · sugestão fictícia',
    coordinates: [-43.19156, -22.90332],
  },
  {
    id: 'tijuca',
    label: 'Tijuca, Rio de Janeiro',
    hint: 'Rua Exemplo, 200 · sugestão fictícia',
    coordinates: [-43.239, -22.924],
  },
  {
    id: 'caxias',
    label: 'Centro, Duque de Caxias',
    hint: 'Avenida Exemplo, 300 · sugestão fictícia',
    coordinates: [-43.312, -22.786],
  },
  {
    id: 'iguacu',
    label: 'Centro, Nova Iguaçu',
    hint: 'Praça Exemplo, 400 · sugestão fictícia',
    coordinates: [-43.451, -22.759],
  },
  {
    id: 'meriti',
    label: 'Centro, São João de Meriti',
    hint: 'Rua Exemplo, 500 · sugestão fictícia',
    coordinates: [-43.372, -22.805],
  },
  {
    id: 'niteroi',
    label: 'Icaraí, Niterói',
    hint: 'Avenida Exemplo, 600 · sugestão fictícia',
    coordinates: [-43.107, -22.906],
  },
];
export const GALLERY_CATEGORIES = [
  { id: 'TRANSITO', label: 'Trânsito', color: '#397254', icon: 'car', letter: 'T' },
  { id: 'SEGURANCA', label: 'Segurança', color: '#a33f49', icon: 'shield', letter: 'S' },
  { id: 'CONTINGENCIA', label: 'Contingência', color: '#846321', icon: 'alert', letter: 'C' },
];
export const GALLERY_VARIANTS = [
  {
    id: 1,
    name: 'Verde institucional',
    short: 'Verde',
    title: 'A cidade, por perto.',
    description:
      'Uma leitura ampla do território, com filtros à mão e resultados que acompanham o mapa.',
    color: '#285a45',
    surface: '#f2f1e9',
    structure: 'Navegação superior · filtros em barra · cartões à direita',
    tradeoff: 'Mapa ampliado e categorias à vista; a página exige mais rolagem vertical.',
  },
  {
    id: 2,
    name: 'Azul cívico',
    short: 'Azul',
    title: 'Explore sua região.',
    description: 'Escolha um lugar, ajuste a consulta e encontre cada resultado no mapa.',
    color: '#294f82',
    surface: '#edf2f9',
    structure: 'Navegação lateral · filtros e lista à esquerda · mapa à direita',
    tradeoff: 'Consulta concentrada em uma coluna; o mapa ganha menos largura.',
  },
  {
    id: 3,
    name: 'Grafite e areia',
    short: 'Grafite',
    title: 'Consulta territorial',
    description: 'Lugar, período e categoria em uma consulta clara, sem perder o mapa de vista.',
    color: '#343d37',
    surface: '#eceae3',
    structure: 'Cabeçalho compacto · barra de consulta · resultados em linhas',
    tradeoff: 'Mais informação por tela; textos e controles têm menos respiro.',
  },
  {
    id: 4,
    name: 'Terracota urbana',
    short: 'Terracota',
    title: 'Seu lugar na cidade.',
    description: 'Um jeito tranquilo de explorar informações e entender o que existe ao seu redor.',
    color: '#844c38',
    surface: '#f5ece3',
    structure: 'Cabeçalho editorial · consulta em três blocos · fichas narrativas',
    tradeoff: 'Campos mais explicativos; exige mais rolagem em telas menores.',
  },
  {
    id: 5,
    name: 'Verde-azulado contemporâneo',
    short: 'Verde-azulado',
    title: 'Explore o que está ao redor.',
    description: 'O mapa em primeiro plano. A busca e os filtros vivem junto aos resultados.',
    color: '#17666a',
    surface: '#eaf3f1',
    structure: 'Navegação flutuante · mapa à esquerda · consulta integrada à lista',
    tradeoff: 'Mais área para o mapa; filtros detalhados exigem abrir um grupo.',
  },
  {
    id: 6,
    name: 'Vetor Urbano v2',
    short: 'Vetor v2',
    title: 'Explore o que está ao redor.',
    description: 'O mapa em primeiro plano. A busca e os filtros vivem junto aos resultados.',
    color: '#24765b',
    surface: '#f7f8fa',
    structure: 'Layout da proposta 5 · paleta original da v2 · tipografia Manrope',
    tradeoff: 'Mapa amplo e cores da v2; filtros detalhados exigem abrir um grupo.',
  },
];
export function normalizeGallerySearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}
