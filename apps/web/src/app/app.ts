import { CommonModule, isPlatformBrowser } from '@angular/common';
import {
  AfterViewInit,
  Component,
  computed,
  effect,
  HostListener,
  inject,
  OnDestroy,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ViewMotion } from './ui/view-motion';
import { PanelResize } from './ui/panel-resize';
import { Theme } from './core/theme/theme';
import { applyUrbanMapTheme } from './maps/urban-map-style';
import type * as maplibregl from 'maplibre-gl';
import type { Feature, FeatureCollection, MultiPolygon, Point, Polygon } from 'geojson';
import {
  calendarRange,
  isMappedRecord,
  type QueryBounds,
  filterRecords,
  localDateTimeToInstant,
  INITIAL_RADIUS_METERS,
  MAXIMUM_RADIUS_METERS,
  MINIMUM_RADIUS_METERS,
  RADIUS_STEP_METERS,
  type AggregateStatistic,
  type Coordinates,
  type DatePreset,
  type DemoRecord,
  type ImportedDataset,
  type SourceMetadata,
} from './domain/occurrences';
import {
  formatFactTime,
  resolveSituation,
  situationLabel,
  temporalInclusion,
  type Situation,
} from './domain/temporal';
import {
  formatDistance,
  INFORMES_INITIAL_RADIUS_METERS,
  INFORMES_MAXIMUM_RADIUS_METERS,
  INFORMES_MINIMUM_RADIUS_METERS,
  queryActiveReports,
} from './domain/active-reports';
import {
  riskAreaDetails,
  riskAreaTemporalWarning,
  type RiskAreaCode,
  type RiskAreaDetails,
} from './domain/risk-areas';
import { SYNTHETIC_RISK_AREAS } from './data/demo-risk-areas';
import type { FactTime } from './domain/temporal';
import type { SpreadsheetSheet } from './data-exchange/xlsx-export';
import {
  createMetropolitanDemoOccurrences,
  disperseDemoOccurrences,
  relateDemoOccurrences,
} from './data/demo-occurrences';

import {
  DEMO_LOCATION_REFERENCES,
  demoRecordBounds,
  type DemoLocationReference,
} from './data/demo-locations';
import { SOURCE_PLACEHOLDER, SYNTHETIC_PUBLIC_SOURCES } from './data/demo-sources';
import { OCCURRENCE_CATALOGUE, UNKNOWN_SUBTYPE } from './domain/catalogue';

type Category = 'TRANSITO' | 'SEGURANCA' | 'CONTINGENCIA';
type ModuleId = 'intelligence' | 'information' | 'territory';
type PublicPage =
  'public-sources' | 'reliability' | 'terms' | 'privacy' | 'methodology' | 'corrections';
type ViewId = 'map' | 'active' | 'history' | 'insights' | 'sources' | 'report' | PublicPage;
type TerritoryCode = RiskAreaCode;
type TerritoryProperties = { n: string; f: TerritoryCode; demoDetails?: RiskAreaDetails };
type TerritoryFeature = Feature<Polygon | MultiPolygon, TerritoryProperties> & { id: number };
type MapSearchResult =
  | { kind: 'occurrence'; key: string; title: string; subtitle: string; point: DemoPoint }
  | {
      kind: 'reference';
      key: string;
      title: string;
      subtitle: string;
      reference: DemoLocationReference;
    }
  | { kind: 'territory'; key: string; title: string; subtitle: string; area: TerritoryFeature };
type DemoPoint = DemoRecord & {
  id: string;
  name: string;
  description: string;
  location: string;
  kind: 'occurrence' | 'poi';
  insertedAt: string;
  coordinates: Coordinates | null;
};

type MappedDemoPoint = DemoPoint & {
  coordinates: Coordinates;
};

type SavedSearch = {
  id: string;
  name: string;
  filters: string[];
  period: string;
  customRangeStart?: string;
  customRangeEnd?: string;
  timeStart?: string;
  timeEnd?: string;
  useRadius?: boolean;
  radiusMeters?: number;
  center?: { longitude: string; latitude: string };
  municipality?: string;
  neighborhood?: string;
  bounds?: QueryBounds;
};
type ClipStatus = 'PENDING' | 'LINKED' | 'DUPLICATE' | 'DISMISSED';
type DemoClip = {
  id: string;
  title: string;
  publisher: string;
  collectedAt: string;
  status: ClipStatus;
  eventId?: string;
  referenceUrl?: string;
};
type LeafletMap = import('leaflet').Map;
type LeafletLayerGroup = import('leaflet').LayerGroup;
type LeafletCircleMarker = import('leaflet').CircleMarker;
type RasterTileProvider = { tileUrl: string; maxZoom: number; attribution: string };

type TerritoryGroup = {
  id: TerritoryCode;
  label: string;
  color: string;
  count: number;
};

// Keep this family in sync with maps/raster-provider.json: GPU fallback must preserve the basemap.
const RASTER_MAP_PROVIDER_URL = 'maps/raster-provider.json';
const TERRITORY_DATA_URL = 'maps/areas-territoriais.geojson';
const SEARCH_RADIUS_COLOR = '#C4B5FD';
const CENTRAL_DO_BRASIL_CENTER: Coordinates = [-43.19156448029434, -22.903318808380494];
const REPORT_VALUE_LABELS: Record<string, string> = {
  TRANSITO: 'Trânsito',
  SEGURANCA: 'Segurança',
  CONTINGENCIA: 'Contingência',
  POI: 'Ponto de interesse',
  CRIMES: 'Crimes',
  CALAMIDADE_PUBLICA: 'Calamidade pública',
  ASSUNTOS_SEGURANCA: 'Assuntos diversos de segurança',
  ATIVIDADE_POLICIAL: 'Atividade policial',
  ORDEM_PUBLICA: 'Ordem pública',
  ALERTA: 'Alerta',
  OUTROS_REGISTROS: 'Outros registros',
  CRITICA: 'Crítica',
  ALTA: 'Alta',
  MODERADA: 'Moderada',
  MEDIA: 'Média',
  BAIXA: 'Baixa',
  SINALIZACAO: 'Sinalização',
  INTERDICAO: 'Interdição',
  COLISAO: 'Colisão',
  CONGESTIONAMENTO: 'Congestionamento',
  PANE: 'Pane',
  FURTO: 'Furto',
  ROUBO_TRANSEUNTE: 'Roubo a transeunte',
  ROUBO_VEICULO: 'Roubo de veículo',
  FURTO_VEICULO: 'Furto de veículo',
  ROUBO_COLETIVO: 'Roubo em transporte coletivo',
  ROUBO_CARGA: 'Roubo de carga',
  ESTELIONATO: 'Estelionato',
  AMEACA: 'Ameaça',
  LESAO_CORPORAL_DOLOSA: 'Lesão corporal dolosa',
  HOMICIDIO_DOLOSO: 'Homicídio doloso',
  ALAGAMENTO: 'Alagamento',
  DESLIZAMENTO: 'Deslizamento',
  INCENDIO: 'Incêndio',
  FALHA_INFRAESTRUTURA: 'Falha de infraestrutura',
  OUTRO: 'Outro',
  HOSPITAL_PUBLICO: 'Hospital público',
  HOSPITAL_PARTICULAR: 'Hospital particular',
  UPA: 'Unidade de Pronto Atendimento (UPA)',
  AEROPORTO: 'Aeroporto',
  EMBAIXADA: 'Embaixada ou consulado',
  ESTADIO: 'Estádio',
};

function reportValueLabel(value?: string): string {
  const text = value?.trim() ?? '';
  if (!text) return '';
  const key = text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
  return REPORT_VALUE_LABELS[key] ?? text;
}

const TERRITORY_GROUPS: TerritoryGroup[] = [
  { id: 'CV', label: 'Comando Vermelho (CV)', color: '#E0342C', count: 1000 },
  { id: 'TCP', label: 'Terceiro Comando Puro (TCP)', color: '#2FA46B', count: 295 },
  { id: 'ADA', label: 'Amigos dos Amigos (ADA)', color: '#EDB72B', count: 92 },
  { id: 'MIL', label: 'Milícia', color: '#4E9DE0', count: 91 },
  { id: 'LJ', label: 'Liga da Justiça (CL220)', color: '#2B5BC7', count: 130 },
  { id: 'MNI', label: 'Milícia de Nova Iguaçu', color: '#9B6BD6', count: 42 },
  { id: 'NEU', label: 'Área classificada como neutra pela fonte', color: '#8C97A3', count: 21 },
];
const TERRITORY_GROUP_BY_ID = new Map(TERRITORY_GROUPS.map((group) => [group.id, group]));
const DEMO_AGGREGATES: AggregateStatistic[] = [
  {
    territory: 'Centro (exemplo sintético)',
    period: '2026-07',
    indicator: 'Trânsito',
    value: 8,
    unit: 'registros fictícios',
    sourceId: 'demo',
  },
  {
    territory: 'Centro (exemplo sintético)',
    period: '2026-08',
    indicator: 'Trânsito',
    value: 11,
    unit: 'registros fictícios',
    sourceId: 'demo',
  },
  {
    territory: 'Centro (exemplo sintético)',
    period: '2026-09',
    indicator: 'Trânsito',
    value: 6,
    unit: 'registros fictícios',
    sourceId: 'demo',
  },
  {
    territory: 'Zona Sul (exemplo sintético)',
    period: '2026-07',
    indicator: 'Segurança',
    value: 5,
    unit: 'registros fictícios',
    sourceId: 'demo',
  },
  {
    territory: 'Zona Sul (exemplo sintético)',
    period: '2026-08',
    indicator: 'Segurança',
    value: 9,
    unit: 'registros fictícios',
    sourceId: 'demo',
  },
  {
    territory: 'Zona Sul (exemplo sintético)',
    period: '2026-09',
    indicator: 'Segurança',
    value: 7,
    unit: 'registros fictícios',
    sourceId: 'demo',
  },
];
const INITIAL_CLIPS: DemoClip[] = [
  {
    id: 'clip-demo-001',
    title: 'Boletim de teste sobre bloqueio viário',
    publisher: 'Fonte sintética A',
    collectedAt: '2026-10-10T12:00:00.000Z',
    status: 'PENDING',
  },
  {
    id: 'clip-demo-002',
    title: 'Nota demonstrativa de chuva intensa',
    publisher: 'Fonte sintética B',
    collectedAt: '2026-10-10T11:00:00.000Z',
    status: 'PENDING',
  },
  {
    id: 'clip-demo-003',
    title: 'Publicação simulada sobre interdição',
    publisher: 'Fonte sintética C',
    collectedAt: '2026-10-09T20:00:00.000Z',
    status: 'LINKED',
    eventId: 'demo-002',
  },
];

function normalizeSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

const CATEGORIES: { id: Category; label: string; icon: string }[] = [
  { id: 'TRANSITO', label: 'Trânsito', icon: '↗' },
  { id: 'SEGURANCA', label: 'Segurança', icon: '◇' },
  { id: 'CONTINGENCIA', label: 'Contingência', icon: '⌁' },
];

export type ConsultationMode = 'simple' | 'advanced';

interface SuspendedAdvancedFilters {
  subtypes: string[];
  sources?: string[];
  situations?: string[];
  customPeriod?: boolean;
  customRangeStart?: string;
  customRangeEnd?: string;
  textFilter?: string;
  minScore?: number | null;
  maxScore?: number | null;
}

@Component({
  imports: [CommonModule, FormsModule, ViewMotion, PanelResize],
  selector: 'app-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App implements AfterViewInit, OnDestroy {
  protected readonly theme = inject(Theme);
  protected readonly categories = CATEGORIES;
  protected readonly occurrenceCatalogue = OCCURRENCE_CATALOGUE;
  protected readonly savedSearchNotice = signal('');
  protected readonly querySummaryNotice = signal('');
  protected readonly territoryGroups = TERRITORY_GROUPS;
  protected readonly consultationMode = signal<ConsultationMode>('simple');
  protected readonly modeNotice = signal<string>('');
  private readonly suspendedAdvancedFilters = signal<SuspendedAdvancedFilters | null>(null);
  protected readonly advancedTextFilter = signal<string>('');
  protected readonly minScore = signal<number | null>(null);
  protected readonly maxScore = signal<number | null>(null);
  protected readonly scoreRangeInvalid = computed(() => {
    const min = this.minScore();
    const max = this.maxScore();
    return min !== null && max !== null && min > max;
  });
  protected readonly periodExplicitlyChosenInSimple = signal(false);
  protected readonly availableSources = [SOURCE_PLACEHOLDER, ...SYNTHETIC_PUBLIC_SOURCES];
  protected readonly situationOptions: { id: Situation; label: string }[] = [
    { id: 'ONGOING', label: 'Em andamento' },
    { id: 'CLOSED', label: 'Encerrada' },
    { id: 'UNKNOWN', label: 'Desconhecida' },
  ];
  protected readonly activeView = signal<ViewId>('map');
  protected readonly consultationView = signal<'map' | 'list'>('map');
  protected readonly compactConsultation = signal(
    typeof window !== 'undefined' && window.innerWidth <= 960,
  );

  @HostListener('window:resize')
  protected updateConsultationViewport(): void {
    this.compactConsultation.set(window.innerWidth <= 960);
  }
  protected readonly expandedModule = signal<ModuleId | null>('intelligence');
  protected readonly selectedCategory = signal<Category | null>(null);
  protected readonly activeFilters = signal<string[]>(
    CATEGORIES.map((category) => `category:${category.id}`),
  );
  protected readonly period = signal<DatePreset | 'custom' | 'ongoing'>('24h');
  protected readonly queryReferenceDate = signal(new Date());
  protected readonly pendingUpdateAvailable = signal(false);
  protected readonly queryLoading = signal(false);
  protected readonly queryError = signal(false);
  protected readonly queryErrorMessage = signal('');
  protected readonly customRangeStart = signal('');
  protected readonly customRangeEnd = signal('');
  protected readonly timeStart = signal('');
  protected readonly timeEnd = signal('');
  protected readonly useRadius = signal(false);
  protected readonly radiusMeters = signal(INITIAL_RADIUS_METERS);
  protected readonly searchCenter = signal({
    longitude: String(CENTRAL_DO_BRASIL_CENTER[0]),
    latitude: String(CENTRAL_DO_BRASIL_CENTER[1]),
  });
  protected readonly mapPickPurpose = signal<'report' | 'radius' | 'active' | null>(null);
  protected readonly formatDistance = formatDistance;
  protected readonly informesRadiusMeters = signal(INFORMES_INITIAL_RADIUS_METERS);
  protected readonly informesCenter = signal({
    longitude: String(CENTRAL_DO_BRASIL_CENTER[0]),
    latitude: String(CENTRAL_DO_BRASIL_CENTER[1]),
  });
  protected readonly informesRadiusError = computed(() => {
    const radius = this.informesRadiusMeters();
    if (
      !Number.isFinite(radius) ||
      radius < INFORMES_MINIMUM_RADIUS_METERS ||
      radius > INFORMES_MAXIMUM_RADIUS_METERS
    ) {
      return `O raio dos Informes ativos precisa estar entre ${INFORMES_MINIMUM_RADIUS_METERS} e ${INFORMES_MAXIMUM_RADIUS_METERS} m (máximo de 5 km).`;
    }
    return null;
  });
  protected readonly savedSearches = signal<SavedSearch[]>([]);
  protected readonly savedSearchName = signal('');
  protected readonly historyQuery = signal('');
  protected readonly analyticsTerritoryA = signal('Centro (exemplo sintético)');
  protected readonly analyticsTerritoryB = signal('Zona Sul (exemplo sintético)');
  protected readonly analyticsIndicator = signal('Trânsito');
  protected readonly comparisonPeriodA = signal('2026-07');
  protected readonly comparisonPeriodB = signal('2026-08');
  protected readonly playbackIndex = signal(0);
  protected readonly playbackRunning = signal(false);
  protected readonly sourceKind = signal<'events-geojson' | 'aggregate-csv'>('aggregate-csv');
  protected readonly sourceMetadataForm = signal<SourceMetadata>({
    id: 'arquivo-local',
    name: '',
    url: '',
    license: '',
    referenceDate: '',
    limitations: '',
  });
  protected readonly sourceImportStatus = signal('');
  protected readonly sourceImports = signal<
    { metadata: SourceMetadata; importedAt: string; records: number; aggregates: number }[]
  >([]);
  protected readonly importedRecords = signal<DemoPoint[]>([]);
  protected readonly importedAggregates = signal<AggregateStatistic[]>([]);
  protected readonly clips = signal<DemoClip[]>(INITIAL_CLIPS);
  protected readonly clipTarget = signal<Record<string, string>>({});
  protected readonly clipsQuery = signal('');
  protected readonly clipDraft = signal({ title: '', publisher: '', referenceUrl: '' });
  protected readonly sourcePlaceholder = SOURCE_PLACEHOLDER;
  protected readonly syntheticSources = SYNTHETIC_PUBLIC_SOURCES;
  protected readonly sourceCards = [SOURCE_PLACEHOLDER, ...SYNTHETIC_PUBLIC_SOURCES];
  private publicPageOrigins: { view: ViewId; focusId: string; scrollY: number }[] = [];
  protected readonly aggregateData = computed(() =>
    this.importedAggregates().length ? this.importedAggregates() : DEMO_AGGREGATES,
  );
  protected readonly exportStatus = signal('');
  protected readonly heatmap = signal(false);
  protected readonly mapError = signal(false);
  protected readonly mapErrorDetails = signal('');
  protected readonly mapReady = signal(false);
  protected readonly filtersCollapsed = signal(false);
  protected readonly radiusOptionsOpen = signal(false);
  protected readonly mapExpanded = signal(false);
  protected readonly mapDark = signal(this.theme.dark());
  protected readonly reportMapDark = signal(this.theme.dark());
  protected readonly selectedPointId = signal<string | null>(null);
  protected readonly expandedResultDetailIds = signal<string[]>([]);
  protected readonly selectedTerritoryId = signal<number | null>(null);
  protected readonly searchQuery = signal('');
  protected readonly territories = signal<TerritoryFeature[]>([]);
  protected readonly showSyntheticRiskAreas = signal(false);
  protected readonly riskAreaQuery = signal('');
  protected readonly allRiskAreaFeatures = computed<TerritoryFeature[]>(() => [
    ...this.territories(),
    ...SYNTHETIC_RISK_AREAS,
  ]);
  protected readonly availableRiskAreas = computed(() => {
    const selected = new Set(
      this.activeFilters()
        .filter((filter) => filter.startsWith('territory:'))
        .map((filter) => filter.slice(10)),
    );
    const query = normalizeSearch(this.riskAreaQuery());
    return this.allRiskAreaFeatures().filter(
      (area) =>
        (area.id < 0 ? this.showSyntheticRiskAreas() : selected.has(area.properties.f)) &&
        (!query || normalizeSearch(area.properties.n).includes(query)),
    );
  });
  protected readonly selectedRiskArea = computed(() => {
    const area = this.allRiskAreaFeatures().find((area) => area.id === this.selectedTerritoryId());
    return area ? riskAreaDetails(area.properties) : null;
  });
  protected readonly riskAreaWarning = computed(() => {
    const details = this.selectedRiskArea();
    return details
      ? riskAreaTemporalWarning(details, this.resolvedDateRange(), this.visiblePoints())
      : '';
  });
  protected readonly riskLayerWarning = computed(() =>
    riskAreaTemporalWarning(
      riskAreaDetails({ n: '', f: 'NEU' }),
      this.resolvedDateRange(),
      this.visiblePoints(),
    ),
  );
  protected readonly territoryStatus = signal<'idle' | 'loading' | 'loaded' | 'error'>('idle');
  protected readonly reportStatus = signal('');
  protected readonly categoryChangeNotice = signal('');
  protected readonly pointConfirmed = signal(false);
  protected readonly reportMapStatus = signal<'idle' | 'loading' | 'ready' | 'error'>('idle');
  protected readonly reportMapErrorDetails = signal('');
  protected readonly coordinates = signal({ longitude: '', latitude: '' });
  protected readonly reportFields = signal<Record<string, string>>({});
  protected readonly selectedMunicipality = signal('');
  protected readonly selectedNeighborhood = signal('');
  protected readonly visibleAreaBounds = signal<QueryBounds | null>(null);
  protected readonly spatialQueryNotice = signal('');
  protected readonly outsideCoverage = signal(false);
  protected readonly queryMunicipalities = computed(() =>
    [
      ...new Set(
        this.allPoints()
          .map((point) => point.municipality)
          .filter((value): value is string => Boolean(value)),
      ),
    ].sort((a, b) => a.localeCompare(b, 'pt-BR')),
  );
  protected readonly queryNeighborhoods = computed(() =>
    [
      ...new Set(
        this.allPoints()
          .filter((point) => point.municipality === this.selectedMunicipality())
          .map((point) => point.neighborhood)
          .filter((value): value is string => Boolean(value)),
      ),
    ].sort((a, b) => a.localeCompare(b, 'pt-BR')),
  );
  protected readonly mappedOccurrenceCount = computed(
    () =>
      this.visiblePoints().filter((point) => point.kind === 'occurrence' && isMappedRecord(point))
        .length,
  );
  protected readonly listOnlyOccurrenceCount = computed(
    () => this.eventCount() - this.mappedOccurrenceCount(),
  );
  protected readonly simplePeriodOptions = [
    { id: '24h', label: '24 horas' },
    { id: '1w', label: '7 dias' },
    { id: 'ongoing', label: 'Em andamento' },
    { id: '1m', label: '1 mês' },
    { id: '3m', label: '3 meses' },
    { id: '6m', label: '6 meses' },
    { id: '1y', label: '1 ano' },
  ] as const;

  protected readonly advancedPeriodOptions = [
    ...this.simplePeriodOptions,
    { id: 'custom', label: 'Intervalo' },
  ] as const;

  protected readonly catalogueTypesWithSubtypes = computed(() => {
    const activeTypeFilters = this.activeFilters()
      .filter((filter) => filter.startsWith('type:'))
      .map((filter) => filter.slice(5));

    const activeCategories = this.activeFilters()
      .filter((filter) => filter.startsWith('category:'))
      .map((filter) => filter.slice(9));

    return OCCURRENCE_CATALOGUE.filter((type) => {
      if (type.subtypes.length === 0) return false;
      if (activeTypeFilters.length > 0) {
        return activeTypeFilters.includes(type.id);
      }
      return activeCategories.includes(type.category);
    });
  });

  protected readonly queryFilterSummary = computed(() => {
    const entries = this.activeFilters().map((filter) => {
      const [kind, value] = filter.split(':');
      if (kind === 'subtype') {
        const parts = filter.split(':');
        const typeId = parts[1];
        const subName = parts.slice(2).join(':');
        const typeLabel = OCCURRENCE_CATALOGUE.find((type) => type.id === typeId)?.label ?? typeId;
        return {
          id: filter,
          label: `subtipo: ${typeLabel} · ${subName}`,
          removeLabel: `Remover subtipo ${subName}`,
        };
      }
      if (kind === 'source') {
        const sourceName = this.availableSources.find((s) => s.id === value)?.name ?? value;
        return {
          id: filter,
          label: `fonte: ${sourceName}`,
          removeLabel: `Remover fonte ${sourceName}`,
        };
      }
      if (kind === 'situation') {
        const sitLabel = situationLabel(value as Situation);
        return {
          id: filter,
          label: `situação: ${sitLabel}`,
          removeLabel: `Remover situação ${sitLabel}`,
        };
      }
      const name =
        kind === 'type'
          ? (OCCURRENCE_CATALOGUE.find((type) => type.id === value)?.label ?? value)
          : kind === 'territory'
            ? (TERRITORY_GROUP_BY_ID.get(value as TerritoryCode)?.label ?? value)
            : reportValueLabel(value);
      const kindLabel =
        (
          {
            category: 'pilar',
            type: 'tipo',
            territory: 'área',
            poi: 'ponto de interesse',
            group: 'grupo',
            crime: 'classificação legada',
            source: 'fonte',
            situation: 'situação',
          } as Record<string, string>
        )[kind ?? ''] ?? 'filtro';
      return {
        id: filter,
        label: `${kindLabel}: ${name}`,
        removeLabel: `Remover ${kindLabel} ${name}`,
      };
    });
    if (this.period() !== '24h')
      entries.push({
        id: 'period',
        label:
          this.period() === 'custom'
            ? `Intervalo: ${this.customRangeStart() || 'incompleto'} a ${this.customRangeEnd() || 'incompleto'}`
            : ((
                {
                  '1w': 'Últimos 7 dias',
                  ongoing: 'Em andamento',
                  '1m': 'Último mês',
                  '3m': 'Últimos 3 meses',
                  '6m': 'Últimos 6 meses',
                  '1y': 'Último ano',
                } as Record<string, string>
              )[this.period()] ?? this.period()),
        removeLabel: 'Remover período e voltar às últimas 24 horas',
      });
    if (this.timeStart())
      entries.push({
        id: 'timeStart',
        label: `Horário a partir de ${this.timeStart()}`,
        removeLabel: 'Remover horário inicial',
      });
    if (this.timeEnd())
      entries.push({
        id: 'timeEnd',
        label: `Horário até ${this.timeEnd()}`,
        removeLabel: 'Remover horário final',
      });
    if (this.useRadius())
      entries.push({
        id: 'radius',
        label: `Raio: ${this.radiusMeters()} m`,
        removeLabel: 'Remover filtro por raio',
      });
    if (this.selectedMunicipality())
      entries.push({
        id: 'municipality',
        label: `Município: ${this.selectedMunicipality()}`,
        removeLabel: 'Remover município',
      });
    if (this.selectedNeighborhood())
      entries.push({
        id: 'neighborhood',
        label: `Bairro: ${this.selectedNeighborhood()}`,
        removeLabel: 'Remover bairro',
      });
    if (this.visibleAreaBounds())
      entries.push({
        id: 'bounds',
        label: 'Área visível aplicada',
        removeLabel: 'Remover área visível aplicada',
      });
    if (this.consultationMode() === 'advanced' && this.advancedTextFilter()) {
      entries.push({
        id: 'advancedText',
        label: `texto: "${this.advancedTextFilter()}"`,
        removeLabel: 'Remover busca por texto',
      });
    }
    if (
      this.consultationMode() === 'advanced' &&
      (this.minScore() !== null || this.maxScore() !== null)
    ) {
      const min = this.minScore();
      const max = this.maxScore();
      let label = 'nota: ';
      if (min !== null && max !== null) label += `${min} a ${max}`;
      else if (min !== null) label += `≥ ${min}`;
      else if (max !== null) label += `≤ ${max}`;
      entries.push({
        id: 'advancedScore',
        label,
        removeLabel: 'Remover filtro por faixa de nota',
      });
    }
    return entries;
  });
  private readonly platformId = inject(PLATFORM_ID);
  private pendingQueryCamera?: () => void;
  private map?: maplibregl.Map;
  private urbanMapStyle?: maplibregl.StyleSpecification;
  private leaflet?: typeof import('leaflet');
  private leafletLibrariesPromise?: Promise<typeof import('leaflet')>;
  private rasterTileProvider?: RasterTileProvider;
  private rasterTileProviderPromise?: Promise<RasterTileProvider>;
  private fallbackMap?: LeafletMap;
  private fallbackPointsLayer?: LeafletLayerGroup;
  private fallbackEventHeatLayer?: LeafletLayerGroup;
  private fallbackPoiHeatLayer?: LeafletLayerGroup;
  private fallbackRadiusLayer?: LeafletLayerGroup;
  private fallbackTerritoryLayer?: LeafletLayerGroup;
  private fallbackPointMarkers = new Map<string, import('leaflet').Marker>();
  private reportMap?: maplibregl.Map;
  private reportMapMarker?: maplibregl.Marker;
  private reportFallbackMap?: LeafletMap;
  private reportFallbackMarker?: LeafletCircleMarker;
  private reportMapInitPromise?: Promise<void>;
  private maplibre?: typeof import('maplibre-gl');
  private mapLibrariesPromise?: Promise<typeof import('maplibre-gl')>;
  private mapInitPromise?: Promise<void>;
  private useRasterMaps = false;
  private stopMapMonitoring?: () => void;
  private stopReportMapMonitoring?: () => void;
  private radiusCircleFactory?: typeof import('./maps/radius-geometry').createRadiusCircle;
  private territoryLoadPromise?: Promise<void>;
  private riskAreaHoverPopup?: maplibregl.Popup;
  private playbackTimer?: ReturnType<typeof setInterval>;
  private mapRefreshFrame?: number;
  private mapResizeObserver?: ResizeObserver;

  private readonly demoPoints: DemoPoint[] = disperseDemoOccurrences([
    {
      id: 'demo-001',
      name: 'Sinalização sem funcionamento',
      description: 'Exemplo fictício para demonstração do filtro de trânsito.',
      location: 'Centro, Rio de Janeiro',
      kind: 'occurrence',
      category: 'TRANSITO',
      group: 'OUTROS_REGISTROS',
      typeLabel: 'Semáforos desligados',
      occurrenceType: 'SEMAFOROS',
      severity: 'BAIXA',
      situation: 'CLOSED',
      situationHistory: [
        {
          situation: 'CLOSED',
          at: this.hoursAgo(2),
          reason: 'Resolução explicitamente confirmada nesta simulação de semáforo.',
        },
      ],
      operationalStatus: 'RESOLVED',
      occurredAt: this.hoursAgo(3),
      insertedAt: this.hoursAgo(2),
      sourceId: 'demo',
      publicationStatus: 'PUBLISHED',
      reliabilityScore: 3,
      coordinates: [-43.1812, -22.9035],
    },
    {
      id: 'demo-002',
      name: 'Interdição parcial simulada',
      description: 'Ocorrência fictícia de demonstração; não corresponde a um evento real.',
      location: 'Glória, Rio de Janeiro',
      kind: 'occurrence',
      category: 'TRANSITO',
      group: 'ALERTA',
      typeLabel: 'Interdição/bloqueio',
      occurrenceType: 'INTERDICAO',
      subtype: 'Parcial',
      severity: 'MODERADA',
      situation: 'ONGOING',
      situationHistory: [
        {
          situation: 'ONGOING',
          at: this.hoursAgo(1),
          reason: 'Confirmação fictícia de bloqueio parcial; validade sintética local de 4 horas.',
        },
      ],
      operationalStatus: 'ACTIVE',
      lastCheckedAt: this.hoursAgo(1),
      expiresAt: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
      occurredAt: this.hoursAgo(16),
      insertedAt: this.hoursAgo(15),
      sourceId: 'demo',
      publicationStatus: 'PUBLISHED',
      reliabilityScore: 3,
      coordinates: [-43.1748, -22.9194],
    },
    {
      id: 'demo-003',
      name: 'Exercício de classificação',
      description: 'Marcador sintético para validar filtros e acessibilidade.',
      location: 'Catete, Rio de Janeiro',
      kind: 'occurrence',
      category: 'SEGURANCA',
      group: 'CRIMES',
      crime: 'FURTO',
      typeLabel: 'Furto',
      occurrenceType: 'FURTO',
      severity: 'BAIXA',
      situation: 'UNKNOWN', // No supported resolution was authored for this theft fixture.
      operationalStatus: 'RESOLVED',
      occurredAt: this.hoursAgo(31),
      insertedAt: this.hoursAgo(28),
      sourceId: 'demo',
      publicationStatus: 'PUBLISHED',
      reliabilityScore: 3,
      coordinates: [-43.1817, -22.9264],
    },
    {
      id: 'demo-004',
      name: 'Ponto de alagamento de teste',
      description: 'Exemplo sintético de contingência, sem valor de alerta.',
      location: 'Cidade Nova, Rio de Janeiro',
      kind: 'occurrence',
      category: 'CONTINGENCIA',
      group: 'CALAMIDADE_PUBLICA',
      typeLabel: 'Alagamento/inundação',
      occurrenceType: 'ALAGAMENTO',
      severity: 'MODERADA',
      situation: 'ONGOING',
      situationHistory: [
        {
          situation: 'ONGOING',
          at: this.hoursAgo(36),
          reason: 'Confirmação fictícia antiga de alagamento; expiração não comprova resolução.',
        },
      ],
      operationalStatus: 'EXPIRED',
      lastCheckedAt: this.hoursAgo(36),
      expiresAt: this.hoursAgo(24),
      occurredAt: this.hoursAgo(52),
      insertedAt: this.hoursAgo(50),
      sourceId: 'demo',
      publicationStatus: 'PUBLISHED',
      reliabilityScore: 3,
      coordinates: [-43.2032, -22.9097],
    },
    ...createMetropolitanDemoOccurrences(new Date()),
    {
      id: 'poi-001',
      name: 'Unidade de saúde demonstrativa',
      description: 'Ponto de interesse fictício, incluído apenas para demonstração.',
      location: 'Lapa, Rio de Janeiro',
      kind: 'poi',
      poiType: 'HOSPITAL_PUBLICO',
      typeLabel: 'Hospital público',
      exclusive: false,
      insertedAt: this.hoursAgo(24),
      sourceId: 'demo',
      publicationStatus: 'PUBLISHED',
      reliabilityScore: 3,
      coordinates: [-43.1794, -22.9128],
    },
    {
      id: 'poi-002',
      name: 'Equipamento coletivo demonstrativo',
      description: 'Ponto de interesse fictício, não é um serviço real.',
      location: 'Saúde, Rio de Janeiro',
      kind: 'poi',
      poiType: 'ESTADIO',
      typeLabel: 'Estádio',
      exclusive: false,
      insertedAt: this.hoursAgo(24),
      sourceId: 'demo',
      publicationStatus: 'PUBLISHED',
      reliabilityScore: 3,
      coordinates: [-43.196, -22.895],
    },
  ]).map((point) => {
    const municipality = point.location.split(', ').at(-1)!;
    const neighborhood = point.location.startsWith('Recorte urbano demonstrativo')
      ? 'Setor demonstrativo'
      : point.location.split(', ')[0]!;
    const listOnly = ['demo-transito-008', 'demo-contingencia-008'].includes(point.id);
    return {
      ...point,
      municipality,
      neighborhood,
      locationPrecision: listOnly ? ('TERRITORY' as const) : ('POINT' as const),
      coordinates: listOnly ? null : point.coordinates,
      description:
        point.description +
        (listOnly
          ? ' Localização somente territorial no setor fictício; não há coordenadas sustentadas.'
          : ''),
    };
  });
  private readonly relatedDemoPoints = relateDemoOccurrences(this.demoPoints);

  protected readonly allPoints = computed(() =>
    [...this.relatedDemoPoints, ...this.importedRecords()].map((point) =>
      resolveSituation(point, this.queryReferenceDate()),
    ),
  );
  protected readonly resolvedDateRange = computed(() => {
    const selectedPeriod = this.period();
    if (selectedPeriod === 'ongoing') return null;
    if (selectedPeriod !== 'custom')
      return calendarRange(selectedPeriod, this.queryReferenceDate());
    if (!this.customRangeStart() || !this.customRangeEnd()) return null;
    try {
      const start = localDateTimeToInstant(this.customRangeStart());
      const end = localDateTimeToInstant(this.customRangeEnd());
      return start < end ? { start, end } : null;
    } catch {
      return null;
    }
  });
  protected readonly customRangeInvalid = computed(
    () => this.period() === 'custom' && this.resolvedDateRange() === null,
  );
  protected readonly radiusInvalid = computed(() => {
    if (!this.useRadius()) return false;
    const center = this.searchCenter();
    const longitude = Number(center.longitude);
    const latitude = Number(center.latitude);
    return (
      !Number.isFinite(longitude) ||
      !Number.isFinite(latitude) ||
      longitude < -180 ||
      longitude > 180 ||
      latitude < -90 ||
      latitude > 90 ||
      !Number.isFinite(this.radiusMeters()) ||
      this.radiusMeters() < MINIMUM_RADIUS_METERS ||
      this.radiusMeters() > MAXIMUM_RADIUS_METERS
    );
  });
  protected readonly visiblePoints = computed(() => {
    if (this.customRangeInvalid() || this.radiusInvalid() || this.scoreRangeInvalid()) return [];
    const filters = this.activeFilters();
    const categories = filters
      .filter((filter) => filter.startsWith('category:'))
      .map((filter) => filter.slice('category:'.length));
    const groups = filters
      .filter((filter) => filter.startsWith('group:'))
      .map((filter) => filter.slice('group:'.length));
    const crimes = filters
      .filter((filter) => filter.startsWith('crime:'))
      .map((filter) => filter.slice('crime:'.length));
    const types = filters
      .filter((filter) => filter.startsWith('type:'))
      .map((filter) => filter.slice(5));
    const subtypes =
      this.consultationMode() === 'advanced'
        ? filters
            .filter((filter) => filter.startsWith('subtype:'))
            .map((filter) => filter.slice('subtype:'.length))
        : undefined;
    const sources =
      this.consultationMode() === 'advanced'
        ? filters
            .filter((filter) => filter.startsWith('source:'))
            .map((filter) => filter.slice('source:'.length))
        : undefined;

    let situations: Situation[] | undefined;
    if (this.consultationMode() === 'advanced') {
      const activeSituations = filters
        .filter((filter) => filter.startsWith('situation:'))
        .map((filter) => filter.slice('situation:'.length) as Situation);

      if (this.period() === 'ongoing') {
        situations =
          activeSituations.length > 0
            ? activeSituations.filter((s) => s === 'ONGOING')
            : ['ONGOING'];
      } else {
        situations = activeSituations.length > 0 ? activeSituations : undefined;
      }
    } else {
      situations = this.period() === 'ongoing' ? ['ONGOING'] : undefined;
    }

    const poiTypes = filters
      .filter((filter) => filter.startsWith('poi:') && filter !== 'poi:EXCLUSIVO')
      .map((filter) => filter.slice('poi:'.length));
    const range = this.resolvedDateRange();
    const center = this.searchCenter();
    const textQuery =
      this.consultationMode() === 'advanced' ? this.advancedTextFilter() : undefined;
    const minScore =
      this.consultationMode() === 'advanced' && this.minScore() !== null
        ? this.minScore()!
        : undefined;
    const maxScore =
      this.consultationMode() === 'advanced' && this.maxScore() !== null
        ? this.maxScore()!
        : undefined;

    return filterRecords(this.allPoints(), {
      categories,
      municipalities: this.selectedMunicipality() ? [this.selectedMunicipality()] : undefined,
      neighborhoods: this.selectedNeighborhood() ? [this.selectedNeighborhood()] : undefined,
      bounds: this.visibleAreaBounds() ?? undefined,
      groups,
      crimes,
      types,
      subtypes: subtypes?.length ? subtypes : undefined,
      sources: sources?.length ? sources : undefined,
      textQuery,
      minScore,
      maxScore,
      poiTypes,
      situations,
      exclusivePois: filters.includes('poi:EXCLUSIVO'),
      start: range?.start,
      end: range?.end,
      timeStart: this.timeStart() || undefined,
      timeEnd: this.timeEnd() || undefined,
      center: this.useRadius() ? [Number(center.longitude), Number(center.latitude)] : undefined,
      radiusMeters: this.useRadius() ? this.radiusMeters() : undefined,
    });
  });
  protected readonly historyRecords = computed(() =>
    this.allPoints()
      .filter((point) => point.kind === 'occurrence')
      .filter((point) => {
        const query = normalizeSearch(this.historyQuery());
        return (
          !query ||
          normalizeSearch(
            `${point.name} ${point.description} ${point.location} ${point.sourceId}`,
          ).includes(query)
        );
      })
      .sort(
        (left, right) => Date.parse(right.occurredAt ?? '') - Date.parse(left.occurredAt ?? ''),
      ),
  );
  protected readonly activeReportItems = computed(() => {
    const center = this.informesCenter();
    const longitude = Number(center.longitude);
    const latitude = Number(center.latitude);
    if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return [];
    return queryActiveReports(this.allPoints(), {
      center: [longitude, latitude],
      radiusMeters: this.informesRadiusMeters(),
      referenceTime: this.queryReferenceDate(),
    });
  });
  protected readonly activeRecords = computed(() =>
    this.activeReportItems().map((item) => ({
      ...item.record,
      distanceMeters: item.distanceMeters,
      distanceLabel: item.distanceLabel,
      isOngoing: item.isOngoing,
      isClosed: item.isClosed,
      isUnknown: item.isUnknown,
      isUncertainTime: item.isUncertainTime,
      isUncertainSituation: item.isUncertainSituation,
      temporalStatus: item.temporalStatus,
    })),
  );
  private readonly relatedDetailIds = signal<Record<string, string>>({});
  protected readonly happeningCount = computed(
    () =>
      new Set(
        this.visiblePoints()
          .filter((point) => point.kind === 'occurrence')
          .map((point) => point.happeningId ?? point.id),
      ).size,
  );
  protected resultDetail(point: DemoPoint): DemoPoint {
    return this.allPoints().find((item) => item.id === this.relatedDetailIds()[point.id]) ?? point;
  }
  protected relatedOccurrences(point: DemoPoint): DemoPoint[] {
    if (point.kind !== 'occurrence') return [];
    return this.allPoints().filter(
      (item) =>
        item.kind === 'occurrence' &&
        item.id !== point.id &&
        (item.happeningId ?? item.id) === (point.happeningId ?? point.id) &&
        (!item.publicationStatus || item.publicationStatus === 'PUBLISHED'),
    );
  }
  protected isInQuery(point: DemoPoint): boolean {
    return this.visiblePoints().some((item) => item.id === point.id);
  }
  protected happeningSummary(point: DemoPoint): string {
    const family = [point, ...this.relatedOccurrences(point)];
    const inQuery = family.filter((item) => this.isInQuery(item)).length;
    return `${family.length} ${family.length === 1 ? 'ocorrência' : 'ocorrências'} · 1 acontecimento; ${inQuery} ${inQuery === 1 ? 'ocorrência' : 'ocorrências'} · 1 acontecimento no recorte`;
  }
  protected showRelated(point: DemoPoint, rootId?: string): void {
    if (rootId) this.relatedDetailIds.update((ids) => ({ ...ids, [rootId]: point.id }));
    else this.selectedPointId.set(point.id);
    setTimeout(() =>
      document
        .getElementById(
          rootId ? `map-result-detail-heading-${rootId}` : `${this.activeView()}-detail-heading`,
        )
        ?.focus(),
    );
  }
  protected publicReliability(point: DemoPoint): string {
    const score = point.reliabilityScore;
    return score !== undefined && Number.isInteger(score) && score >= 1 && score <= 5
      ? `${score} / 5`
      : 'Não informada';
  }
  protected readonly selectedDetail = computed(
    () => this.allPoints().find((point) => point.id === this.selectedPointId()) ?? null,
  );
  protected readonly visibleOpenResultDetailCount = computed(() => {
    const expanded = new Set(this.expandedResultDetailIds());
    return this.visiblePoints().filter((point) => expanded.has(point.id)).length;
  });
  protected readonly categoryMetrics = computed(() => {
    const occurrences = this.visiblePoints().filter((point) => point.kind === 'occurrence');
    const counts = this.categories.map((category) => ({
      id: category.id,
      label: category.label,
      count: occurrences.filter((point) => point.category === category.id).length,
    }));
    const maximum = Math.max(1, ...counts.map((entry) => entry.count));
    return counts.map((entry) => ({ ...entry, width: `${(entry.count / maximum) * 100}%` }));
  });
  protected readonly aggregateIndicators = computed(() => [
    ...new Set(this.aggregateData().map((item) => item.indicator)),
  ]);
  protected readonly aggregateTerritories = computed(() => [
    ...new Set(this.aggregateData().map((item) => item.territory)),
  ]);
  protected readonly aggregatePeriods = computed(() =>
    [...new Set(this.aggregateData().map((item) => item.period))].sort(),
  );
  protected readonly monthlyMetrics = computed(() => {
    const grouped = new Map<
      string,
      { territory: string; period: string; indicator: string; unit: string; value: number }
    >();
    for (const aggregate of this.aggregateData()) {
      const key = `${aggregate.territory}|${aggregate.indicator}|${aggregate.unit}|${aggregate.period}`;
      const current = grouped.get(key);
      grouped.set(key, {
        territory: aggregate.territory,
        period: aggregate.period,
        indicator: aggregate.indicator,
        unit: aggregate.unit,
        value: (current?.value ?? 0) + aggregate.value,
      });
    }
    const values = [...grouped.values()].sort((left, right) =>
      left.period.localeCompare(right.period),
    );
    const maxima = new Map<string, number>();
    for (const item of values) {
      const key = `${item.indicator}|${item.unit}`;
      maxima.set(key, Math.max(maxima.get(key) ?? 0, item.value));
    }
    return values.map((item) => ({
      ...item,
      width: `${(item.value / (maxima.get(`${item.indicator}|${item.unit}`) ?? 1)) * 100}%`,
    }));
  });
  protected readonly comparisonMetrics = computed(() => {
    const dataA = this.aggregateData().filter(
      (item) =>
        item.territory === this.analyticsTerritoryA() &&
        item.period === this.comparisonPeriodA() &&
        item.indicator === this.analyticsIndicator(),
    );
    const dataB = this.aggregateData().filter(
      (item) =>
        item.territory === this.analyticsTerritoryB() &&
        item.period === this.comparisonPeriodB() &&
        item.indicator === this.analyticsIndicator(),
    );
    const unitA = [...new Set(dataA.map((item) => item.unit))];
    const unitB = [...new Set(dataB.map((item) => item.unit))];
    const comparable = unitA.length === 1 && unitB.length === 1 && unitA[0] === unitB[0];
    const a = comparable ? dataA.reduce((total, item) => total + item.value, 0) : null;
    const b = comparable ? dataB.reduce((total, item) => total + item.value, 0) : null;
    return {
      a,
      b,
      unit: comparable ? unitA[0] : null,
      difference: a !== null && b !== null ? b - a : null,
      relativeDifference: a !== null && b !== null && a !== 0 ? ((b - a) / a) * 100 : null,
      comparable,
    };
  });
  protected readonly playbackRecords = computed(() => this.historyRecords());
  protected readonly currentPlaybackRecord = computed(
    () => this.playbackRecords()[this.playbackIndex()] ?? null,
  );
  protected readonly visibleClips = computed(() => {
    const query = normalizeSearch(this.clipsQuery());
    return this.clips().filter(
      (clip) => !query || normalizeSearch(`${clip.title} ${clip.publisher}`).includes(query),
    );
  });
  protected readonly pendingClipCount = computed(
    () => this.clips().filter((clip) => clip.status === 'PENDING').length,
  );
  protected readonly isDemonstrationOnly = computed(
    () => !this.sourceImports().some((item) => item.records > 0 || item.aggregates > 0),
  );
  protected readonly sourcesFreshness = computed(() => {
    const imported = this.sourceImports().at(-1);
    return imported
      ? `Último arquivo recebido: ${this.formatDateTime(imported.importedAt)}`
      : 'Nenhum arquivo externo foi importado nesta sessão.';
  });

  protected readonly searchResults = computed(() =>
    this.collectSearchResults(this.searchQuery()).slice(0, 8),
  );
  protected readonly searchResultTotal = computed(
    () => this.collectSearchResults(this.searchQuery()).length,
  );
  protected readonly searchHasMore = computed(
    () => this.searchResultTotal() > this.searchResults().length,
  );

  protected readonly territorySelected = computed(() =>
    this.activeFilters().some((filter) => filter.startsWith('territory:')),
  );
  protected readonly selectedTerritoryCount = computed(() =>
    TERRITORY_GROUPS.filter((group) =>
      this.activeFilters().includes(`territory:${group.id}`),
    ).reduce((count, group) => count + group.count, 0),
  );

  protected readonly eventCount = computed(
    () => this.visiblePoints().filter((point) => point.kind === 'occurrence').length,
  );

  constructor() {
    effect(() => {
      const dark = this.theme.dark();
      this.mapDark.set(dark);
      this.reportMapDark.set(dark);
      this.applyMapTheme(this.map, dark);
      this.applyMapTheme(this.reportMap, dark);
    });
  }

  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    try {
      this.filtersCollapsed.set(localStorage.getItem('vu2.filtersCollapsed') !== 'false');
      const savedMode =
        localStorage.getItem('vetor-consultation-mode') ??
        localStorage.getItem('vu2.consultationMode');
      if (savedMode === 'advanced' || savedMode === 'simple') {
        this.consultationMode.set(savedMode);
      }
      const saved = JSON.parse(localStorage.getItem('vu2.savedSearches') ?? '[]') as SavedSearch[];
      if (Array.isArray(saved)) this.savedSearches.set(saved);
      const clips = JSON.parse(localStorage.getItem('vu2.demoClips') ?? 'null') as
        DemoClip[] | null;
      if (Array.isArray(clips)) this.clips.set(clips);
    } catch {
      this.filtersCollapsed.set(true);
    }
    (window as unknown as Record<string, unknown>)['vetorUrbano'] = {
      simulatePendingUpdate: () => this.simulatePendingUpdate(),
      dismissPendingUpdate: () => this.dismissPendingUpdate(),
      simulateQueryLoading: (durationMs?: number) => this.simulateQueryLoading(durationMs),
      simulateQueryError: (msg?: string) => this.simulateQueryError(msg),
      retryQuery: () => this.retryQuery(),
      refreshLocalQuery: () => this.refreshLocalQuery(),
      expandQueryPeriod: () => this.expandQueryPeriod(),
      expandQueryTerritory: () => this.expandQueryTerritory(),
      clearQueryFilters: () => this.clearQueryFilters(),
    };
    void this.initializeMap();
  }

  ngOnDestroy(): void {
    if (this.mapRefreshFrame !== undefined) cancelAnimationFrame(this.mapRefreshFrame);
    this.mapResizeObserver?.disconnect();
    if (this.playbackTimer) clearInterval(this.playbackTimer);
    this.stopMapMonitoring?.();
    this.stopReportMapMonitoring?.();
    this.reportMapMarker?.remove();
    this.reportMap?.remove();
    this.reportFallbackMarker?.remove();
    this.reportFallbackMap?.remove();
    this.map?.remove();
    this.fallbackMap?.remove();
  }

  protected openView(view: ViewId): void {
    if (this.consultationMode() === 'simple' && (view === 'history' || view === 'insights')) {
      this.consultationMode.set('advanced');
      if (isPlatformBrowser(this.platformId)) {
        try {
          localStorage.setItem('vetor-consultation-mode', 'advanced');
        } catch {
          // ignore
        }
      }
      this.modeNotice.set(
        `Modo Análise e Inteligência ativado para acessar ${view === 'history' ? 'Histórico' : 'Relatórios'}.`,
      );
    }
    this.publicPageOrigins = [];
    this.activeView.set(view);
    this.mapExpanded.set(false);
    this.reportStatus.set('');
    // The public map's section stays mounted: preserve its camera and downloaded tiles.
    requestAnimationFrame(() => {
      if (view === 'map') {
        const container = document.getElementById('map-canvas');
        if (container && this.map?.getContainer?.() === container) this.map.resize();
        else if (container && this.fallbackMap?.getContainer() === container) {
          this.resizeFallbackMap();
        } else if (container) void this.initializeMap();
      }
      if (view === 'report' && this.selectedCategory()) void this.initializeReportMap();
      if (view !== 'report') this.disposeReportMap();
      document.querySelector<HTMLElement>(`[data-view-title="${view}"]`)?.focus();
    });
  }

  protected openPublicPage(page: PublicPage, event: Event): void {
    event.preventDefault();
    if (this.activeView() === page) return;
    const element = event.currentTarget as HTMLElement;
    this.publicPageOrigins.push({
      view: this.activeView(),
      focusId: element.id,
      scrollY: window.scrollY,
    });
    this.activeView.set(page);
    requestAnimationFrame(() =>
      document.querySelector<HTMLElement>(`[data-view-title="${page}"]`)?.focus(),
    );
  }

  protected returnFromPublicPage(): void {
    const origin = this.publicPageOrigins.pop();
    this.activeView.set(origin?.view ?? 'map');
    requestAnimationFrame(() => {
      if (this.activeView() === 'map') {
        this.map?.resize();
        this.fallbackMap?.invalidateSize();
      }
      window.scrollTo(0, origin?.scrollY ?? 0);
      const target = origin ? document.getElementById(origin.focusId) : null;
      (target ?? document.getElementById('main-content'))?.focus({ preventScroll: true });
    });
  }

  protected toggleFilters(): void {
    this.filtersCollapsed.update((collapsed) => !collapsed);
    if (!this.filtersCollapsed()) {
      this.radiusOptionsOpen.set(false);
      this.consultationView.set('map');
    }
    try {
      localStorage.setItem('vu2.filtersCollapsed', String(this.filtersCollapsed()));
    } catch {
      // The preference remains usable for this session if storage is unavailable.
    }
  }

  protected closeMapFilters(): void {
    if (!this.filtersCollapsed()) this.toggleFilters();
    document.querySelector<HTMLElement>('.map-filter-toggle')?.focus();
  }

  protected toggleRadiusOptions(): void {
    if (!this.useRadius()) this.toggleRadius(true);
    else this.radiusOptionsOpen.update((open) => !open);
    if (this.radiusOptionsOpen() && !this.filtersCollapsed()) this.toggleFilters();
  }

  protected toggleMapExpanded(): void {
    this.mapExpanded.update((expanded) => !expanded);
    requestAnimationFrame(() => {
      this.map?.resize();
      this.fallbackMap?.invalidateSize();
      if (this.mapExpanded()) {
        document.querySelector<HTMLElement>('.map-expand-toggle')?.focus();
      }
    });
  }

  protected toggleMapTheme(): void {
    this.mapDark.update((dark) => !dark);
    this.applyMapTheme(this.map, this.mapDark());
  }

  protected toggleReportMapTheme(): void {
    this.reportMapDark.update((dark) => !dark);
    this.applyMapTheme(this.reportMap, this.reportMapDark());
  }

  @HostListener('document:keydown.escape')
  protected closeExpandedMapOnEscape(): void {
    if (this.activeView() !== 'map') return;
    if (this.radiusOptionsOpen()) {
      this.radiusOptionsOpen.set(false);
      document.querySelector<HTMLElement>('.map-radius-disclosure')?.focus();
      return;
    }
    if (!this.filtersCollapsed()) {
      this.closeMapFilters();
      return;
    }
    if (!this.mapExpanded()) return;
    this.mapExpanded.set(false);
    requestAnimationFrame(() => {
      this.map?.resize();
      this.fallbackMap?.invalidateSize();
    });
  }

  @HostListener('document:keydown', ['$event'])
  protected containExpandedMapFocus(event: KeyboardEvent): void {
    if (!this.mapExpanded() || event.key !== 'Tab') return;
    const frame = document.querySelector<HTMLElement>('.map-frame.map-expanded');
    const focusable = frame?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, a[href], [tabindex]:not([tabindex="-1"])',
    );
    const visible = Array.from(focusable ?? []).filter(
      (element) => element.getClientRects().length > 0,
    );
    if (!visible.length) return;
    const first = visible[0]!;
    const last = visible[visible.length - 1]!;
    if (
      event.shiftKey &&
      (document.activeElement === first || !frame?.contains(document.activeElement))
    ) {
      event.preventDefault();
      last.focus();
    } else if (
      !event.shiftKey &&
      (document.activeElement === last || !frame?.contains(document.activeElement))
    ) {
      event.preventDefault();
      first.focus();
    }
  }

  protected submitMapSearch(): void {
    const first = this.searchResults()[0];
    if (first && this.searchQuery().trim().length >= 2) this.selectMapSearchResult(first);
    else document.getElementById('map-search')?.focus();
  }

  protected selectQuickPeriod(period: string): void {
    this.selectPeriod(period);
    if (period === 'custom') {
      this.expandedModule.set('intelligence');
      if (this.filtersCollapsed()) this.toggleFilters();
      requestAnimationFrame(() =>
        document.querySelector<HTMLInputElement>('.period-custom-options input')?.focus(),
      );
    }
  }

  protected setSearchQuery(query: string): void {
    this.searchQuery.set(query);
    const normalized = normalizeSearch(query);
    const occurrenceMatch = this.visiblePoints().some((point) =>
      normalizeSearch(`${point.name} ${point.location} ${point.description}`).includes(normalized),
    );
    if (
      normalized.length >= 2 &&
      !occurrenceMatch &&
      this.territoryStatus() !== 'loaded' &&
      this.territoryStatus() !== 'loading'
    ) {
      void this.loadTerritories();
    }
  }

  protected setHistorySearch(query: string): void {
    this.historyQuery.set(query);
  }

  protected selectQueryMunicipality(value: string): void {
    if (value && !this.queryMunicipalities().includes(value)) return;
    this.selectedMunicipality.set(value);
    this.selectedNeighborhood.set('');
    this.frameQueryTerritory();
    this.refreshMapData();
  }

  protected selectQueryNeighborhood(value: string): void {
    if (value && !this.queryNeighborhoods().includes(value)) return;
    this.selectedNeighborhood.set(value);
    this.frameQueryTerritory();
    this.refreshMapData();
  }

  private frameQueryTerritory(): void {
    const records = this.allPoints().filter(
      (point) =>
        (!this.selectedMunicipality() || point.municipality === this.selectedMunicipality()) &&
        (!this.selectedNeighborhood() || point.neighborhood === this.selectedNeighborhood()),
    );
    const bounds = demoRecordBounds(records);
    if (bounds) this.frameDemoBounds(bounds);
    this.spatialQueryNotice.set(
      'Território demonstrativo aplicado. Enquadramento pelas fixtures, sem limites municipais ou de bairro oficiais.',
    );
    this.outsideCoverage.set(false);
  }

  private frameDemoBounds([west, south, east, north]: QueryBounds): void {
    if (!this.map && !this.fallbackMap) {
      this.pendingQueryCamera = () => this.frameDemoBounds([west, south, east, north]);
      return;
    }
    this.map?.fitBounds(
      [
        [west, south],
        [east, north],
      ],
      { padding: 35, maxZoom: 14, duration: 0 },
    );
    this.fallbackMap?.fitBounds(
      [
        [south, west],
        [north, east],
      ],
      { padding: [35, 35], maxZoom: 14, animate: false },
    );
  }

  private positionDemoReference(reference: DemoLocationReference): void {
    if (!this.map && !this.fallbackMap) {
      this.pendingQueryCamera = () => this.positionDemoReference(reference);
      this.spatialQueryNotice.set('Referência fictícia aguardando o mapa. Filtros mantidos.');
      return;
    }
    this.map?.jumpTo({ center: reference.coordinates, zoom: 14 });
    this.fallbackMap?.setView([reference.coordinates[1], reference.coordinates[0]], 14, {
      animate: false,
    });
    this.outsideCoverage.set(!reference.withinCoverage);
    this.spatialQueryNotice.set(
      reference.withinCoverage
        ? 'Somente a câmera foi posicionada pela referência fictícia. Os filtros foram mantidos; use Usar área visível para aplicar um recorte.'
        : 'Fora da cobertura sintética da demonstração. Os filtros e resultados foram mantidos. Isto não delimita a cobertura metropolitana oficial.',
    );
  }

  protected applyVisibleQueryArea(): void {
    const camera = this.map?.getBounds() ?? this.fallbackMap?.getBounds();
    if (!camera) {
      this.spatialQueryNotice.set(
        'A câmera ainda não está disponível. A lista e os filtros territoriais continuam disponíveis.',
      );
      return;
    }
    const bounds: QueryBounds = [
      camera.getWest(),
      camera.getSouth(),
      camera.getEast(),
      camera.getNorth(),
    ];
    const coverage = demoRecordBounds(this.allPoints());
    if (
      !coverage ||
      bounds[2] < coverage[0] ||
      bounds[0] > coverage[2] ||
      bounds[3] < coverage[1] ||
      bounds[1] > coverage[3]
    ) {
      this.outsideCoverage.set(true);
      this.spatialQueryNotice.set(
        'Fora da cobertura sintética da demonstração. Nenhum filtro espacial foi aplicado.',
      );
      return;
    }
    this.visibleAreaBounds.set(bounds);
    this.outsideCoverage.set(false);
    this.spatialQueryNotice.set(
      'Área visível aplicada explicitamente. Registros somente territoriais não têm precisão para este recorte. Mover a câmera agora preserva a área aplicada.',
    );
    this.refreshMapData();
  }

  protected returnToDemoCoverage(): void {
    const bounds = demoRecordBounds(this.allPoints());
    if (bounds) this.frameDemoBounds(bounds);
    this.outsideCoverage.set(false);
    this.spatialQueryNotice.set('Câmera de volta ao recorte demonstrativo. Filtros mantidos.');
  }

  protected recordHasMapLocation(record: DemoPoint): boolean {
    return isMappedRecord(record);
  }

  protected setSavedSearchName(name: string): void {
    this.savedSearchName.set(name);
  }

  protected setAnalyticsIndicator(indicator: string): void {
    if (this.aggregateIndicators().includes(indicator)) this.analyticsIndicator.set(indicator);
  }

  protected setAnalyticsTerritory(side: 'a' | 'b', territory: string): void {
    if (!this.aggregateTerritories().includes(territory)) return;
    if (side === 'a') this.analyticsTerritoryA.set(territory);
    else this.analyticsTerritoryB.set(territory);
  }

  protected setComparisonPeriod(side: 'a' | 'b', period: string): void {
    if (!this.aggregatePeriods().includes(period)) return;
    if (side === 'a') this.comparisonPeriodA.set(period);
    else this.comparisonPeriodB.set(period);
  }

  protected selectMapSearchResult(result: MapSearchResult): void {
    if (result.kind === 'occurrence') this.focusPoint(result.point);
    else if (result.kind === 'reference') this.positionDemoReference(result.reference);
    else this.focusTerritory(result.area);
    this.searchQuery.set('');
  }

  protected focusPoint(point: DemoPoint): void {
    this.selectedPointId.set(point.id);
    if (isMappedRecord(point)) {
      this.map?.flyTo({ center: point.coordinates, zoom: 14.5 });
      this.fallbackMap?.flyTo([point.coordinates[1], point.coordinates[0]], 15.5);
    }
    this.refreshMapData();
  }

  protected showDetails(point: DemoPoint): void {
    this.selectedPointId.set(point.id);
  }

  protected isResultDetailOpen(pointId: string): boolean {
    return this.expandedResultDetailIds().includes(pointId);
  }

  protected toggleResultDetails(pointId: string): void {
    const expanded = this.expandedResultDetailIds();
    if (expanded.includes(pointId)) {
      this.expandedResultDetailIds.set(expanded.filter((id) => id !== pointId));
      this.relatedDetailIds.update((ids) => {
        const copy = { ...ids };
        delete copy[pointId];
        return copy;
      });
      setTimeout(() =>
        document
          .querySelector<HTMLButtonElement>(`[data-result-detail-toggle="${CSS.escape(pointId)}"]`)
          ?.focus(),
      );
      return;
    }
    if (this.visibleOpenResultDetailCount() >= 5) return;
    this.expandedResultDetailIds.set([...expanded, pointId]);
  }

  protected closeDetails(): void {
    this.selectedPointId.set(null);
    this.refreshMapData();
  }

  protected cancelMapPick(): void {
    const purpose = this.mapPickPurpose();
    this.mapPickPurpose.set(null);
    if (purpose === 'active') {
      this.activeView.set('active');
    }
  }

  protected retryMap(): void {
    this.stopMapMonitoring?.();
    this.map?.remove();
    this.map = undefined;
    this.fallbackMap?.remove();
    this.fallbackMap = undefined;
    this.fallbackPointsLayer = undefined;
    this.fallbackPointMarkers.clear();
    this.fallbackEventHeatLayer = undefined;
    this.fallbackPoiHeatLayer = undefined;
    this.fallbackRadiusLayer = undefined;
    this.fallbackTerritoryLayer = undefined;
    this.mapReady.set(false);
    this.mapError.set(false);
    this.mapErrorDetails.set('');
    void this.initializeMap();
  }

  protected toggleRiskLayer(): void {
    const selected = this.territorySelected();
    this.activeFilters.update((filters) =>
      selected
        ? filters.filter((filter) => !filter.startsWith('territory:'))
        : [...filters, ...TERRITORY_GROUPS.map((group) => `territory:${group.id}`)],
    );
    if (!selected) void this.loadTerritories();
    else this.selectedTerritoryId.set(null);
    this.applyTerritoryFilter();
  }

  protected toggleSyntheticRiskAreas(): void {
    this.showSyntheticRiskAreas.update((visible) => !visible);
    if (!this.showSyntheticRiskAreas() && (this.selectedTerritoryId() ?? 0) < 0)
      this.selectedTerritoryId.set(null);
    this.installTerritoryLayer();
    this.applyTerritoryFilter();
  }

  protected openRiskArea(area: TerritoryFeature): void {
    this.selectTerritoryHighlight(area.id);
    if (isPlatformBrowser(this.platformId))
      requestAnimationFrame(() => document.getElementById('risk-area-detail-heading')?.focus());
  }

  protected closeRiskArea(): void {
    this.selectTerritoryHighlight(null);
    if (isPlatformBrowser(this.platformId))
      document.querySelector<HTMLInputElement>('[data-risk-area-search]')?.focus();
  }

  protected riskDateLabel(time?: FactTime): string {
    return time
      ? formatFactTime({ id: 'reference-only', kind: 'poi', coordinates: [0, 0], factTime: time })
      : 'Indisponível';
  }

  protected focusTerritory(area: TerritoryFeature): void {
    const filter = `territory:${area.properties.f}`;
    if (!this.activeFilters().includes(filter)) {
      this.activeFilters.update((filters) => [...filters, filter]);
    }
    this.openRiskArea(area);
    this.applyTerritoryFilter();
    this.map?.fitBounds(this.getTerritoryBounds(area), { maxZoom: 15, padding: 56 });
    if (this.fallbackMap && this.leaflet) {
      this.fallbackMap.fitBounds(this.leaflet.geoJSON(area).getBounds(), {
        maxZoom: 16,
        padding: [56, 56],
      });
    }
  }

  protected retryTerritories(): void {
    void this.loadTerritories();
  }

  protected toggleModule(module: ModuleId): void {
    this.expandedModule.update((current) => (current === module ? null : module));
  }

  protected toggleFilter(filter: string): void {
    this.querySummaryNotice.set('');
    this.activeFilters.update((filters) =>
      filters.includes(filter) ? filters.filter((item) => item !== filter) : [...filters, filter],
    );
    this.refreshMapData();
    if (filter.startsWith('territory:')) {
      this.applyTerritoryFilter();
      if (this.activeFilters().includes(filter)) void this.loadTerritories();
    }
  }

  protected isFilterActive(filter: string): boolean {
    return this.activeFilters().includes(filter);
  }

  protected removeQueryFilter(id: string): void {
    if (id === 'municipality') {
      this.selectedMunicipality.set('');
      this.selectedNeighborhood.set('');
    } else if (id === 'neighborhood') this.selectedNeighborhood.set('');
    else if (id === 'bounds') this.visibleAreaBounds.set(null);
    else if (id === 'period') {
      this.period.set('24h');
      if (this.consultationMode() === 'simple') {
        this.periodExplicitlyChosenInSimple.set(true);
      }
    } else if (id === 'timeStart') this.timeStart.set('');
    else if (id === 'timeEnd') this.timeEnd.set('');
    else if (id === 'radius') this.useRadius.set(false);
    else if (id === 'advancedText') this.advancedTextFilter.set('');
    else if (id === 'advancedScore') {
      this.minScore.set(null);
      this.maxScore.set(null);
    } else this.activeFilters.update((filters) => filters.filter((filter) => filter !== id));
    this.querySummaryNotice.set(
      id === 'period'
        ? 'Período restaurado: últimas 24 horas.'
        : 'Filtro removido. Resultados atualizados.',
    );
    this.refreshMapData();
    if (id.startsWith('territory:')) this.applyTerritoryFilter();
    this.focusQueryClearButton();
  }

  protected clearQueryFilters(): void {
    this.selectedMunicipality.set('');
    this.selectedNeighborhood.set('');
    this.visibleAreaBounds.set(null);
    this.activeFilters.set(CATEGORIES.map((category) => `category:${category.id}`));
    this.period.set('24h');
    this.customRangeStart.set('');
    this.customRangeEnd.set('');
    this.timeStart.set('');
    this.timeEnd.set('');
    this.useRadius.set(false);
    this.advancedTextFilter.set('');
    this.minScore.set(null);
    this.maxScore.set(null);
    this.suspendedAdvancedFilters.set(null);
    if (this.consultationMode() === 'simple') {
      this.periodExplicitlyChosenInSimple.set(true);
    }
    this.querySummaryNotice.set(
      'Filtros limpos: três pilares e últimas 24 horas. A câmera foi mantida.',
    );
    this.refreshMapData();
    this.applyTerritoryFilter();
    this.focusQueryClearButton();
  }

  private focusQueryClearButton(): void {
    if (isPlatformBrowser(this.platformId))
      setTimeout(() =>
        document.querySelector<HTMLButtonElement>('[data-clear-query-filters]')?.focus(),
      );
  }

  protected setAdvancedTextFilter(query: string): void {
    this.advancedTextFilter.set(query);
    this.refreshMapData();
  }

  protected setMinScore(value: string): void {
    const parsed = value ? parseInt(value, 10) : null;
    this.minScore.set(Number.isFinite(parsed) ? parsed : null);
    this.refreshMapData();
  }

  protected setMaxScore(value: string): void {
    const parsed = value ? parseInt(value, 10) : null;
    this.maxScore.set(Number.isFinite(parsed) ? parsed : null);
    this.refreshMapData();
  }

  protected selectPeriod(period: string): void {
    const available = ['24h', '1w', '1m', '3m', '6m', '1y', 'custom', 'ongoing'];
    if (!available.includes(period)) return;
    this.querySummaryNotice.set('');
    this.period.set(period as DatePreset | 'custom' | 'ongoing');
    if (this.consultationMode() === 'simple') {
      this.periodExplicitlyChosenInSimple.set(true);
    }
    this.refreshMapData();
  }

  protected setCustomRange(axis: 'start' | 'end', value: string): void {
    if (axis === 'start') this.customRangeStart.set(value);
    else this.customRangeEnd.set(value);
    this.period.set('custom');
    this.refreshMapData();
  }

  protected setTimeRange(axis: 'start' | 'end', value: string): void {
    if (axis === 'start') this.timeStart.set(value);
    else this.timeEnd.set(value);
    this.refreshMapData();
  }

  protected formatQueryTimestamp(date: Date): string {
    return new Intl.DateTimeFormat('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZone: 'America/Sao_Paulo',
    }).format(date);
  }

  protected simulatePendingUpdate(): void {
    this.pendingUpdateAvailable.set(true);
  }

  protected dismissPendingUpdate(): void {
    this.pendingUpdateAvailable.set(false);
  }

  protected simulateQueryLoading(durationMs = 400): void {
    this.queryLoading.set(true);
    if (isPlatformBrowser(this.platformId)) {
      setTimeout(() => {
        this.queryLoading.set(false);
      }, durationMs);
    }
  }

  protected simulateQueryError(message?: string): void {
    this.queryLoading.set(false);
    this.queryError.set(true);
    this.queryErrorMessage.set(message ?? 'Falha temporária ao recuperar ocorrências publicadas.');
  }

  protected retryQuery(): void {
    this.queryError.set(false);
    this.queryErrorMessage.set('');
    this.refreshLocalQuery();
  }

  protected expandQueryPeriod(): void {
    const current = this.period();
    if (current === '24h') {
      this.period.set('1w');
    } else if (current === '1w') {
      this.period.set('1m');
    } else if (current === '1m') {
      this.period.set('3m');
    } else if (current === '3m') {
      this.period.set('6m');
    } else {
      this.period.set('1y');
    }
    if (this.consultationMode() === 'simple') {
      this.periodExplicitlyChosenInSimple.set(true);
    }
    this.querySummaryNotice.set('Período ampliado para expandir os resultados.');
    this.refreshMapData();
  }

  protected expandQueryTerritory(): void {
    if (this.useRadius()) {
      if (this.radiusMeters() < MAXIMUM_RADIUS_METERS) {
        this.radiusMeters.set(MAXIMUM_RADIUS_METERS);
      } else {
        this.useRadius.set(false);
      }
    }
    this.selectedMunicipality.set('');
    this.selectedNeighborhood.set('');
    this.visibleAreaBounds.set(null);
    this.activeFilters.update((filters) =>
      filters.filter(
        (filter) => !filter.startsWith('municipality:') && !filter.startsWith('neighborhood:'),
      ),
    );
    this.querySummaryNotice.set('Território ampliado para toda a Região Metropolitana.');
    this.refreshMapData();
  }

  protected refreshLocalQuery(): void {
    this.pendingUpdateAvailable.set(false);
    this.queryError.set(false);
    this.queryErrorMessage.set('');
    this.queryReferenceDate.set(new Date());
    this.refreshMapData();
  }

  protected setRadiusMeters(value: string): void {
    const radius = Number(value);
    this.radiusMeters.set(
      Number.isFinite(radius)
        ? Math.min(
            MAXIMUM_RADIUS_METERS,
            Math.max(
              MINIMUM_RADIUS_METERS,
              MINIMUM_RADIUS_METERS +
                Math.round((radius - MINIMUM_RADIUS_METERS) / RADIUS_STEP_METERS) *
                  RADIUS_STEP_METERS,
            ),
          )
        : Number.NaN,
    );
    this.refreshMapData();
  }

  protected adjustRadiusWithWheel(event: WheelEvent): void {
    if (!this.useRadius() || event.deltaY === 0) return;
    event.preventDefault();
    event.stopPropagation();
    const next =
      this.radiusMeters() + (event.deltaY < 0 ? RADIUS_STEP_METERS : -RADIUS_STEP_METERS);
    this.setRadiusMeters(
      String(Math.max(MINIMUM_RADIUS_METERS, Math.min(MAXIMUM_RADIUS_METERS, next))),
    );
  }

  protected toggleRadius(enabled: boolean): void {
    this.useRadius.set(enabled);
    this.radiusOptionsOpen.set(enabled);
    if (enabled && !this.filtersCollapsed()) this.toggleFilters();
    if (!enabled && this.mapPickPurpose() === 'radius') this.mapPickPurpose.set(null);
    this.refreshMapData();
  }

  protected setSearchCoordinate(axis: 'longitude' | 'latitude', value: string): void {
    this.searchCenter.update((center) => ({ ...center, [axis]: value }));
    this.refreshMapData();
  }

  protected setInformesCoordinate(axis: 'longitude' | 'latitude', value: string): void {
    this.informesCenter.update((center) => ({ ...center, [axis]: value }));
  }

  protected setInformesRadius(value: string | number, target?: HTMLInputElement): void {
    const radius = Number(value);
    if (Number.isFinite(radius)) {
      const clamped = Math.min(
        INFORMES_MAXIMUM_RADIUS_METERS,
        Math.max(INFORMES_MINIMUM_RADIUS_METERS, radius),
      );
      this.informesRadiusMeters.set(clamped);
      if (target && target.value !== String(clamped)) {
        target.value = String(clamped);
      }
    }
  }

  protected resetInformesCenter(): void {
    this.informesCenter.set({
      longitude: String(CENTRAL_DO_BRASIL_CENTER[0]),
      latitude: String(CENTRAL_DO_BRASIL_CENTER[1]),
    });
    this.informesRadiusMeters.set(INFORMES_INITIAL_RADIUS_METERS);
  }

  protected beginMapPick(purpose: 'report' | 'radius' | 'active'): void {
    this.mapPickPurpose.set(purpose);
    this.consultationView.set('map');
    if (purpose === 'report' || purpose === 'active') this.activeView.set('map');
    requestAnimationFrame(() => {
      this.map?.resize();
      this.fallbackMap?.invalidateSize();
    });
  }

  protected acceptMapPick(longitude: number, latitude: number): void {
    const purpose = this.mapPickPurpose();
    if (!purpose && !this.useRadius()) return;
    if (purpose === 'report') {
      this.coordinates.set({ longitude: String(longitude), latitude: String(latitude) });
      this.pointConfirmed.set(true);
      this.reportStatus.set('Ponto escolhido no mapa e confirmado para esta demonstração.');
      this.activeView.set('report');
    } else if (purpose === 'active') {
      this.informesCenter.set({ longitude: String(longitude), latitude: String(latitude) });
      this.activeView.set('active');
    } else {
      this.searchCenter.set({ longitude: String(longitude), latitude: String(latitude) });
      this.useRadius.set(true);
    }
    this.mapPickPurpose.set(null);
    this.refreshMapData();
  }

  private handleMapClick(longitude: number, latitude: number, button = 0): void {
    if (button !== 0) return;
    this.acceptMapPick(longitude, latitude);
  }

  protected saveCurrentSearch(): void {
    const name = this.savedSearchName().trim();
    if (!name) return;
    const saved: SavedSearch = {
      id: `search-${Date.now()}`,
      name,
      filters: [...this.activeFilters()],
      period: this.period(),
      customRangeStart: this.customRangeStart(),
      customRangeEnd: this.customRangeEnd(),
      timeStart: this.timeStart(),
      timeEnd: this.timeEnd(),
      useRadius: this.useRadius(),
      radiusMeters: this.radiusMeters(),
      center: { ...this.searchCenter() },
      municipality: this.selectedMunicipality(),
      neighborhood: this.selectedNeighborhood(),
      bounds: this.visibleAreaBounds() ?? undefined,
    };
    const searches = [...this.savedSearches(), saved];
    this.savedSearches.set(searches);
    this.savedSearchName.set('');
    this.persistLocalValue('vu2.savedSearches', searches);
  }

  protected applySavedSearch(search: SavedSearch): void {
    const incompatible = search.filters.filter(
      (filter) =>
        filter.startsWith('group:') ||
        filter.startsWith('crime:') ||
        (filter.startsWith('type:') &&
          !OCCURRENCE_CATALOGUE.some((type) => filter === `type:${type.id}`)),
    );
    if (
      incompatible.length ||
      !['24h', '1w', '1m', '3m', '6m', '1y', 'custom', 'ongoing'].includes(search.period)
    ) {
      this.savedSearchNotice.set(
        'Consulta salva incompatível com o catálogo atual. Nenhum filtro foi aplicado. Recrie a consulta; a versão salva foi preservada.',
      );
      return;
    }
    this.savedSearchNotice.set('Consulta salva aplicada.');
    this.selectedMunicipality.set(search.municipality ?? '');
    this.selectedNeighborhood.set(search.neighborhood ?? '');
    this.visibleAreaBounds.set(search.bounds ?? null);
    this.activeFilters.set([...new Set(search.filters)]);
    this.period.set(search.period as DatePreset | 'custom' | 'ongoing');
    this.customRangeStart.set(search.customRangeStart ?? '');
    this.customRangeEnd.set(search.customRangeEnd ?? '');
    this.timeStart.set(search.timeStart ?? '');
    this.timeEnd.set(search.timeEnd ?? '');
    this.useRadius.set(search.useRadius ?? false);
    this.radiusMeters.set(search.radiusMeters ?? 1000);
    this.searchCenter.set(
      search.center ?? {
        longitude: String(CENTRAL_DO_BRASIL_CENTER[0]),
        latitude: String(CENTRAL_DO_BRASIL_CENTER[1]),
      },
    );
    this.refreshMapData();
  }

  protected removeSavedSearch(id: string): void {
    const searches = this.savedSearches().filter((search) => search.id !== id);
    this.savedSearches.set(searches);
    this.persistLocalValue('vu2.savedSearches', searches);
  }

  private persistLocalValue(key: string, value: unknown): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      this.exportStatus.set('O navegador não permitiu salvar esta preferência localmente.');
    }
  }

  protected toggleConsultationMode(): void {
    if (this.consultationMode() === 'simple') {
      this.consultationMode.set('advanced');
      try {
        localStorage.setItem('vetor-consultation-mode', 'advanced');
      } catch {
        // ignore
      }

      const suspended = this.suspendedAdvancedFilters();
      if (suspended) {
        let removedIncompatible = false;
        let reappliedCount = 0;
        const toReapply: string[] = [];

        for (const subtypeFilter of suspended.subtypes) {
          const parts = subtypeFilter.split(':');
          const typeId = parts[1];
          const activeTypeFilters = this.activeFilters().filter((f) => f.startsWith('type:'));
          let isTypeActive = false;
          if (activeTypeFilters.length > 0) {
            isTypeActive = this.activeFilters().includes(`type:${typeId}`);
          } else {
            const item = OCCURRENCE_CATALOGUE.find((t) => t.id === typeId);
            isTypeActive = item
              ? this.activeFilters().includes(`category:${item.category}`)
              : false;
          }

          if (isTypeActive) {
            toReapply.push(subtypeFilter);
            reappliedCount++;
          } else {
            removedIncompatible = true;
          }
        }

        if (suspended.sources && suspended.sources.length > 0) {
          toReapply.push(...suspended.sources);
          reappliedCount++;
        }
        if (suspended.situations && suspended.situations.length > 0) {
          toReapply.push(...suspended.situations);
          reappliedCount++;
        }

        if (toReapply.length > 0) {
          this.activeFilters.update((filters) => [...filters, ...toReapply]);
        }

        if (suspended.customPeriod) {
          if (!this.periodExplicitlyChosenInSimple()) {
            this.period.set('custom');
            if (suspended.customRangeStart) this.customRangeStart.set(suspended.customRangeStart);
            if (suspended.customRangeEnd) this.customRangeEnd.set(suspended.customRangeEnd);
            reappliedCount++;
          }
        }

        if (suspended.textFilter) {
          this.advancedTextFilter.set(suspended.textFilter);
          reappliedCount++;
        }

        if (suspended.minScore !== null && suspended.minScore !== undefined) {
          this.minScore.set(suspended.minScore);
          reappliedCount++;
        }
        if (suspended.maxScore !== null && suspended.maxScore !== undefined) {
          this.maxScore.set(suspended.maxScore);
          reappliedCount++;
        }

        if (removedIncompatible) {
          this.modeNotice.set('Subtipo incompatível com o tipo selecionado foi removido.');
        } else if (reappliedCount > 0) {
          this.modeNotice.set('Filtros avançados reaplicados.');
        } else {
          this.modeNotice.set('Modo Análise e Inteligência ativo.');
        }

        this.suspendedAdvancedFilters.set(null);
        this.periodExplicitlyChosenInSimple.set(false);
      } else {
        this.modeNotice.set('Modo Análise e Inteligência ativo.');
      }
    } else {
      this.consultationMode.set('simple');
      try {
        localStorage.setItem('vetor-consultation-mode', 'simple');
      } catch {
        // ignore
      }

      if (this.activeView() === 'history' || this.activeView() === 'insights') {
        this.openView('map');
      }

      if (this.heatmap()) {
        this.heatmap.set(false);
      }

      const activeSubtypes = this.activeFilters().filter((f) => f.startsWith('subtype:'));
      const activeSources = this.activeFilters().filter((f) => f.startsWith('source:'));
      const activeSituations = this.activeFilters().filter((f) => f.startsWith('situation:'));
      const isCustomPeriod = this.period() === 'custom';
      const hasTextFilter = Boolean(this.advancedTextFilter().trim());
      const hasMinScore = this.minScore() !== null;
      const hasMaxScore = this.maxScore() !== null;

      const hadAdvancedFilters =
        activeSubtypes.length > 0 ||
        activeSources.length > 0 ||
        activeSituations.length > 0 ||
        isCustomPeriod ||
        hasTextFilter ||
        hasMinScore ||
        hasMaxScore;

      if (hadAdvancedFilters) {
        this.suspendedAdvancedFilters.set({
          subtypes: activeSubtypes,
          sources: activeSources,
          situations: activeSituations,
          customPeriod: isCustomPeriod,
          customRangeStart: isCustomPeriod ? this.customRangeStart() : undefined,
          customRangeEnd: isCustomPeriod ? this.customRangeEnd() : undefined,
          textFilter: hasTextFilter ? this.advancedTextFilter() : undefined,
          minScore: this.minScore(),
          maxScore: this.maxScore(),
        });

        this.activeFilters.update((filters) =>
          filters.filter(
            (f) =>
              !f.startsWith('subtype:') && !f.startsWith('source:') && !f.startsWith('situation:'),
          ),
        );

        if (isCustomPeriod) {
          this.period.set('24h');
        }
        this.advancedTextFilter.set('');
        this.minScore.set(null);
        this.maxScore.set(null);

        this.modeNotice.set('Filtros avançados suspensos no Modo simples.');
      } else {
        this.suspendedAdvancedFilters.set(null);
        this.modeNotice.set('Modo simples ativo.');
      }
      this.periodExplicitlyChosenInSimple.set(false);
    }

    this.refreshMapData();
  }

  protected toggleHeatmap(): void {
    if (this.consultationMode() === 'simple') {
      this.consultationMode.set('advanced');
      if (isPlatformBrowser(this.platformId)) {
        try {
          localStorage.setItem('vetor-consultation-mode', 'advanced');
        } catch {
          // ignore
        }
      }
      this.modeNotice.set(
        'Mancha térmica é um recurso de Análise e Inteligência. Modo avançado ativado.',
      );
    }
    this.heatmap.update((active) => !active);
    this.updateMapLayers();
  }

  protected chooseCategory(category: Category): void {
    this.selectedCategory.set(category);
    const commonFieldNames = ['nome', 'descricao', 'local', 'ocorridoEm', 'severidade'];
    let clearedCategoryFields = false;
    this.reportFields.update((fields) =>
      Object.fromEntries(
        Object.entries(fields).filter(([name]) => {
          const isCommonField = commonFieldNames.includes(name);
          if (!isCommonField) clearedCategoryFields = true;
          return isCommonField;
        }),
      ),
    );
    this.categoryChangeNotice.set(
      clearedCategoryFields
        ? 'Os campos específicos da categoria anterior foram limpos; os dados comuns foram preservados.'
        : '',
    );
    this.reportStatus.set('');
    if (this.activeView() === 'report') {
      requestAnimationFrame(() => void this.initializeReportMap());
    }
  }

  protected setField(name: string, value: string): void {
    this.reportFields.update((fields) => ({ ...fields, [name]: value }));
    if (name === 'grupo' && value !== 'CRIMES') {
      this.reportFields.update((fields) => {
        const { tipoCrime: _discarded, ...remaining } = fields;
        return remaining;
      });
    }
  }

  protected setCoordinate(axis: 'longitude' | 'latitude', value: string): void {
    this.coordinates.update((point) => ({ ...point, [axis]: value }));
    this.pointConfirmed.set(false);
    this.updateReportMapMarker();
  }

  protected confirmPoint(): void {
    const { longitude, latitude } = this.coordinates();
    const lon = Number(longitude);
    const lat = Number(latitude);
    if (
      longitude.trim() === '' ||
      latitude.trim() === '' ||
      !Number.isFinite(lon) ||
      !Number.isFinite(lat) ||
      lon < -180 ||
      lon > 180 ||
      lat < -90 ||
      lat > 90
    ) {
      this.pointConfirmed.set(false);
      this.reportStatus.set('Informe longitude entre −180 e 180 e latitude entre −90 e 90.');
      return;
    }
    this.pointConfirmed.set(true);
    this.reportStatus.set('Ponto conferido. O envio ainda depende da API de cadastro.');
  }

  protected submitReport(event: Event): void {
    event.preventDefault();
    if (!this.selectedCategory()) {
      this.reportStatus.set('Escolha uma categoria para continuar.');
      return;
    }
    const fields = this.reportFields();
    if ((fields['nome'] ?? '').trim().length < 3 || (fields['local'] ?? '').trim().length < 3) {
      this.reportStatus.set('Informe título e local de referência com pelo menos 3 caracteres.');
      return;
    }
    if (!fields['ocorridoEm']) {
      this.reportStatus.set('Informe quando o fato ocorreu.');
      return;
    }
    try {
      if (localDateTimeToInstant(fields['ocorridoEm']) > new Date()) {
        this.reportStatus.set('A data e hora do fato não podem estar no futuro.');
        return;
      }
    } catch {
      this.reportStatus.set('Informe uma data e hora válidas.');
      return;
    }
    if (!this.pointConfirmed()) {
      this.reportStatus.set('Confirme as coordenadas antes de continuar.');
      return;
    }
    this.reportStatus.set('Cadastro indisponível nesta demonstração. Nenhum dado foi enviado.');
  }

  protected currentBrazilLocalDateTime(): string {
    return new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .format(new Date())
      .replace(' ', 'T');
  }

  protected readonly formatFactTime = formatFactTime;
  protected readonly situationLabel = situationLabel;
  protected temporalLabel(record: DemoRecord): string {
    const range = this.resolvedDateRange();
    if (!range)
      return record.situation === 'ONGOING'
        ? 'Confirmação vigente; sem recorte do início'
        : 'Sem confirmação vigente; fora da seleção Em andamento';
    if (temporalInclusion(record, range) === 'OUTSIDE') return 'Fora do período';
    return temporalInclusion(record, range) === 'POSSIBLE'
      ? 'Possivelmente dentro do período'
      : 'Certamente dentro do período';
  }
  protected readonly temporalCounts = computed(() => {
    const range = this.resolvedDateRange();
    const points = this.visiblePoints().filter((point) => point.kind === 'occurrence');
    const possible = range
      ? points.filter((point) => temporalInclusion(point, range) === 'POSSIBLE').length
      : 0;
    return { certain: points.length - possible, possible };
  });

  protected formatTime(iso: string): string {
    return new Intl.DateTimeFormat('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Sao_Paulo',
    }).format(new Date(iso));
  }

  protected formatDateTime(iso: string): string {
    return new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
      timeZone: 'America/Sao_Paulo',
    }).format(new Date(iso));
  }

  protected statusLabel(status?: string): string {
    const labels: Record<string, string> = {
      ACTIVE: 'Ativo',
      MONITORING: 'Em acompanhamento',
      RESOLVED: 'Resolvido',
      EXPIRED: 'Expirado sem confirmação',
    };
    return labels[status ?? ''] ?? 'Sem estado operacional informado';
  }

  protected recordTypeLabel(record: DemoPoint): string {
    return (
      record.typeLabel ?? record.crime ?? record.group ?? record.poiType ?? 'Tipo não informado'
    );
  }

  protected recordSubtypeLabel(record: DemoPoint): string {
    return record.subtype ?? UNKNOWN_SUBTYPE;
  }

  protected sourceLabel(record: DemoPoint): string {
    return record.sourceId === 'demo'
      ? 'Fonte fictícia — Demonstração local'
      : (record.sourceId ?? 'Não informada');
  }

  protected markerCode(record: DemoPoint): string {
    const codes: Record<string, string> = {
      SINALIZACAO: 'S',
      INTERDICAO: 'I',
      COLISAO: '×',
      CONGESTIONAMENTO: 'C',
      PANE: 'P',
      FURTO: 'F',
      ALAGAMENTO: 'A',
      DESLIZAMENTO: 'D',
      INCENDIO: 'I',
      HOSPITAL_PUBLICO: 'H',
      HOSPITAL_PARTICULAR: 'H',
      UPA: 'U',
      AEROPORTO: '✈',
      ESTADIO: 'E',
    };
    const key = normalizeSearch(this.recordTypeLabel(record)).toUpperCase().replaceAll(' ', '_');
    return codes[key] ?? (record.kind === 'poi' ? 'P' : (record.category?.slice(0, 1) ?? '•'));
  }

  protected async importSourceFile(file?: File): Promise<void> {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      this.sourceImportStatus.set(
        'Arquivo maior que 10 MB. Divida a importação antes de continuar.',
      );
      return;
    }
    const form = this.sourceMetadataForm();
    const metadata: SourceMetadata = {
      ...form,
      id: `${normalizeSearch(form.name).replace(/[^a-z0-9]+/g, '-') || 'fonte'}-${Date.now()}`,
    };
    try {
      const { parseOpenDataset } = await import('./data-exchange/source-import');
      const dataset = parseOpenDataset(this.sourceKind(), await file.text(), metadata);
      this.applyImportedDataset(dataset);
      this.sourceImportStatus.set(
        `Arquivo recebido nesta sessão: ${dataset.records.length} evento(s) pontual(is), ${dataset.aggregates.length} estatística(s) agregada(s).`,
      );
    } catch (error) {
      this.sourceImportStatus.set(
        error instanceof Error ? error.message : 'Não foi possível ler o arquivo selecionado.',
      );
    }
  }

  protected setSourceField(field: Exclude<keyof SourceMetadata, 'id'>, value: string): void {
    this.sourceMetadataForm.update((metadata) => ({ ...metadata, [field]: value }));
  }

  protected setSourceKind(kind: string): void {
    if (kind !== 'events-geojson' && kind !== 'aggregate-csv') return;
    this.sourceKind.set(kind);
    this.sourceImportStatus.set('');
  }

  protected handleSourceFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    void this.importSourceFile(input.files?.[0]);
    input.value = '';
  }

  private applyImportedDataset(dataset: ImportedDataset): void {
    const importedAt = new Date().toISOString();
    const points = dataset.records.map((record) => ({
      ...record,
      id: `${dataset.source.id}:${record.id}`,
      kind: 'occurrence' as const,
      name: record.name ?? 'Evento sem título',
      description: record.description ?? '',
      location: record.location ?? 'Local não informado',
      insertedAt: importedAt,
      typeLabel:
        record.typeLabel ?? record.crime ?? record.group ?? 'Evento importado; tipo pendente',
    }));
    this.importedRecords.update((current) => {
      const knownIds = new Set(current.map((record) => record.id));
      return [...current, ...points.filter((record) => !knownIds.has(record.id))];
    });
    this.importedAggregates.update((current) => [...current, ...dataset.aggregates]);
    this.sourceImports.update((current) => [
      ...current,
      {
        metadata: dataset.source,
        importedAt,
        records: dataset.records.length,
        aggregates: dataset.aggregates.length,
      },
    ]);
    if (dataset.aggregates.length) {
      if (!dataset.aggregates.some((item) => item.indicator === this.analyticsIndicator())) {
        this.analyticsIndicator.set(dataset.aggregates[0]!.indicator);
      }
      const importedTerritories = [...new Set(dataset.aggregates.map((item) => item.territory))];
      if (importedTerritories[0]) this.analyticsTerritoryA.set(importedTerritories[0]);
      if (importedTerritories[1]) this.analyticsTerritoryB.set(importedTerritories[1]);
      const importedPeriods = [...new Set(dataset.aggregates.map((item) => item.period))].sort();
      if (importedPeriods[0]) this.comparisonPeriodA.set(importedPeriods[0]);
      if (importedPeriods[1]) this.comparisonPeriodB.set(importedPeriods[1]);
    }
    this.refreshMapData();
  }

  protected setClipSearch(query: string): void {
    this.clipsQuery.set(query);
  }

  protected setClipDraftField(field: keyof ReturnType<typeof this.clipDraft>, value: string): void {
    this.clipDraft.update((draft) => ({ ...draft, [field]: value }));
  }

  protected addClipReference(): void {
    const draft = this.clipDraft();
    let url: URL;
    try {
      url = new URL(draft.referenceUrl);
    } catch {
      this.sourceImportStatus.set('Informe uma URL pública válida para a referência.');
      return;
    }
    if (
      (url.protocol !== 'http:' && url.protocol !== 'https:') ||
      !draft.title.trim() ||
      !draft.publisher.trim()
    ) {
      this.sourceImportStatus.set('Informe título, publicação e URL HTTP/HTTPS.');
      return;
    }
    const clips = [
      {
        id: `clip-${Date.now()}`,
        title: draft.title.trim(),
        publisher: draft.publisher.trim(),
        referenceUrl: url.href,
        collectedAt: new Date().toISOString(),
        status: 'PENDING' as const,
      },
      ...this.clips(),
    ];
    this.clips.set(clips);
    this.persistLocalValue('vu2.demoClips', clips);
    this.clipDraft.set({ title: '', publisher: '', referenceUrl: '' });
    this.sourceImportStatus.set(
      'Referência adicionada à triagem local; nenhum conteúdo foi baixado.',
    );
  }

  protected clearImportedSources(): void {
    this.importedRecords.set([]);
    this.importedAggregates.set([]);
    this.sourceImports.set([]);
    this.sourceImportStatus.set('Dados importados removidos desta sessão.');
    this.refreshMapData();
  }

  protected setClipTarget(clipId: string, eventId: string): void {
    this.clipTarget.update((targets) => ({ ...targets, [clipId]: eventId }));
  }

  protected linkClip(clipId: string): void {
    const eventId = this.clipTarget()[clipId];
    if (!eventId || !this.historyRecords().some((record) => record.id === eventId)) return;
    this.updateClip(clipId, 'LINKED', eventId);
  }

  protected markClipDuplicate(clipId: string): void {
    this.updateClip(clipId, 'DUPLICATE');
  }

  protected dismissClip(clipId: string): void {
    this.updateClip(clipId, 'DISMISSED');
  }

  private updateClip(clipId: string, status: ClipStatus, eventId?: string): void {
    const clips = this.clips().map((clip) =>
      clip.id === clipId ? { ...clip, status, ...(eventId ? { eventId } : {}) } : clip,
    );
    this.clips.set(clips);
    this.persistLocalValue('vu2.demoClips', clips);
  }

  protected startPlayback(): void {
    if (this.playbackRunning()) {
      this.stopPlayback();
      return;
    }
    if (!this.playbackRecords().length) return;
    if (this.playbackIndex() >= this.playbackRecords().length - 1) this.playbackIndex.set(0);
    this.playbackRunning.set(true);
    this.playbackTimer = setInterval(() => {
      const nextIndex = this.playbackIndex() + 1;
      if (nextIndex >= this.playbackRecords().length) {
        this.stopPlayback();
        return;
      }
      this.playbackIndex.set(nextIndex);
      const record = this.currentPlaybackRecord();
      if (record) this.focusPoint(record);
    }, 1400);
  }

  protected stopPlayback(): void {
    if (this.playbackTimer) clearInterval(this.playbackTimer);
    this.playbackTimer = undefined;
    this.playbackRunning.set(false);
  }

  protected setPlaybackIndex(value: string): void {
    this.stopPlayback();
    const index = Math.max(0, Math.min(this.playbackRecords().length - 1, Number(value)));
    this.playbackIndex.set(Number.isFinite(index) ? index : 0);
    const record = this.currentPlaybackRecord();
    if (record) this.focusPoint(record);
  }

  protected saveCurrentSearchFromInsights(): void {
    const name = this.savedSearchName().trim();
    if (!name) {
      this.exportStatus.set('Digite um nome para salvar este filtro.');
      return;
    }
    this.saveCurrentSearch();
    this.exportStatus.set('Filtro salvo neste navegador.');
  }

  protected async exportXlsx(): Promise<void> {
    try {
      const sheets = this.buildReportSheets();
      const { createXlsxWorkbook } = await import('./data-exchange/xlsx-export');
      const workbook = await createXlsxWorkbook(sheets);
      const workbookBuffer = new ArrayBuffer(workbook.byteLength);
      new Uint8Array(workbookBuffer).set(workbook);
      const file = new Blob([workbookBuffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(file);
      const link = document.createElement('a');
      link.href = url;
      link.download = `vetor-urbano-relatorio-${new Date().toISOString().slice(0, 10)}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);
      this.exportStatus.set('Planilha XLSX gerada com filtros, registros, estatísticas e fontes.');
    } catch {
      this.exportStatus.set('Não foi possível gerar a planilha. Tente novamente.');
    }
  }

  private buildReportSheets(): SpreadsheetSheet[] {
    const range = this.resolvedDateRange();
    const filteredPoints = this.visiblePoints();
    const sources = [
      ...this.sourceImports().map((entry) => entry.metadata),
      {
        id: 'demo',
        name: 'Dados sintéticos locais',
        url: 'Não se aplica — fixture do protótipo',
        license: 'Demonstração própria',
        referenceDate: '2026-10',
        limitations: 'Não representa eventos reais; não usar para decisões de segurança.',
      },
    ];
    const sourceNames = new Map(sources.map((source) => [source.id, source.name]));
    const sourceName = (sourceId?: string): string =>
      sourceNames.get(sourceId ?? 'demo') ??
      (sourceId ? `Fonte sem cadastro (${sourceId})` : 'Fonte não informada');
    const formatDate = (value?: string): string =>
      value ? this.formatReportDateTime(value) : 'Não informado';
    const center = this.searchCenter();
    return [
      {
        name: 'Resumo e filtros',
        rows: [
          ['Relatório Vetor Urbano — demonstração local'],
          ['Gerado em (horário de Brasília)', this.formatDateTime(new Date().toISOString())],
          ['Quantidade de registros no recorte', filteredPoints.length],
          [
            'Início do período (horário de Brasília)',
            range ? this.formatDateTime(range.start.toISOString()) : 'Não definido',
          ],
          [
            'Fim do período (exclusivo; horário de Brasília)',
            range ? this.formatDateTime(range.end.toISOString()) : 'Não definido',
          ],
          ['Filtros aplicados', this.reportFilterSummary()],
          ['Horário inicial do dia', this.timeStart() || 'Não definido'],
          ['Horário final do dia', this.timeEnd() || 'Não definido'],
          ['Filtro por raio', this.useRadius() ? 'Ativado' : 'Desativado'],
          ['Raio de busca (m)', this.useRadius() ? this.radiusMeters() : 'Não se aplica'],
          [
            'Longitude do centro da busca (WGS84)',
            this.useRadius() ? Number(center.longitude) : '',
          ],
          ['Latitude do centro da busca (WGS84)', this.useRadius() ? Number(center.latitude) : ''],
          [
            'Observação',
            'Dados fictícios ou arquivos importados localmente; sem validação operacional.',
          ],
        ],
        titleRows: 1,
        headerRows: 0,
        labelColumns: [0],
        columnWidths: [40, 58],
        autoFilter: false,
      },
      {
        name: 'Registros e pontos',
        rows: [
          [
            'ID do registro',
            'Título do registro',
            'Categoria',
            'Grupo',
            'Tipo de informação',
            'Gravidade informada',
            'Situação operacional',
            'Data e hora do fato (horário de Brasília)',
            'Data de inclusão (horário de Brasília)',
            'Local de referência',
            'Longitude (WGS84)',
            'Latitude (WGS84)',
            'Fonte de dados',
          ],
          ...filteredPoints.map((point) => [
            point.id,
            point.name,
            point.category ? reportValueLabel(point.category) : 'Ponto de interesse',
            point.group ? reportValueLabel(point.group) : 'Não informado',
            reportValueLabel(this.recordTypeLabel(point)),
            point.severity ? reportValueLabel(point.severity) : 'Não informada',
            point.kind === 'poi' ? 'Não se aplica' : this.situationLabel(point.situation),
            point.kind === 'poi' ? 'Não se aplica' : this.formatFactTime(point),
            formatDate(point.insertedAt),
            point.location,
            point.coordinates?.[0] ?? 'Não disponível',
            point.coordinates?.[1] ?? 'Não disponível',
            sourceName(point.sourceId),
          ]),
        ],
        columnWidths: [18, 30, 16, 28, 30, 24, 30, 32, 32, 32, 20, 20, 30],
      },
      {
        name: 'Estatísticas agregadas',
        rows: [
          [
            'Território de referência',
            'Período de referência (MM/AAAA)',
            'Indicador',
            'Valor',
            'Unidade',
            'Fonte de dados',
          ],
          ...this.aggregateData().map((item) => [
            item.territory,
            this.formatReportPeriod(item.period),
            reportValueLabel(item.indicator),
            item.value,
            reportValueLabel(item.unit),
            sourceName(item.sourceId),
          ]),
        ],
        columnWidths: [32, 28, 28, 16, 18, 30],
      },
      {
        name: 'Fontes e limites',
        rows: [
          [
            'Nome da fonte',
            'Referência ou endereço',
            'Licença ou autorização',
            'Data de referência',
            'Limitações declaradas',
          ],
          ...sources.map((source) => [
            source.name,
            source.url,
            source.license,
            this.formatReportPeriod(source.referenceDate),
            source.limitations,
          ]),
        ],
        columnWidths: [30, 48, 34, 18, 56],
      },
    ];
  }

  private reportFilterSummary(): string {
    return (
      this.activeFilters()
        .map((filter) => {
          const separator = filter.indexOf(':');
          if (separator < 0) return reportValueLabel(filter);
          const kind = filter.slice(0, separator);
          const value = filter.slice(separator + 1);
          if (kind === 'category') return `Categoria: ${reportValueLabel(value)}`;
          if (kind === 'type')
            return `Tipo: ${OCCURRENCE_CATALOGUE.find((type) => type.id === value)?.label ?? value}`;
          if (kind === 'group') return `Grupo: ${reportValueLabel(value)}`;
          if (kind === 'crime') return `Tipo de crime: ${reportValueLabel(value)}`;
          if (kind === 'poi') {
            return value === 'EXCLUSIVO'
              ? 'Pontos de interesse exclusivos'
              : `Tipo de ponto de interesse: ${reportValueLabel(value)}`;
          }
          if (kind === 'territory') {
            return `Área de Risco: ${TERRITORY_GROUP_BY_ID.get(value as TerritoryCode)?.label ?? value}`;
          }
          if (kind === 'status') return `Situação operacional: ${this.statusLabel(value)}`;
          return `${reportValueLabel(kind)}: ${reportValueLabel(value)}`;
        })
        .join(' · ') || 'Nenhum filtro aplicado'
    );
  }

  private formatReportDateTime(value: string): string {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : this.formatDateTime(date.toISOString());
  }

  private formatReportPeriod(value: string): string {
    const month = /^(\d{4})-(\d{2})$/.exec(value);
    if (month) return `${month[2]}/${month[1]}`;
    const date = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (date) return `${date[3]}/${date[2]}/${date[1]}`;
    return value || 'Não informado';
  }

  private loadMapLibraries(): Promise<typeof import('maplibre-gl')> {
    if (this.maplibre) return Promise.resolve(this.maplibre);
    if (!this.mapLibrariesPromise) {
      this.mapLibrariesPromise = Promise.all([
        import('maplibre-gl'),
        import('./maps/radius-geometry'),
        import('./maps/maplibre-style-loader').then(({ loadMapLibreStyles }) =>
          loadMapLibreStyles(),
        ),
      ])
        .then(([maplibre, radiusGeometry]) => {
          this.maplibre = maplibre;
          this.radiusCircleFactory = radiusGeometry.createRadiusCircle;
          maplibre.setWorkerUrl(
            new URL('assets/maplibre/maplibre-gl-worker.mjs', document.baseURI).href,
          );
          return maplibre;
        })
        .catch((error: unknown) => {
          this.mapLibrariesPromise = undefined;
          throw error;
        });
    }
    return this.mapLibrariesPromise;
  }

  private loadUrbanStyle(): Promise<maplibregl.StyleSpecification> {
    return import('./maps/urban-map-style').then(({ loadUrbanMapStyle }) => loadUrbanMapStyle());
  }

  private loadLeafletLibraries(): Promise<typeof import('leaflet')> {
    if (this.leaflet) return Promise.resolve(this.leaflet);
    if (!this.leafletLibrariesPromise) {
      this.leafletLibrariesPromise = Promise.all([
        import('leaflet/dist/leaflet-src.esm.js'),
        import('./maps/leaflet-style-loader').then(({ loadLeafletStyles }) => loadLeafletStyles()),
      ])
        .then(([leaflet]) => {
          this.leaflet = leaflet;
          return leaflet;
        })
        .catch((error: unknown) => {
          this.leafletLibrariesPromise = undefined;
          throw error;
        });
    }
    return this.leafletLibrariesPromise;
  }

  private loadRasterTileProvider(): Promise<RasterTileProvider> {
    if (this.rasterTileProvider) return Promise.resolve(this.rasterTileProvider);
    if (!this.rasterTileProviderPromise) {
      this.rasterTileProviderPromise = fetch(new URL(RASTER_MAP_PROVIDER_URL, document.baseURI))
        .then(async (response) => {
          if (!response.ok) {
            throw new Error(
              `Não foi possível carregar a configuração do mapa 2D (${response.status}).`,
            );
          }
          const provider = (await response.json()) as Partial<RasterTileProvider>;
          if (
            typeof provider.tileUrl !== 'string' ||
            !provider.tileUrl.startsWith('https://') ||
            !provider.tileUrl.includes('{z}') ||
            !provider.tileUrl.includes('{x}') ||
            !provider.tileUrl.includes('{y}') ||
            !Number.isInteger(provider.maxZoom) ||
            provider.maxZoom! < 1 ||
            provider.maxZoom! > 22 ||
            typeof provider.attribution !== 'string' ||
            !provider.attribution.trim()
          ) {
            throw new Error('A configuração do mapa 2D é inválida.');
          }
          const validProvider: RasterTileProvider = {
            tileUrl: provider.tileUrl,
            maxZoom: provider.maxZoom!,
            attribution: provider.attribution,
          };
          this.rasterTileProvider = validProvider;
          return validProvider;
        })
        .catch((error: unknown) => {
          this.rasterTileProviderPromise = undefined;
          throw error;
        });
    }
    return this.rasterTileProviderPromise;
  }

  private initializeMap(): Promise<void> {
    if (this.mapInitPromise) return this.mapInitPromise;
    const initialization = this.createMainMap().finally(() => {
      if (this.mapInitPromise === initialization) this.mapInitPromise = undefined;
    });
    this.mapInitPromise = initialization;
    return initialization;
  }

  private async createMainMap(): Promise<void> {
    this.mapReady.set(false);
    this.mapError.set(false);
    this.mapErrorDetails.set('');
    if (typeof window === 'undefined') {
      this.mapErrorDetails.set('O mapa requer um navegador com suporte a DOM.');
      this.mapError.set(true);
      return;
    }
    if (this.useRasterMaps || !this.supportsWebGL2()) {
      this.mapErrorDetails.set('Carregando mapa 2D de compatibilidade.');
      await this.initializeLeafletMap();
      return;
    }
    try {
      const maplibre = await this.loadMapLibraries();
      const style = await this.loadUrbanStyle();
      this.urbanMapStyle = style;
      if (this.activeView() !== 'map' || !document.getElementById('map-canvas')) return;
      this.map = new maplibre.Map({
        container: 'map-canvas',
        style,
        center: CENTRAL_DO_BRASIL_CENTER,
        zoom: 12.2,
        minZoom: 9,
        maxZoom: 17,
        attributionControl: {
          compact: false,
        },
      });
      this.map.addControl(new maplibre.NavigationControl({ showCompass: false }), 'top-right');
      const map = this.map;
      this.stopMapMonitoring = this.monitorMap(
        map,
        () => {
          if (this.map !== map) return;
          this.mapError.set(false);
          this.mapErrorDetails.set('');
          this.mapReady.set(true);
          const pendingCamera = this.pendingQueryCamera;
          this.pendingQueryCamera = undefined;
          pendingCamera?.();
        },
        (error) => {
          if (this.map !== map) return;
          const center = map.getCenter();
          const zoom = map.getZoom();
          this.mapErrorDetails.set(this.describeMapError(error));
          this.useRasterMaps = true;
          this.map = undefined;
          map.remove();
          this.mapReady.set(false);
          void this.initializeLeafletMap([center.lng, center.lat], zoom);
        },
      );
      this.map.on('click', (event) => {
        this.handleMapClick(event.lngLat.lng, event.lngLat.lat, event.originalEvent.button);
      });
      this.observeMapSize();
      this.map.on('load', () => {
        if (this.map !== map) return;
        this.applyMapTheme(map, this.mapDark());
        this.map?.addSource('search-radius-source', {
          type: 'geojson',
          data: this.radiusGeoJson(),
        });
        this.map?.addSource('demo-points', {
          type: 'geojson',
          data: this.toGeoJson('occurrence'),
          cluster: true,
          clusterMaxZoom: 11,
          clusterRadius: 50,
        });
        this.map?.addSource('demo-pois', {
          type: 'geojson',
          data: this.toGeoJson('poi'),
          cluster: false,
        });
        this.map?.addSource('heat-occurrences', {
          type: 'geojson',
          data: this.toGeoJson('occurrence'),
        });
        this.map?.addSource('heat-pois', { type: 'geojson', data: this.toGeoJson('poi') });
        this.map?.addLayer({
          id: 'search-radius-fill',
          type: 'fill',
          source: 'search-radius-source',
          paint: {
            'fill-color': SEARCH_RADIUS_COLOR,
            'fill-opacity': 0.18,
          },
        });
        this.map?.addLayer({
          id: 'search-radius-outline',
          type: 'line',
          source: 'search-radius-source',
          paint: {
            'line-color': SEARCH_RADIUS_COLOR,
            'line-opacity': 0.82,
            'line-width': 2,
          },
        });
        this.map?.addLayer({
          id: 'demo-occurrence-clusters',
          type: 'circle',
          source: 'demo-points',
          filter: ['has', 'point_count'],
          paint: {
            'circle-color': '#24765b',
            'circle-radius': ['step', ['get', 'point_count'], 16, 5, 20, 10, 24],
            'circle-stroke-width': 2,
            'circle-stroke-color': '#ffffff',
          },
        });
        this.map?.addLayer({
          id: 'demo-occurrence-cluster-count',
          type: 'symbol',
          source: 'demo-points',
          filter: ['has', 'point_count'],
          layout: {
            'text-field': '{point_count_abbreviated}',
            'text-font': ['Noto Sans Regular'],
            'text-size': 12,
          },
          paint: {
            'text-color': '#ffffff',
          },
        });
        this.map?.addLayer({
          id: 'demo-points-glow',
          type: 'circle',
          source: 'demo-points',
          filter: ['==', ['get', 'selected'], true],
          paint: {
            'circle-radius': 13,
            'circle-color': '#10b981',
            'circle-opacity': 0.18,
            'circle-blur': 0.25,
          },
        });
        this.map?.addLayer({
          id: 'demo-points-dot',
          type: 'circle',
          source: 'demo-pois',
          filter: ['==', ['get', 'kind'], 'poi'],
          paint: {
            'circle-radius': [
              'case',
              ['==', ['get', 'selected'], true],
              9,
              ['match', ['get', 'severity'], 'CRITICA', 8, 'ALTA', 7, 'MODERADA', 6, 5],
            ],
            'circle-color': [
              'match',
              ['get', 'category'],
              'TRANSITO',
              '#38bdf8',
              'SEGURANCA',
              '#fb7185',
              'CONTINGENCIA',
              '#fbbf24',
              '#a3e635',
            ],
            'circle-stroke-color': '#f4f4f5',
            'circle-stroke-width': 1.5,
          },
        });
        this.map?.addLayer({
          id: 'demo-occurrence-pins',
          type: 'symbol',
          source: 'demo-points',
          filter: ['all', ['==', ['get', 'kind'], 'occurrence'], ['!', ['has', 'point_count']]],
          layout: {
            'icon-image': ['get', 'category'],
            'icon-size': ['case', ['==', ['get', 'selected'], true], 1.15, 1],
            'icon-anchor': 'bottom',
            'icon-offset': [0, 2],
            'icon-allow-overlap': true,
            'icon-ignore-placement': true,
          },
        });
        this.map?.addLayer({
          id: 'demo-points-code',
          type: 'symbol',
          source: 'demo-pois',
          filter: ['==', ['get', 'kind'], 'poi'],
          layout: {
            'text-field': ['get', 'markerCode'],
            'text-font': ['Noto Sans Regular'],
            'text-size': 9,
            'text-allow-overlap': true,
            'text-ignore-placement': true,
          },
          paint: {
            'text-color': '#071711',
            'text-halo-color': '#f4f4f5',
            'text-halo-width': 0.5,
          },
        });
        this.map?.on('click', 'demo-occurrence-clusters', async (event) => {
          if (!this.map) return;
          const features = this.map.queryRenderedFeatures(event.point, {
            layers: ['demo-occurrence-clusters'],
          });
          const clusterId = features[0]?.properties?.['cluster_id'];
          if (clusterId === undefined) return;
          const source = this.map.getSource('demo-points') as maplibregl.GeoJSONSource;
          try {
            const zoom = await source.getClusterExpansionZoom(clusterId);
            const coords = (features[0].geometry as GeoJSON.Point).coordinates as [number, number];
            this.map.easeTo({
              center: coords,
              zoom: Math.max(zoom, (this.map?.getZoom() ?? 10) + 2),
            });
          } catch {
            this.map.zoomIn();
          }
        });
        this.map?.on('mouseenter', 'demo-occurrence-clusters', () => {
          if (this.map) this.map.getCanvas().style.cursor = 'pointer';
        });
        this.map?.on('mouseleave', 'demo-occurrence-clusters', () => {
          if (this.map) this.map.getCanvas().style.cursor = '';
        });
        this.map?.on('click', 'demo-points-dot', (event) => {
          if (this.useRadius() || this.mapPickPurpose()) return;
          const properties = event.features?.[0]?.properties as Record<string, string> | undefined;
          if (!properties || !this.map) return;
          const content = document.createElement('div');
          content.className = 'map-popup';
          const title = document.createElement('strong');
          title.textContent = properties['name'] ?? 'Registro demonstrativo';
          const description = document.createElement('p');
          description.textContent = properties['description'] ?? '';
          const location = document.createElement('span');
          location.textContent = properties['location'] ?? '';
          const type = document.createElement('span');
          type.textContent = `${properties['typeLabel'] ?? properties['kind'] ?? 'Tipo não informado'} · ${properties['severity'] ?? 'severidade não informada'}`;
          const status = document.createElement('span');
          status.textContent = properties['situationLabel'] ?? 'Desconhecida';
          const source = document.createElement('small');
          source.textContent = `Fonte: ${properties['sourceId'] ?? 'demonstração local'}`;
          const inserted = document.createElement('small');
          inserted.textContent = `Inserido às ${this.formatTime(properties['insertedAt'] ?? new Date().toISOString())}`;
          content.append(title, description, location, type, status, source, inserted);
          new maplibre.Popup({ closeButton: true, offset: 12 })
            .setLngLat(event.lngLat)
            .setDOMContent(content)
            .addTo(this.map);
        });
        this.map?.on('click', 'demo-occurrence-pins', (event) => {
          if (this.useRadius() || this.mapPickPurpose() || !this.map) return;
          const coords = (event.features?.[0]?.geometry as GeoJSON.Point).coordinates as [
            number,
            number,
          ];
          const coincidentPoints = this.visiblePoints()
            .filter(isMappedRecord)
            .filter(
              (point) =>
                point.kind === 'occurrence' &&
                Math.abs(point.coordinates[0] - coords[0]) < 0.0001 &&
                Math.abs(point.coordinates[1] - coords[1]) < 0.0001,
            );
          if (coincidentPoints.length > 1) {
            new maplibre.Popup({ closeButton: true, offset: [0, -40] })
              .setLngLat(coords)
              .setDOMContent(this.createCoincidentPointsPopup(coincidentPoints))
              .addTo(this.map);
            return;
          }
          const id = event.features?.[0]?.properties?.['recordId'];
          const point = this.visiblePoints().find((point) => point.id === id);
          if (!point || !isMappedRecord(point)) return;
          new maplibre.Popup({ closeButton: true, offset: [0, -40] })
            .setLngLat(point.coordinates)
            .setDOMContent(this.createRasterPointPopup(point))
            .addTo(this.map);
        });
        this.map?.on('mouseenter', 'demo-occurrence-pins', () => {
          if (this.map) this.map.getCanvas().style.cursor = 'pointer';
        });
        this.map?.on('mouseleave', 'demo-occurrence-pins', () => {
          if (this.map) this.map.getCanvas().style.cursor = '';
        });
        this.map?.on('mouseenter', 'demo-points-dot', () => {
          if (this.map) this.map.getCanvas().style.cursor = 'pointer';
        });
        this.map?.on('mouseleave', 'demo-points-dot', () => {
          if (this.map) this.map.getCanvas().style.cursor = '';
        });
        this.installTerritoryLayer();
        this.updateMapLayers();
      });
    } catch (error: unknown) {
      this.mapErrorDetails.set(this.describeMapError(error));
      this.map?.remove();
      this.map = undefined;
      this.stopMapMonitoring?.();
      this.useRasterMaps = true;
      await this.initializeLeafletMap();
    }
  }

  private async initializeLeafletMap(
    center: Coordinates = CENTRAL_DO_BRASIL_CENTER,
    zoom = 12.2,
  ): Promise<void> {
    try {
      const [leaflet, tileProvider] = await Promise.all([
        this.loadLeafletLibraries(),
        this.loadRasterTileProvider(),
      ]);
      const container = document.getElementById('map-canvas');
      if (!container || this.activeView() !== 'map' || this.fallbackMap) return;

      const [longitude, latitude] = center;
      const map = leaflet
        .map(container, {
          center: [latitude, longitude],
          // MapLibre's world is 512 px at zoom 0; Leaflet's is 256 px.
          zoom: zoom + 1,
          zoomSnap: 0.1,
          minZoom: 10,
          maxZoom: 18,
          preferCanvas: this.supportsCanvas2D(),
          zoomControl: false,
        })
        .setView([latitude, longitude], zoom + 1);
      this.fallbackMap = map;
      leaflet.control.zoom({ position: 'topright' }).addTo(map);
      this.fallbackPointsLayer = leaflet.layerGroup().addTo(map);
      this.fallbackEventHeatLayer = leaflet.layerGroup();
      this.fallbackPoiHeatLayer = leaflet.layerGroup();
      this.fallbackRadiusLayer = leaflet.layerGroup().addTo(map);
      this.fallbackTerritoryLayer = leaflet.layerGroup().addTo(map);

      let loadedTiles = 0;
      leaflet
        .tileLayer(tileProvider.tileUrl, {
          maxZoom: tileProvider.maxZoom,
          attribution: tileProvider.attribution,
        })
        .on('tileload', () => {
          if (this.fallbackMap !== map) return;
          loadedTiles += 1;
          this.mapReady.set(true);
          const pendingCamera = this.pendingQueryCamera;
          this.pendingQueryCamera = undefined;
          pendingCamera?.();
          this.mapError.set(false);
          this.mapErrorDetails.set('');
        })
        .on('load', () => {
          if (this.fallbackMap !== map || loadedTiles > 0) return;
          this.mapReady.set(false);
          this.mapErrorDetails.set('O provedor 2D não retornou nenhum tile visível.');
          this.mapError.set(true);
        })
        .on('tileerror', (event) => {
          if (this.fallbackMap !== map || this.mapReady()) return;
          this.mapErrorDetails.set(this.describeMapError(event.error));
          this.mapError.set(true);
        })
        .addTo(map);

      map.on('click', (event) => {
        this.handleMapClick(event.latlng.lng, event.latlng.lat, event.originalEvent.button);
      });
      map.on('zoomend', () => {
        if (this.fallbackMap !== map) return;
        this.updateFallbackMapLayers();
      });
      this.observeMapSize();
      map.whenReady(() => {
        if (this.fallbackMap !== map) return;
        requestAnimationFrame(() => map.invalidateSize());
        this.updateFallbackMapLayers();
        this.installTerritoryLayer();
      });
    } catch (error: unknown) {
      this.mapReady.set(false);
      this.mapErrorDetails.set(this.describeMapError(error));
      this.mapError.set(true);
    }
  }

  private initializeReportMap(): Promise<void> {
    const container = document.getElementById('report-map-canvas');
    if (!container || this.activeView() !== 'report' || !this.selectedCategory()) {
      return Promise.resolve();
    }
    if (this.reportMap?.getContainer() === container) {
      this.reportMap.resize();
      this.updateReportMapMarker();
      return Promise.resolve();
    }
    if (this.reportFallbackMap?.getContainer() === container) {
      this.reportFallbackMap.invalidateSize();
      this.updateReportMapMarker();
      return Promise.resolve();
    }
    if (this.reportMapInitPromise) return this.reportMapInitPromise;

    this.reportMapStatus.set('loading');
    this.reportMapErrorDetails.set('');
    const initialization = this.createReportMap(container).finally(() => {
      if (this.reportMapInitPromise === initialization) this.reportMapInitPromise = undefined;
    });
    this.reportMapInitPromise = initialization;
    return initialization;
  }

  private async createReportMap(container: HTMLElement): Promise<void> {
    if (this.useRasterMaps || !this.supportsWebGL2()) {
      await this.createReportLeafletMap(container);
      return;
    }
    try {
      const maplibre = await this.loadMapLibraries();
      const style = await this.loadUrbanStyle();
      this.urbanMapStyle = style;
      if (
        !container.isConnected ||
        document.getElementById('report-map-canvas') !== container ||
        this.activeView() !== 'report'
      ) {
        return;
      }

      const reportMap = new maplibre.Map({
        container,
        style,
        center: CENTRAL_DO_BRASIL_CENTER,
        zoom: 13,
        minZoom: 9,
        maxZoom: 18,
        attributionControl: {
          compact: true,
        },
      });
      this.reportMap = reportMap;
      reportMap.addControl(new maplibre.NavigationControl({ showCompass: false }), 'top-right');

      reportMap.on('load', () => {
        if (this.reportMap !== reportMap) return;
        this.applyMapTheme(reportMap, this.reportMapDark());
        this.updateReportMapMarker();
      });
      this.stopReportMapMonitoring = this.monitorMap(
        reportMap,
        () => {
          if (this.reportMap !== reportMap) return;
          this.reportMapErrorDetails.set('');
          this.reportMapStatus.set('ready');
        },
        (error) => {
          if (this.reportMap !== reportMap) return;
          const center = reportMap.getCenter();
          const zoom = reportMap.getZoom();
          this.reportMapErrorDetails.set(this.describeMapError(error));
          this.useRasterMaps = true;
          this.reportMapMarker?.remove();
          this.reportMapMarker = undefined;
          this.reportMap = undefined;
          reportMap.remove();
          this.reportMapStatus.set('loading');
          void this.createReportLeafletMap(container, [center.lng, center.lat], zoom);
        },
      );
      reportMap.on('click', (event) => {
        this.setCoordinate('longitude', event.lngLat.lng.toFixed(6));
        this.setCoordinate('latitude', event.lngLat.lat.toFixed(6));
        this.reportStatus.set(
          'Coordenadas preenchidas pelo mapa. Confirme o ponto antes de prosseguir.',
        );
      });
    } catch (error: unknown) {
      this.reportMapErrorDetails.set(this.describeMapError(error));
      this.reportMap?.remove();
      this.reportMap = undefined;
      this.stopReportMapMonitoring?.();
      this.useRasterMaps = true;
      await this.createReportLeafletMap(container);
    }
  }

  private async createReportLeafletMap(
    container: HTMLElement,
    center: Coordinates = CENTRAL_DO_BRASIL_CENTER,
    zoom = 13,
  ): Promise<void> {
    try {
      const [leaflet, tileProvider] = await Promise.all([
        this.loadLeafletLibraries(),
        this.loadRasterTileProvider(),
      ]);
      if (
        !container.isConnected ||
        document.getElementById('report-map-canvas') !== container ||
        this.activeView() !== 'report'
      ) {
        return;
      }

      const [longitude, latitude] = center;
      const map = leaflet
        .map(container, {
          center: [latitude, longitude],
          zoom: zoom + 1,
          zoomSnap: 0.1,
          minZoom: 10,
          maxZoom: 19,
          preferCanvas: this.supportsCanvas2D(),
          zoomControl: false,
        })
        .setView([latitude, longitude], zoom + 1);
      this.reportFallbackMap = map;
      leaflet.control.zoom({ position: 'topright' }).addTo(map);
      let loadedTiles = 0;
      leaflet
        .tileLayer(tileProvider.tileUrl, {
          maxZoom: tileProvider.maxZoom,
          attribution: tileProvider.attribution,
        })
        .on('tileload', () => {
          if (this.reportFallbackMap !== map) return;
          loadedTiles += 1;
          this.reportMapErrorDetails.set('');
          this.reportMapStatus.set('ready');
        })
        .on('load', () => {
          if (this.reportFallbackMap !== map || loadedTiles > 0) return;
          this.reportMapErrorDetails.set('O provedor 2D não retornou nenhum tile visível.');
          this.reportMapStatus.set('error');
        })
        .on('tileerror', (event) => {
          if (this.reportFallbackMap !== map || this.reportMapStatus() === 'ready') return;
          this.reportMapErrorDetails.set(this.describeMapError(event.error));
          this.reportMapStatus.set('error');
        })
        .addTo(map);
      map.on('click', (event) => {
        this.setCoordinate('longitude', event.latlng.lng.toFixed(6));
        this.setCoordinate('latitude', event.latlng.lat.toFixed(6));
        this.reportStatus.set(
          'Coordenadas preenchidas pelo mapa. Confirme o ponto antes de prosseguir.',
        );
      });
      map.whenReady(() => {
        if (this.reportFallbackMap !== map) return;
        requestAnimationFrame(() => map.invalidateSize());
        this.updateReportMapMarker();
      });
    } catch (error: unknown) {
      this.reportMapStatus.set('error');
      this.reportMapErrorDetails.set(this.describeMapError(error));
    }
  }

  private updateReportMapMarker(): void {
    if ((!this.reportMap || !this.maplibre) && (!this.reportFallbackMap || !this.leaflet)) return;
    const { longitude, latitude } = this.coordinates();
    const lng = Number(longitude);
    const lat = Number(latitude);
    if (
      !longitude.trim() ||
      !latitude.trim() ||
      !Number.isFinite(lng) ||
      !Number.isFinite(lat) ||
      Math.abs(lng) > 180 ||
      Math.abs(lat) > 90
    ) {
      this.reportMapMarker?.remove();
      this.reportMapMarker = undefined;
      this.reportFallbackMarker?.remove();
      this.reportFallbackMarker = undefined;
      return;
    }
    if (this.reportMap && this.maplibre) {
      if (!this.reportMapMarker) {
        this.reportMapMarker = new this.maplibre.Marker({ color: '#10B981' });
      }
      this.reportMapMarker.setLngLat([lng, lat]).addTo(this.reportMap);
    } else if (this.reportFallbackMap && this.leaflet) {
      if (!this.reportFallbackMarker) {
        this.reportFallbackMarker = this.leaflet
          .circleMarker([lat, lng], {
            radius: 8,
            color: '#f4f4f5',
            weight: 2,
            fillColor: '#10B981',
            fillOpacity: 1,
          })
          .addTo(this.reportFallbackMap);
      } else {
        this.reportFallbackMarker.setLatLng([lat, lng]);
      }
    }
  }

  private disposeReportMap(): void {
    this.stopReportMapMonitoring?.();
    this.reportMapMarker?.remove();
    this.reportMapMarker = undefined;
    this.reportFallbackMarker?.remove();
    this.reportFallbackMarker = undefined;
    this.reportMap?.remove();
    this.reportMap = undefined;
    this.reportFallbackMap?.remove();
    this.reportFallbackMap = undefined;
    this.reportMapStatus.set('idle');
  }

  private applyMapTheme(map: maplibregl.Map | undefined, dark: boolean): void {
    if (!map || !this.urbanMapStyle || !map.isStyleLoaded()) return;
    applyUrbanMapTheme(map, this.urbanMapStyle, dark);
  }

  protected retryReportMap(): void {
    this.disposeReportMap();
    this.reportMapErrorDetails.set('');
    void this.initializeReportMap();
  }

  private describeMapError(error: unknown): string {
    if (error && typeof error === 'object' && 'message' in error) {
      const message = error.message;
      if (typeof message === 'string' && message.trim()) return message.slice(0, 240);
    }
    if (typeof error === 'string' && error.trim()) return error.slice(0, 240);
    return 'Falha desconhecida ao inicializar o mapa.';
  }

  private monitorMap(
    map: maplibregl.Map,
    onReady: () => void,
    onFailure: (error: unknown) => void,
  ): () => void {
    let active = true;
    let ready = false;
    const watchdog = setTimeout(
      () => fail(new Error('O mapa vetorial não respondeu em 8 segundos.')),
      8000,
    );
    const fail = (error: unknown) => {
      if (!active) return;
      active = false;
      clearTimeout(watchdog);
      onFailure(error);
    };
    map.on('idle', () => {
      if (!active) return;
      ready = true;
      clearTimeout(watchdog);
      onReady();
    });
    map.on('error', (event) => {
      if (!ready) fail(event.error);
    });
    map.on('webglcontextlost', () => fail(new Error('O contexto gráfico do mapa foi perdido.')));
    return () => {
      active = false;
      clearTimeout(watchdog);
    };
  }

  private supportsWebGL2(): boolean {
    if (typeof document === 'undefined' || typeof window.WebGL2RenderingContext === 'undefined') {
      return false;
    }
    try {
      const context = document.createElement('canvas').getContext('webgl2');
      if (!context) return false;
      // Software graphics passed the availability probe but stalled while panning.
      // Privacy settings may hide the renderer; an unknown GPU keeps the vector path.
      const details = context.getExtension?.('WEBGL_debug_renderer_info');
      const renderer = details ? String(context.getParameter(details.UNMASKED_RENDERER_WEBGL)) : '';
      return !/swiftshader|llvmpipe|softpipe|software rasterizer|basic render driver/i.test(
        renderer,
      );
    } catch {
      return false;
    }
  }

  private supportsCanvas2D(): boolean {
    if (typeof document === 'undefined') return false;
    try {
      return document.createElement('canvas').getContext('2d') !== null;
    } catch {
      return false;
    }
  }

  private selectTerritoryHighlight(id: number | null): void {
    const previousId = this.selectedTerritoryId();
    if (this.map?.getSource('territory-source')) {
      if (previousId !== null) {
        this.map.removeFeatureState({ source: 'territory-source', id: previousId }, 'selected');
      }
      if (id !== null) {
        this.map.setFeatureState({ source: 'territory-source', id }, { selected: true });
      }
    }
    this.selectedTerritoryId.set(id);
    if (this.fallbackMap) this.updateFallbackTerritories();
  }

  private async loadTerritories(): Promise<void> {
    if (this.territoryStatus() === 'loaded') return;
    if (this.territoryLoadPromise) return this.territoryLoadPromise;

    this.territoryStatus.set('loading');
    this.territoryLoadPromise = (async () => {
      try {
        const response = await fetch(new URL(TERRITORY_DATA_URL, document.baseURI));
        if (!response.ok) throw new Error(`Territorial data request failed: ${response.status}`);
        const collection = (await response.json()) as FeatureCollection<
          Polygon | MultiPolygon,
          TerritoryProperties
        >;
        if (collection.type !== 'FeatureCollection' || !Array.isArray(collection.features)) {
          throw new Error('Invalid territorial FeatureCollection');
        }
        const features = collection.features
          .map((feature, index) => ({ ...feature, id: index + 1 }) as TerritoryFeature)
          .filter(
            (feature) =>
              (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon') &&
              typeof feature.properties?.n === 'string' &&
              TERRITORY_GROUP_BY_ID.has(feature.properties.f),
          );
        if (!features.length && collection.features.length)
          throw new Error('No usable territorial features');
        this.territories.set(features);
        this.territoryStatus.set('loaded');
        this.installTerritoryLayer();
        this.applyTerritoryFilter();
      } catch {
        this.territoryStatus.set('error');
      } finally {
        this.territoryLoadPromise = undefined;
      }
    })();
    return this.territoryLoadPromise;
  }

  private installTerritoryLayer(): void {
    if (this.fallbackMap) {
      this.updateFallbackTerritories();
      return;
    }
    if (
      !this.map ||
      !this.mapReady() ||
      !this.allRiskAreaFeatures().length ||
      this.map.getSource('territory-source')
    ) {
      return;
    }

    this.map.addSource('territory-source', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: this.allRiskAreaFeatures() },
    });
    const firstSymbolLayer = this.map
      .getStyle()
      .layers?.find((layer) => layer.type === 'symbol')?.id;
    this.map.addLayer(
      {
        id: 'territory-polygons-fill',
        type: 'fill',
        source: 'territory-source',
        paint: {
          'fill-color': [
            'match',
            ['get', 'f'],
            'CV',
            '#E0342C',
            'TCP',
            '#2FA46B',
            'ADA',
            '#EDB72B',
            'MIL',
            '#4E9DE0',
            'LJ',
            '#2B5BC7',
            'MNI',
            '#9B6BD6',
            'NEU',
            '#8C97A3',
            'DEMO_DISPUTED',
            '#D98232',
            'DEMO_UNKNOWN',
            '#8993A1',
            '#8C97A3',
          ],
          'fill-opacity': ['case', ['boolean', ['feature-state', 'selected'], false], 0.44, 0.22],
        },
      },
      firstSymbolLayer,
    );
    this.map.addLayer(
      {
        id: 'territory-polygons-outline',
        type: 'line',
        source: 'territory-source',
        paint: {
          'line-color': [
            'match',
            ['get', 'f'],
            'CV',
            '#E0342C',
            'TCP',
            '#2FA46B',
            'ADA',
            '#EDB72B',
            'MIL',
            '#4E9DE0',
            'LJ',
            '#2B5BC7',
            'MNI',
            '#9B6BD6',
            'NEU',
            '#8C97A3',
            'DEMO_DISPUTED',
            '#D98232',
            'DEMO_UNKNOWN',
            '#8993A1',
            '#8C97A3',
          ],
          'line-width': ['case', ['boolean', ['feature-state', 'selected'], false], 2.3, 1.1],
          'line-opacity': 0.84,
        },
      },
      firstSymbolLayer,
    );
    this.map.on('click', 'territory-polygons-fill', (event) => {
      if (this.useRadius() || this.mapPickPurpose() || !this.map || !this.maplibre) return;
      const area = this.allRiskAreaFeatures().find((area) => area.id === event.features?.[0]?.id);
      if (!area) return;
      this.riskAreaHoverPopup?.remove();
      this.openRiskArea(area);
      new this.maplibre.Popup({ closeButton: true, offset: 12 })
        .setLngLat(event.lngLat)
        .setDOMContent(this.createTerritoryPopup(area))
        .addTo(this.map);
    });
    this.map.on('mouseenter', 'territory-polygons-fill', (event) => {
      if (!this.map || !this.maplibre) return;
      this.map.getCanvas().style.cursor = 'pointer';
      this.riskAreaHoverPopup?.remove();
      this.riskAreaHoverPopup = new this.maplibre.Popup({ closeButton: false, closeOnClick: false })
        .setLngLat(event.lngLat)
        .setText(String(event.features?.[0]?.properties?.['n'] ?? 'Área de Risco'))
        .addTo(this.map);
    });
    this.map.on('mouseleave', 'territory-polygons-fill', () => {
      if (this.map) this.map.getCanvas().style.cursor = '';
      this.riskAreaHoverPopup?.remove();
    });
    const selectedAreaId = this.selectedTerritoryId();
    if (selectedAreaId !== null) {
      this.map.setFeatureState(
        { source: 'territory-source', id: selectedAreaId },
        { selected: true },
      );
    }
    this.applyTerritoryFilter();
  }

  private applyTerritoryFilter(): void {
    if (this.fallbackMap) {
      this.updateFallbackTerritories();
      return;
    }
    if (!this.map?.getLayer('territory-polygons-fill')) return;
    const selectedGroups = this.activeFilters()
      .filter((filter) => filter.startsWith('territory:'))
      .map((filter) => filter.slice('territory:'.length));
    if (this.showSyntheticRiskAreas()) selectedGroups.push('DEMO_DISPUTED', 'DEMO_UNKNOWN');
    this.map.setFilter('territory-polygons-fill', [
      'in',
      ['get', 'f'],
      ['literal', selectedGroups],
    ]);
    this.map.setFilter('territory-polygons-outline', [
      'in',
      ['get', 'f'],
      ['literal', selectedGroups],
    ]);
  }

  private updateFallbackTerritories(): void {
    if (!this.leaflet || !this.fallbackMap || !this.fallbackTerritoryLayer) return;
    this.fallbackTerritoryLayer.clearLayers();
    const selectedGroups = new Set(
      this.activeFilters()
        .filter((filter) => filter.startsWith('territory:'))
        .map((filter) => filter.slice('territory:'.length)),
    );
    if (this.showSyntheticRiskAreas()) {
      selectedGroups.add('DEMO_DISPUTED');
      selectedGroups.add('DEMO_UNKNOWN');
    }
    const selectedId = this.selectedTerritoryId();

    for (const area of this.allRiskAreaFeatures()) {
      if (!selectedGroups.has(area.properties.f)) continue;
      const group = TERRITORY_GROUP_BY_ID.get(area.properties.f) ?? {
        color: area.id === -1 ? '#D98232' : '#8993A1',
      };
      const isSelected = selectedId === area.id;
      this.leaflet
        .geoJSON(area, {
          style: {
            color: group.color,
            weight: isSelected ? 2.3 : 1.1,
            opacity: 0.84,
            fillOpacity: isSelected ? 0.44 : 0.22,
          },
          onEachFeature: (_feature, layer) => {
            const tooltip = document.createElement('span');
            tooltip.textContent = area.properties.n;
            layer.bindTooltip(tooltip);
            layer.on('click', (event) => {
              if (this.useRadius() || this.mapPickPurpose()) return;
              this.openRiskArea(area);
              this.leaflet
                ?.popup({ closeButton: true })
                .setLatLng(event.latlng)
                .setContent(this.createTerritoryPopup(area))
                .openOn(this.fallbackMap!);
            });
          },
        })
        .addTo(this.fallbackTerritoryLayer);
    }
  }

  private createTerritoryPopup(area: TerritoryFeature): HTMLElement {
    const content = document.createElement('div');
    content.className = 'map-popup';
    const title = document.createElement('strong');
    title.textContent = area.properties.n;
    const details = riskAreaDetails(area.properties);
    const label = document.createElement('p');
    label.textContent = `Grupo indicado segundo a fonte: ${details.group}`;
    const note = document.createElement('small');
    note.textContent = `Referência: ${this.riskDateLabel(details.referenceTime)}. Não confirma a situação atual.`;
    const source = document.createElement(details.sourceUrl ? 'a' : 'span');
    source.textContent = `Fonte: ${details.sourceName}`;
    if (details.sourceUrl) {
      source.setAttribute('href', details.sourceUrl);
      source.setAttribute('target', '_blank');
      source.setAttribute('rel', 'noopener noreferrer');
    }
    content.append(title, label, note, source);
    return content;
  }

  private getTerritoryBounds(area: TerritoryFeature): [[number, number], [number, number]] {
    const positions =
      area.geometry.type === 'Polygon'
        ? area.geometry.coordinates.flat(1)
        : area.geometry.coordinates.flat(2);
    const longitudes = positions.map(([longitude]) => longitude);
    const latitudes = positions.map(([, latitude]) => latitude);
    return [
      [Math.min(...longitudes), Math.min(...latitudes)],
      [Math.max(...longitudes), Math.max(...latitudes)],
    ];
  }

  private collectSearchResults(query: string): MapSearchResult[] {
    const normalized = normalizeSearch(query);
    if (normalized.length < 2) return [];

    const occurrences = this.visiblePoints()
      .filter((point) =>
        normalizeSearch(`${point.name} ${point.location} ${point.description}`).includes(
          normalized,
        ),
      )
      .map((point) => ({
        kind: 'occurrence' as const,
        key: `occurrence:${point.id}`,
        title: point.name,
        subtitle: `${point.location} · ${point.kind === 'poi' ? 'Ponto de interesse fictício' : 'Ocorrência fictícia'}`,
        point,
      }));
    const areas = this.territories()
      .filter((area) => normalizeSearch(area.properties.n).includes(normalized))
      .map((area) => ({
        kind: 'territory' as const,
        key: `territory:${area.id}`,
        title: area.properties.n,
        subtitle: `${TERRITORY_GROUP_BY_ID.get(area.properties.f)?.label ?? 'Classificação da fonte'} · Base jul/2026`,
        area,
      }));
    const references = DEMO_LOCATION_REFERENCES.filter((reference) =>
      normalizeSearch(reference.label).includes(normalized),
    ).map((reference) => ({
      kind: 'reference' as const,
      key: `reference:${reference.id}`,
      title: reference.label,
      subtitle: 'Exemplo sintético: posiciona somente a câmera',
      reference,
    }));
    return [...references, ...occurrences, ...areas];
  }

  private updateFallbackMapLayers(): void {
    const leaflet = this.leaflet;
    const map = this.fallbackMap;
    const pointsLayer = this.fallbackPointsLayer;
    const eventHeatLayer = this.fallbackEventHeatLayer;
    const poiHeatLayer = this.fallbackPoiHeatLayer;
    const radiusLayer = this.fallbackRadiusLayer;
    if (!leaflet || !map || !pointsLayer || !eventHeatLayer || !poiHeatLayer || !radiusLayer) {
      return;
    }

    const showHeat = this.heatmap();
    for (const [layer, visible] of [
      [pointsLayer, !showHeat],
      [eventHeatLayer, showHeat],
      [poiHeatLayer, showHeat],
    ] as [LeafletLayerGroup, boolean][]) {
      if (visible && !map.hasLayer(layer)) layer.addTo(map);
      else if (!visible && map.hasLayer(layer)) map.removeLayer(layer);
    }
    eventHeatLayer.clearLayers();
    poiHeatLayer.clearLayers();
    pointsLayer.clearLayers();
    this.fallbackPointMarkers.clear();

    const visible: MappedDemoPoint[] = this.visiblePoints().filter(isMappedRecord);

    if (showHeat) {
      for (const point of visible) {
        const [longitude, latitude] = point.coordinates;
        const color =
          point.kind === 'poi'
            ? '#a3e635'
            : point.category === 'TRANSITO'
              ? '#22c55e'
              : point.category === 'SEGURANCA'
                ? '#ef4444'
                : '#facc15';
        leaflet
          .circleMarker([latitude, longitude], {
            radius: point.kind === 'occurrence' ? 26 : 22,
            color,
            weight: 0,
            opacity: 0.35,
            fillColor: color,
            fillOpacity: 0.22,
            interactive: false,
          })
          .addTo(point.kind === 'occurrence' ? eventHeatLayer : poiHeatLayer);
      }
    } else {
      // 1. POIs are never clustered
      const pois = visible.filter((point) => point.kind === 'poi');
      for (const poi of pois) {
        const [longitude, latitude] = poi.coordinates;
        const element = document.createElement('span');
        element.className = 'fallback-poi-code';
        element.textContent = this.markerCode(poi);

        const marker = leaflet.marker([latitude, longitude], {
          title: `${poi.name} · ponto de interesse fictício`,
          alt: poi.name,
          bubblingMouseEvents: true,
          icon: leaflet.divIcon({
            html: element,
            className: 'occurrence-pin',
            iconSize: [18, 18],
            iconAnchor: [9, 9],
            popupAnchor: [0, -18],
          }),
        });
        marker.on('click', () => {
          if (this.useRadius() || this.mapPickPurpose()) return;
          this.selectedPointId.set(poi.id);
          this.refreshMapData();
          leaflet
            .popup({ closeButton: true, offset: [0, -18] })
            .setLatLng(marker.getLatLng())
            .setContent(this.createRasterPointPopup(poi))
            .openOn(map);
        });
        marker.addTo(pointsLayer);
        this.fallbackPointMarkers.set(poi.id, marker);
        if (this.selectedPointId() === poi.id) {
          marker.getElement()?.classList.add('is-selected');
        }
      }

      // 2. Occurrences: check zoom for clustering
      const occurrences = visible.filter((point) => point.kind === 'occurrence');
      const currentZoom = map.getZoom();

      if (currentZoom <= 12.5) {
        // Zoomed out: Cluster nearby occurrences using screen distance
        const clusters: { center: [number, number]; points: MappedDemoPoint[] }[] = [];

        for (const point of occurrences) {
          const pt = map.latLngToLayerPoint([point.coordinates[1], point.coordinates[0]]);
          let added = false;
          for (const cluster of clusters) {
            const clusterPt = map.latLngToLayerPoint([cluster.center[1], cluster.center[0]]);
            const distance = Math.hypot(pt.x - clusterPt.x, pt.y - clusterPt.y);
            if (distance < 55) {
              cluster.points.push(point);
              const count = cluster.points.length;
              const sumLng = cluster.points.reduce((acc, p) => acc + p.coordinates[0], 0);
              const sumLat = cluster.points.reduce((acc, p) => acc + p.coordinates[1], 0);
              cluster.center = [sumLng / count, sumLat / count];
              added = true;
              break;
            }
          }
          if (!added) {
            clusters.push({
              center: [point.coordinates[0], point.coordinates[1]],
              points: [point],
            });
          }
        }

        for (const cluster of clusters) {
          if (cluster.points.length > 1) {
            const clusterElement = document.createElement('div');
            clusterElement.className = 'occurrence-cluster';
            clusterElement.setAttribute('data-testid', 'occurrence-cluster');
            clusterElement.setAttribute('data-cluster-count', String(cluster.points.length));
            clusterElement.textContent = String(cluster.points.length);

            const marker = leaflet.marker([cluster.center[1], cluster.center[0]], {
              title: `${cluster.points.length} ocorrências agrupadas`,
              icon: leaflet.divIcon({
                html: clusterElement,
                className: '',
                iconSize: [36, 36],
                iconAnchor: [18, 18],
              }),
            });
            marker.on('click', () => {
              map.setView(
                [cluster.center[1], cluster.center[0]],
                Math.min(map.getMaxZoom(), currentZoom + 2),
              );
            });
            marker.addTo(pointsLayer);
            marker.getElement()?.setAttribute('data-testid', 'occurrence-cluster');
          } else {
            const point = cluster.points[0];
            this.renderLeafletOccurrencePin(point, pointsLayer, map, [point]);
          }
        }
      } else {
        // Zoomed in (> 12): Render individual pins or coincident pins
        const groups: MappedDemoPoint[][] = [];
        for (const point of occurrences) {
          let foundGroup = false;
          for (const group of groups) {
            const first = group[0];
            if (
              Math.abs(first.coordinates[0] - point.coordinates[0]) < 0.0001 &&
              Math.abs(first.coordinates[1] - point.coordinates[1]) < 0.0001
            ) {
              group.push(point);
              foundGroup = true;
              break;
            }
          }
          if (!foundGroup) {
            groups.push([point]);
          }
        }

        for (const group of groups) {
          const mainPoint = group[0];
          this.renderLeafletOccurrencePin(mainPoint, pointsLayer, map, group);
        }
      }
    }

    if (this.useRadius() && !this.radiusInvalid()) {
      const center = this.searchCenter();
      const longitude = Number(center.longitude);
      const latitude = Number(center.latitude);
      const existing = radiusLayer.getLayers()[0] as import('leaflet').Circle | undefined;
      if (existing) {
        existing.setLatLng([latitude, longitude]).setRadius(this.radiusMeters());
      } else
        leaflet
          .circle([latitude, longitude], {
            radius: this.radiusMeters(),
            color: SEARCH_RADIUS_COLOR,
            opacity: 0.82,
            weight: 2,
            fillColor: SEARCH_RADIUS_COLOR,
            fillOpacity: 0.18,
            interactive: false,
          })
          .addTo(radiusLayer);
    } else radiusLayer.clearLayers();
  }

  private renderLeafletOccurrencePin(
    point: MappedDemoPoint,
    layer: LeafletLayerGroup,
    map: LeafletMap,
    group: MappedDemoPoint[],
  ): void {
    const leaflet = this.leaflet;
    if (!leaflet) return;
    const [longitude, latitude] = point.coordinates;
    const isCoincident = group.length > 1;

    const element = document.createElement('span');
    const image = document.createElement('img');
    image.src = `maps/pins/${point.category!.toLowerCase()}.svg`;
    image.alt = '';
    image.width = 32;
    image.height = 44;
    element.append(image);

    if (isCoincident) {
      element.setAttribute('data-testid', 'coincident-marker');
      element.setAttribute('data-coincident-count', String(group.length));
      const badge = document.createElement('span');
      badge.className = 'coincident-badge';
      badge.setAttribute('data-testid', 'coincident-badge');
      badge.textContent = String(group.length);
      element.append(badge);
    }

    const title = isCoincident
      ? `${point.name} (+${group.length - 1} sobrepostas) · ocorrência fictícia`
      : `${point.name} · ocorrência fictícia`;

    const marker = leaflet.marker([latitude, longitude], {
      title,
      alt: point.name,
      bubblingMouseEvents: true,
      icon: leaflet.divIcon({
        html: element,
        className: isCoincident ? 'occurrence-pin is-coincident' : 'occurrence-pin',
        iconSize: [32, 44],
        iconAnchor: [16, 42],
        popupAnchor: [0, -38],
      }),
    });

    marker.on('click', () => {
      if (this.useRadius() || this.mapPickPurpose()) return;
      if (isCoincident) {
        leaflet
          .popup({ closeButton: true, offset: [0, -38] })
          .setLatLng([latitude, longitude])
          .setContent(this.createCoincidentPointsPopup(group))
          .openOn(map);
      } else {
        this.selectedPointId.set(point.id);
        this.refreshMapData();
        leaflet
          .popup({ closeButton: true, offset: [0, -38] })
          .setLatLng([latitude, longitude])
          .setContent(this.createRasterPointPopup(point))
          .openOn(map);
      }
    });

    marker.addTo(layer);
    if (isCoincident) {
      marker.getElement()?.setAttribute('data-testid', 'coincident-marker');
      marker.getElement()?.setAttribute('data-coincident-count', String(group.length));
    }
    for (const item of group) {
      this.fallbackPointMarkers.set(item.id, marker);
    }

    const isSelected = group.some((p) => p.id === this.selectedPointId());
    if (isSelected) {
      marker.getElement()?.classList.add('is-selected');
    }
  }

  private createCoincidentPointsPopup(points: DemoPoint[]): HTMLElement {
    const content = document.createElement('div');
    content.className = 'map-popup coincident-pins-expansion';
    content.setAttribute('data-testid', 'coincident-pins-expansion');

    const title = document.createElement('strong');
    title.className = 'coincident-title';
    title.textContent = `Ocorrências sobrepostas (${points.length})`;

    const description = document.createElement('p');
    description.className = 'coincident-desc';
    description.textContent =
      'Existem registros com a mesma coordenada geográfica cadastrada. Selecione um item para visualizar seus detalhes:';

    const list = document.createElement('ul');
    list.className = 'coincident-list';

    for (const point of points) {
      const item = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'coincident-select-btn';
      button.setAttribute('data-coincident-select', point.id);
      button.setAttribute('data-testid', `coincident-select-${point.id}`);

      const name = document.createElement('span');
      name.className = 'coincident-item-name';
      name.textContent = point.name;

      const meta = document.createElement('span');
      meta.className = 'coincident-item-meta';
      meta.textContent = `${this.recordTypeLabel(point)} · ${point.location}`;

      button.append(name, meta);
      button.addEventListener('click', () => {
        this.selectAndFocusRecordDetail(point.id);
      });

      item.append(button);
      list.append(item);
    }

    content.append(title, description, list);
    return content;
  }

  private selectAndFocusRecordDetail(pointId: string): void {
    this.selectedPointId.set(pointId);
    this.relatedDetailIds.update((ids) => {
      const copy = { ...ids };
      delete copy[pointId];
      return copy;
    });
    if (!this.isResultDetailOpen(pointId)) {
      const ids = this.expandedResultDetailIds();
      this.expandedResultDetailIds.set([...ids.slice(-4), pointId]);
    }
    this.fallbackMap?.closePopup();
    if (this.map) {
      const popups = document.querySelectorAll('.maplibregl-popup');
      popups.forEach((popup) => popup.remove());
    }
    setTimeout(() => {
      const heading = document.getElementById(`map-result-detail-heading-${pointId}`);
      heading?.scrollIntoView({ block: 'nearest' });
      heading?.focus();
    });
  }

  private createRasterPointPopup(point: DemoPoint): HTMLElement {
    const content = document.createElement('div');
    content.className = 'map-popup';
    const title = document.createElement('strong');
    title.textContent = point.name;
    const description = document.createElement('p');
    description.textContent = point.description;
    const location = document.createElement('span');
    location.textContent = point.location;
    const type = document.createElement('span');
    type.textContent = `${this.recordTypeLabel(point)} · ${point.severity ?? 'gravidade não informada'}`;
    const status = document.createElement('span');
    status.textContent = this.situationLabel(point.situation);
    const source = document.createElement('small');
    source.textContent = `Fonte: ${point.sourceId ?? 'demonstração local'}`;
    const inserted = document.createElement('small');
    inserted.textContent = `Inserido às ${this.formatTime(point.insertedAt)}`;
    content.append(title, description, location, type, status, source, inserted);
    const details = document.createElement('button');
    details.type = 'button';
    details.textContent = 'Abrir detalhes da ocorrência';
    details.addEventListener('click', () => {
      this.selectAndFocusRecordDetail(point.id);
    });
    content.append(details);
    return content;
  }

  private refreshMapData(): void {
    const visibleIds = new Set(this.visiblePoints().map((point) => point.id));
    this.expandedResultDetailIds.update((ids) => ids.filter((id) => visibleIds.has(id)));
    if (this.mapRefreshFrame !== undefined || (!this.map && !this.fallbackMap)) return;
    this.mapRefreshFrame = requestAnimationFrame(() => {
      this.mapRefreshFrame = undefined;
      this.updateMapLayers();
    });
  }

  private observeMapSize(): void {
    this.mapResizeObserver?.disconnect();
    if (typeof ResizeObserver === 'undefined') return;
    const container = document.getElementById('map-canvas');
    if (!container) return;
    this.mapResizeObserver = new ResizeObserver((entries) => {
      if (!entries.some((entry) => entry.contentRect.width > 0 && entry.contentRect.height > 0))
        return;
      this.map?.resize();
      this.resizeFallbackMap();
    });
    this.mapResizeObserver.observe(container);
  }

  private resizeFallbackMap(): void {
    const map = this.fallbackMap;
    if (!map) return;
    const container = map.getContainer();
    const size = map.getSize();
    if (
      container.clientWidth > 0 &&
      container.clientHeight > 0 &&
      (size.x !== container.clientWidth || size.y !== container.clientHeight)
    ) {
      map.invalidateSize();
    }
  }

  private updateMapLayers(): void {
    this.updateFallbackMapLayers();
    const radiusSource = this.map?.getSource('search-radius-source') as
      maplibregl.GeoJSONSource | undefined;
    radiusSource?.setData(this.radiusGeoJson());
    const occurrenceSource = this.map?.getSource('demo-points') as
      maplibregl.GeoJSONSource | undefined;
    occurrenceSource?.setData(this.toGeoJson('occurrence'));
    const poiSource = this.map?.getSource('demo-pois') as maplibregl.GeoJSONSource | undefined;
    poiSource?.setData(this.toGeoJson('poi'));
    const occurrenceHeatSource = this.map?.getSource('heat-occurrences') as
      maplibregl.GeoJSONSource | undefined;
    occurrenceHeatSource?.setData(this.toGeoJson('occurrence'));
    const poiHeatSource = this.map?.getSource('heat-pois') as maplibregl.GeoJSONSource | undefined;
    poiHeatSource?.setData(this.toGeoJson('poi'));
    if (this.map?.getLayer('demo-occurrence-clusters')) {
      this.map.setLayoutProperty(
        'demo-occurrence-clusters',
        'visibility',
        this.heatmap() ? 'none' : 'visible',
      );
    }
    if (this.map?.getLayer('demo-occurrence-cluster-count')) {
      this.map.setLayoutProperty(
        'demo-occurrence-cluster-count',
        'visibility',
        this.heatmap() ? 'none' : 'visible',
      );
    }
    if (this.map?.getLayer('demo-occurrence-pins')) {
      this.map.setLayoutProperty(
        'demo-occurrence-pins',
        'visibility',
        this.heatmap() ? 'none' : 'visible',
      );
    }
    if (this.heatmap() && this.map?.getLayer('demo-points-dot')) {
      this.map.setLayoutProperty('demo-points-dot', 'visibility', 'none');
      if (this.map.getLayer('demo-points-code')) {
        this.map.setLayoutProperty('demo-points-code', 'visibility', 'none');
      }
      this.map.setLayoutProperty('demo-points-glow', 'visibility', 'none');
      for (const [id, heatSource, gradient] of [
        [
          'demo-heatmap-events',
          'heat-occurrences',
          [
            'interpolate',
            ['linear'],
            ['heatmap-density'],
            0,
            'rgba(56,189,248,0)',
            0.35,
            '#38bdf8',
            1,
            '#f87171',
          ],
        ],
        [
          'demo-heatmap-pois',
          'heat-pois',
          [
            'interpolate',
            ['linear'],
            ['heatmap-density'],
            0,
            'rgba(163,230,53,0)',
            0.35,
            '#a3e635',
            1,
            '#c084fc',
          ],
        ],
      ] as [string, string, unknown[]][]) {
        if (!this.map.getLayer(id)) {
          this.map.addLayer({
            id,
            type: 'heatmap',
            source: heatSource,
            paint: {
              'heatmap-weight': 1,
              'heatmap-intensity': 0.8,
              'heatmap-radius': 36,
              'heatmap-opacity': 0.78,
              'heatmap-color': gradient as maplibregl.ExpressionSpecification,
            },
          });
        }
        this.map.setLayoutProperty(id, 'visibility', 'visible');
      }
    } else if (this.map?.getLayer('demo-points-dot')) {
      this.map.setLayoutProperty('demo-points-dot', 'visibility', 'visible');
      if (this.map.getLayer('demo-points-code')) {
        this.map.setLayoutProperty('demo-points-code', 'visibility', 'visible');
      }
      this.map.setLayoutProperty('demo-points-glow', 'visibility', 'visible');
      for (const id of ['demo-heatmap-events', 'demo-heatmap-pois']) {
        if (this.map.getLayer(id)) this.map.setLayoutProperty(id, 'visibility', 'none');
      }
    }
  }

  private toGeoJson(kind?: DemoPoint['kind']): FeatureCollection<Point> {
    const points: MappedDemoPoint[] = this.visiblePoints()
      .filter(isMappedRecord)
      .filter((point) => !kind || point.kind === kind);

    const occurrenceCounts = new Map<string, number>();
    for (const point of points) {
      if (point.kind === 'occurrence') {
        const key = `${point.coordinates[0].toFixed(5)},${point.coordinates[1].toFixed(5)}`;
        occurrenceCounts.set(key, (occurrenceCounts.get(key) ?? 0) + 1);
      }
    }

    return {
      type: 'FeatureCollection',
      features: points.map((point) => {
        const key = `${point.coordinates[0].toFixed(5)},${point.coordinates[1].toFixed(5)}`;
        const coincidentCount = point.kind === 'occurrence' ? (occurrenceCounts.get(key) ?? 1) : 1;
        return {
          type: 'Feature',
          id: point.id,
          geometry: { type: 'Point', coordinates: point.coordinates },
          properties: {
            recordId: point.id,
            kind: point.kind,
            name: point.name,
            description: point.description,
            location: point.location,
            typeLabel: this.recordTypeLabel(point),
            markerCode: this.markerCode(point),
            insertedAt: point.insertedAt,
            occurredAt: point.occurredAt ?? '',
            severity: point.severity ?? '',
            operationalStatus: point.operationalStatus ?? '',
            situationLabel: this.situationLabel(point.situation),
            sourceId: point.sourceId ?? 'demo',
            category: point.category ?? 'POI',
            selected: this.selectedPointId() === point.id,
            coincidentCount,
          },
        };
      }),
    };
  }

  private radiusGeoJson(): FeatureCollection<Polygon> {
    if (!this.useRadius() || this.radiusInvalid() || !this.radiusCircleFactory) {
      return { type: 'FeatureCollection', features: [] };
    }
    const center = this.searchCenter();
    const coordinates: Coordinates = [Number(center.longitude), Number(center.latitude)];
    return {
      type: 'FeatureCollection',
      features: [this.radiusCircleFactory(coordinates, this.radiusMeters())],
    };
  }

  private hoursAgo(hours: number): string {
    return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  }
}
