import { Component } from '@angular/core';
import { CollectionPanel } from '../collection/collection-panel';
import { ReviewQueue } from '../moderation/review-queue';
import { OperationsPanel } from '../operations/operations-panel';
import { OccurrencesAdminPanel } from '../occurrences-admin/occurrences-admin-panel';
import { RiskAreaFields } from '../territories/risk-area-fields';
import { ReliabilityPanel } from '../reliability/reliability-panel';
import { SourceManagement } from '../sources/source-management';

/**
 * Agrupamento dos painéis administrativos de fontes, coleta, operação, revisão, confiabilidade,
 * ocorrências e campos das Áreas de Risco.
 *
 * Existe para que `app.html` possa diferir (`@defer`) a área administrativa em um único bloco
 * preguiçoso: quem só consulta o mapa não baixa código de administração. A composição é a mesma de
 * antes — nenhum painel mudou de contrato, ordem ou permissão.
 */
@Component({
  selector: 'app-admin-sources-panels',
  imports: [
    OperationsPanel,
    SourceManagement,
    CollectionPanel,
    ReviewQueue,
    ReliabilityPanel,
    OccurrencesAdminPanel,
    RiskAreaFields,
  ],
  template: `
    <app-operations-panel />
    <app-source-management />
    <app-collection-panel />
    <app-review-queue />
    <app-reliability-panel />
    <app-occurrences-admin-panel />
    <app-risk-area-fields />
  `,
})
export class AdminSourcesPanels {}
