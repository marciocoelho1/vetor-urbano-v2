import { Component } from '@angular/core';
import { CollectionPanel } from '../collection/collection-panel';
import { ReviewQueue } from '../moderation/review-queue';
import { OperationsPanel } from '../operations/operations-panel';
import { SourceManagement } from '../sources/source-management';

/**
 * Agrupamento dos painéis administrativos de fontes, coleta, operação e revisão.
 *
 * Existe para que `app.html` possa diferir (`@defer`) a área administrativa em um único bloco
 * preguiçoso: quem só consulta o mapa não baixa código de administração. A composição é a mesma de
 * antes — nenhum painel mudou de contrato, ordem ou permissão.
 */
@Component({
  selector: 'app-admin-sources-panels',
  imports: [OperationsPanel, SourceManagement, CollectionPanel, ReviewQueue],
  template: `
    <app-operations-panel />
    <app-source-management />
    <app-collection-panel />
    <app-review-queue />
  `,
})
export class AdminSourcesPanels {}
