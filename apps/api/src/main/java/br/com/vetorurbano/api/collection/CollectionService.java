package br.com.vetorurbano.api.collection;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.atomic.AtomicBoolean;
import tools.jackson.databind.JsonNode;

/**
 * Máquina de estados da coleta autorizada. Nada é publicado: cada item novo vira clipping rastreável
 * mais uma entrada {@code PENDING} da fila de revisão do ticket 17. Falha nunca vira zero, nada é
 * apagado e {@code PARTIAL}/{@code PAUSED} retomam do cursor.
 */
public class CollectionService {
    /** Recorte aprovado: Região Metropolitana do Rio de Janeiro. */
    static final String STATE_NAME = "Rio de Janeiro";
    private static final String BACKFILL_LIMIT_DETAIL =
            "Limite acumulado de páginas da janela atingido; cursor preservado. Inicie uma janela menor e não sobreposta.";

    private final CollectionSettings settings;
    private final CollectionCredentials credentials;
    private final FogoCruzadoClient client;
    private final CollectionStore store;
    private final Clock clock;
    private final ExecutorService executor;
    private final AtomicBoolean scheduledRunInFlight = new AtomicBoolean();

    public CollectionService(CollectionSettings settings, CollectionCredentials credentials, FogoCruzadoClient client,
            CollectionStore store, Clock clock, ExecutorService executor) {
        this.settings = settings;
        this.credentials = credentials;
        this.client = client;
        this.store = store;
        this.clock = clock;
        this.executor = executor;
    }

    public boolean configured() {
        return settings.enabled() && credentials.available();
    }

    private Instant now() { return clock.instant(); }

    /** Superfície de leitura: estado distinto por fonte, nunca fundindo desligado, vazio e falha. */
    public Map<String, Object> status() {
        Map<String, Object> view = new LinkedHashMap<>();
        view.put("sourceId", settings.sourceId());
        view.put("configured", configured());
        view.put("ficha", fichaView(CollectionSourceFicha.authorized(settings.sourceId())));
        // Atribuição exigida pelo termo da fonte, também no estado da coleta. Nunca inclui credencial.
        view.put("attribution", CollectionSourceFicha.ATTRIBUTION);
        view.put("backfillLimits", Map.of(
                "maxPagesPerWindow", CollectionSettings.BACKFILL_MAX_PAGES_PER_WINDOW,
                "maxPagesPerAttempt", CollectionSettings.BACKFILL_MAX_PAGES_PER_ATTEMPT,
                "minPageIntervalSeconds", CollectionSettings.BACKFILL_MIN_REQUEST_INTERVAL.toSeconds()));
        if (!configured()) {
            view.put("reason", settings.enabled() ? "CREDENTIALS_MISSING" : "COLLECTION_DISABLED");
            view.put("state", CollectionRunState.NOT_CONFIGURED.name());
            view.put("source", null);
            view.put("lastRun", null);
            view.put("counters", emptyCounters());
            return view;
        }
        bootstrap();
        var source = store.source(settings.sourceId());
        List<Map<String, Object>> runs = store.runs(1);
        Map<String, Object> lastRun = runs.isEmpty() ? null : runs.getFirst();
        view.put("reason", null);
        // Sem execução ainda não há estado de execução: não é falha, vazio nem «não configurado».
        view.put("state", lastRun == null ? null : lastRun.get("state"));
        view.put("source", source);
        view.put("lastRun", lastRun);
        view.put("counters", lastRun == null ? emptyCounters() : Map.of(
                "itemsSeen", lastRun.get("itemsSeen"), "itemsCreated", lastRun.get("itemsCreated"),
                "itemsDuplicated", lastRun.get("itemsDuplicated"), "pagesDone", lastRun.get("pagesDone")));
        return view;
    }

    public List<Map<String, Object>> runs(int limit) {
        return store.runs(limit);
    }

    /** Dispara execução manual e devolve a execução criada; o trabalho segue no executor dedicado. */
    public Map<String, Object> startRun(Map<String, Object> body, UUID actor) {
        requireConfigured();
        bootstrap();
        CollectionRunKind kind = CollectionRunKind.parse(text(body, "kind"));
        LocalDate today = LocalDate.now(clock.withZone(ZoneId.of("America/Sao_Paulo")));
        LocalDate from = kind == CollectionRunKind.BACKFILL
                ? requiredDate(body, "from") : date(body, "from", settings.windowStart());
        LocalDate to = kind == CollectionRunKind.BACKFILL
                ? requiredDate(body, "to") : date(body, "to", today);
        if (from.isBefore(settings.windowStart()))
            throw CollectionFailure.invalid("Janela anterior ao recorte aprovado (" + settings.windowStart() + ").");
        if (to.isAfter(today))
            throw CollectionFailure.invalid("Fim da janela posterior à data atual.");
        if (to.isBefore(from))
            throw CollectionFailure.invalid("Fim da janela anterior ao início.");
        int maxPages = kind == CollectionRunKind.BACKFILL
                ? Math.min(settings.maxPages(), CollectionSettings.BACKFILL_MAX_PAGES_PER_ATTEMPT)
                : settings.maxPages();
        UUID runId;
        if (kind == CollectionRunKind.BACKFILL) {
            var start = store.createBackfillRunIfAvailable(settings.sourceId(), from, to, settings.pageSize(), maxPages,
                    CollectionSettings.BACKFILL_MAX_PAGES_PER_WINDOW, actor, now());
            if (start.runId() == null) {
                if ("COLLECTION_RUN_ACTIVE".equals(start.conflictCode()))
                    throw CollectionFailure.conflict("COLLECTION_RUN_ACTIVE",
                            "Já existe execução aberta ou aguardando retomada para esta fonte.");
                throw CollectionFailure.conflict("BACKFILL_WINDOW_LIMIT_REACHED",
                        "A janela esgotada só pode ser seguida por período menor e sem sobreposição.");
            }
            runId = start.runId();
        } else {
            runId = store.createRunIfAvailable(settings.sourceId(), kind, from, to, settings.pageSize(), maxPages,
                    actor, now());
            if (runId == null)
                throw CollectionFailure.conflict("COLLECTION_RUN_ACTIVE",
                        "Já existe execução aberta ou aguardando retomada para esta fonte.");
        }
        executor.execute(() -> execute(runId));
        return store.run(runId);
    }

    /** Pausa do ADMIN; espera a execução parar no limite de página e devolve o estado observado. */
    public Map<String, Object> pause(UUID runId, UUID actor) {
        var run = requireRun(runId);
        if (!CollectionRunState.RUNNING.name().equals(run.get("state")))
            throw CollectionFailure.conflict("COLLECTION_RUN_NOT_RUNNING", "Só é possível pausar execução em andamento.");
        store.requestPause(runId, (String) run.get("sourceId"), now());
        return settle(runId);
    }

    /** Retomada continua do cursor preservado; vale para execução pausada e para falha parcial. */
    public Map<String, Object> resume(UUID runId, UUID actor) {
        var run = requireRun(runId);
        if (CollectionErrorClass.BACKFILL_LIMIT_REACHED.name().equals(run.get("errorClass")))
            throw CollectionFailure.conflict("BACKFILL_WINDOW_LIMIT_REACHED",
                    "O limite acumulado desta janela foi atingido. Inicie uma janela menor e não sobreposta.");
        if (CollectionRunKind.parse((String) run.get("kind")) == CollectionRunKind.BACKFILL
                && store.backfillPagesRequested((String) run.get("sourceId"),
                        LocalDate.parse((String) run.get("windowStart")),
                        LocalDate.parse((String) run.get("windowEnd"))) >= CollectionSettings.BACKFILL_MAX_PAGES_PER_WINDOW)
            throw CollectionFailure.conflict("BACKFILL_WINDOW_LIMIT_REACHED",
                    "O limite acumulado desta janela foi atingido. Inicie uma janela menor e não sobreposta.");
        String state = (String) run.get("state");
        if (!CollectionRunState.PAUSED.name().equals(state) && !CollectionRunState.PARTIAL.name().equals(state))
            throw CollectionFailure.conflict("COLLECTION_RUN_NOT_RESUMABLE",
                    "Retomada exige execução pausada ou falha parcial com cursor preservado.");
        if (!store.resumeRun(runId, (String) run.get("sourceId"), now()))
            throw CollectionFailure.conflict("COLLECTION_RUN_NOT_RESUMABLE",
                    "Retomada exige execução pausada ou falha parcial com cursor preservado.");
        executor.execute(() -> execute(runId));
        return store.run(runId);
    }

    /** Cadência periódica: só roda com coleta configurada e sem execução aberta na fonte. */
    public void poll() {
        if (!configured()) return;
        if (!scheduledRunInFlight.compareAndSet(false, true)) return;
        try {
            if (store.hasOpenRun(settings.sourceId())) return;
            bootstrap();
            UUID runId = store.createRunIfAvailable(settings.sourceId(), CollectionRunKind.RECENT, settings.windowStart(),
                    LocalDate.now(clock.withZone(ZoneId.of("America/Sao_Paulo"))), settings.pageSize(),
                    settings.maxPages(), null, now());
            if (runId != null) execute(runId);
        } catch (RuntimeException failure) {
            // A cadência não derruba o agendador; a tentativa fica registrada na trilha da execução.
        } finally {
            scheduledRunInFlight.set(false);
        }
    }

    /** Executa (ou continua) a paginação preservando cursor e contadores. */
    void execute(UUID runId) {
        Map<String, Object> run = store.run(runId);
        String sourceId = (String) run.get("sourceId");
        CollectionRunKind kind = CollectionRunKind.parse((String) run.get("kind"));
        int pagesDone = (int) run.get("pagesDone");
        int created = (int) run.get("itemsCreated");
        int take = (int) run.get("take");
        int maxPages = (int) run.get("maxPages");
        LocalDate from = LocalDate.parse((String) run.get("windowStart"));
        LocalDate to = LocalDate.parse((String) run.get("windowEnd"));
        FogoCruzadoClient.UpstreamHeaders headers = null;
        try {
            var states = client.states();
            String stateId = resolveState(states);
            var cities = client.cities(stateId);
            var crossCheck = MetropolitanMunicipalities.current()
                    .crossCheck(cities.stream().map(FogoCruzadoClient.SourceCity::name).toList());
            store.municipalityReport(runId, sourceId, crossCheck.missing(), now());
            List<String> cityIds = matchCities(cities);
            store.stateResolved(runId, sourceId, stateId, cityIds.size(), now());

            int page = (int) run.get("nextPage");
            int pagesThisAttempt = 0;
            boolean exhausted = false;
            while (pagesThisAttempt < maxPages) {
                if (pauseRequested(runId)) {
                    // A tentativa é registrada antes do estado terminal: quem observa PAUSED já vê
                    // último erro/sucesso coerentes, sem leitura intermediária ambígua.
                    store.markAttempt(sourceId, now(), false, null, headers);
                    store.finishRun(runId, sourceId, CollectionRunState.PAUSED, null, null, now());
                    return;
                }
                if (kind == CollectionRunKind.BACKFILL) {
                    var reservation = store.reserveBackfillPageRequest(runId, sourceId, from, to, page,
                            CollectionSettings.BACKFILL_MAX_PAGES_PER_WINDOW,
                            CollectionSettings.BACKFILL_MIN_REQUEST_INTERVAL, now());
                    if (reservation.exhausted()) {
                        finishBackfillLimit(runId, sourceId, pagesDone, created, headers);
                        return;
                    }
                    if (reservation.waitMillis() > 0) {
                        try {
                            Thread.sleep(reservation.waitMillis());
                        } catch (InterruptedException interrupted) {
                            Thread.currentThread().interrupt();
                            store.requestPause(runId, sourceId, now());
                            store.markAttempt(sourceId, now(), false, null, headers);
                            store.finishRun(runId, sourceId, CollectionRunState.PAUSED, null, null, now());
                            return;
                        }
                        continue;
                    }
                }
                FogoCruzadoClient.Page result;
                try {
                    result = client.occurrences(from.toString(), to.toString(), stateId, cityIds, page, take);
                } finally {
                    if (kind == CollectionRunKind.BACKFILL) store.recordBackfillPageCompletion(sourceId, now());
                }
                List<CollectionMapper.CollectionItemDraft> drafts = new ArrayList<>();
                for (JsonNode occurrence : result.data()) drafts.add(CollectionMapper.map(occurrence, sourceId));
                int[] counters = store.persistPage(runId, sourceId, page, result.hasNextPage(), page + 1, drafts,
                        now(), now());
                created += counters[0];
                pagesDone++;
                pagesThisAttempt++;
                if (result.headers() != null) headers = merge(headers, result.headers());
                // Pedido de pausa durante a página: para no limite seguro, sem descartar o que já
                // foi persistido. O operador pediu para parar; a retomada continua do cursor.
                if (pauseRequested(runId)) {
                    store.markAttempt(sourceId, now(), false, null, headers);
                    store.finishRun(runId, sourceId, CollectionRunState.PAUSED, null, null, now());
                    return;
                }
                if (!result.hasNextPage()) {
                    exhausted = true;
                    break;
                }
                page++;
            }
            if (!exhausted) {
                if (kind == CollectionRunKind.BACKFILL
                        && store.backfillPagesRequested(sourceId, from, to) >= CollectionSettings.BACKFILL_MAX_PAGES_PER_WINDOW) {
                    finishBackfillLimit(runId, sourceId, pagesDone, created, headers);
                    return;
                }
                // Teto de páginas por etapa: o excedente vira retomada, nunca descarte.
                store.requestPause(runId, sourceId, now());
                store.markAttempt(sourceId, now(), false, null, headers);
                store.finishRun(runId, sourceId, CollectionRunState.PAUSED, null, null, now());
                return;
            }
            CollectionRunState state = CollectionRunOutcome.decide(pagesDone, created, null);
            store.markAttempt(sourceId, now(), true, null, headers);
            store.finishRun(runId, sourceId, state, null, null, now());
        } catch (FogoCruzadoException failure) {
            CollectionErrorClass errorClass = failure.errorClass();
            CollectionRunState state = CollectionRunOutcome.decide(pagesDone, created, errorClass);
            store.markAttempt(sourceId, now(), false, errorClass, headers);
            store.finishRun(runId, sourceId, state, errorClass, failure.getMessage(), now());
        } catch (CollectionFailure failure) {
            store.markAttempt(sourceId, now(), false, CollectionErrorClass.INVALID_RESPONSE, headers);
            store.finishRun(runId, sourceId, CollectionRunOutcome.decide(pagesDone, created, CollectionErrorClass.INVALID_RESPONSE),
                    CollectionErrorClass.INVALID_RESPONSE, failure.getMessage(), now());
        }
    }

    private void finishBackfillLimit(UUID runId, String sourceId, int pagesDone, int created,
            FogoCruzadoClient.UpstreamHeaders headers) {
        CollectionErrorClass error = CollectionErrorClass.BACKFILL_LIMIT_REACHED;
        store.markAttempt(sourceId, now(), false, error, headers);
        store.finishRun(runId, sourceId, CollectionRunOutcome.decide(pagesDone, created, error),
                error, BACKFILL_LIMIT_DETAIL, now());
    }

    /** Mantém o último valor observado de cada cabeçalho entre páginas. */
    private static FogoCruzadoClient.UpstreamHeaders merge(FogoCruzadoClient.UpstreamHeaders current,
            FogoCruzadoClient.UpstreamHeaders next) {
        if (current == null) return next;
        return new FogoCruzadoClient.UpstreamHeaders(
                next.lastUpdate() == null ? current.lastUpdate() : next.lastUpdate(),
                next.lastUpdateTimestamp() == null ? current.lastUpdateTimestamp() : next.lastUpdateTimestamp(),
                next.lastUpdateState() == null ? current.lastUpdateState() : next.lastUpdateState(),
                next.lastUpdateStateId() == null ? current.lastUpdateStateId() : next.lastUpdateStateId(),
                next.lastUpdateStateTimestamp() == null ? current.lastUpdateStateTimestamp() : next.lastUpdateStateTimestamp());
    }

    private String resolveState(List<FogoCruzadoClient.SourceState> states) {
        return states.stream()
                .filter(state -> MetropolitanMunicipalities.normalize(state.name())
                        .equals(MetropolitanMunicipalities.normalize(STATE_NAME)))
                .map(FogoCruzadoClient.SourceState::id).findFirst()
                .orElseThrow(() -> new FogoCruzadoException(CollectionErrorClass.INVALID_RESPONSE,
                        "Estado do recorte ausente na fonte."));
    }

    private static List<String> matchCities(List<FogoCruzadoClient.SourceCity> cities) {
        List<String> matched = new ArrayList<>();
        for (String municipality : MetropolitanMunicipalities.current().municipalities()) {
            String wanted = MetropolitanMunicipalities.normalize(municipality);
            cities.stream()
                    .filter(city -> MetropolitanMunicipalities.normalize(city.name()).equals(wanted))
                    .map(FogoCruzadoClient.SourceCity::id)
                    .findFirst().ifPresent(matched::add);
        }
        if (matched.isEmpty())
            throw new FogoCruzadoException(CollectionErrorClass.INVALID_RESPONSE,
                    "Nenhum município do recorte aprovado foi encontrado na fonte.");
        return List.copyOf(matched);
    }

    private boolean pauseRequested(UUID runId) {
        var run = store.run(runId);
        return run != null && Boolean.TRUE.equals(run.get("pauseRequested"));
    }

    /** Espera curta e explícita pelo estado observado; nunca presume que a pausa já valeu. */
    private Map<String, Object> settle(UUID runId) {
        Instant deadline = now().plus(Duration.ofSeconds(30));
        Map<String, Object> run = store.run(runId);
        while (CollectionRunState.RUNNING.name().equals(run.get("state")) && now().isBefore(deadline)) {
            try {
                Thread.sleep(25);
            } catch (InterruptedException failure) {
                Thread.currentThread().interrupt();
                break;
            }
            run = store.run(runId);
        }
        return run;
    }

    private Map<String, Object> requireRun(UUID runId) {
        Map<String, Object> run = store.run(runId);
        if (run == null) throw CollectionFailure.notFound();
        return run;
    }

    private void requireConfigured() {
        if (!settings.enabled()) throw CollectionFailure.notConfigured();
        if (!credentials.available()) throw CollectionFailure.notConfigured();
    }

    /** Ficha de procedência antes de qualquer coleta real; idempotente. */
    private void bootstrap() {
        store.ensureSourceFicha(CollectionSourceFicha.authorized(settings.sourceId()), now());
        store.ensureCollectionSource(settings, now());
    }

    private static Map<String, Object> fichaView(CollectionSourceFicha ficha) {
        Map<String, Object> view = new LinkedHashMap<>();
        view.put("sourceId", ficha.sourceId());
        view.put("publicName", ficha.publicName());
        view.put("credit", ficha.credit());
        view.put("attribution", CollectionSourceFicha.ATTRIBUTION);
        view.put("license", ficha.license());
        view.put("obtainedAt", ficha.obtainedAt());
        view.put("documentationUrl", ficha.documentationUrl());
        view.put("channel", ficha.channel());
        view.put("limitations", ficha.limitations());
        return view;
    }

    private static Map<String, Object> emptyCounters() {
        Map<String, Object> counters = new LinkedHashMap<>();
        counters.put("itemsSeen", 0);
        counters.put("itemsCreated", 0);
        counters.put("itemsDuplicated", 0);
        counters.put("pagesDone", 0);
        return counters;
    }

    private static String text(Map<String, Object> body, String field) {
        if (body == null) return null;
        Object value = body.get(field);
        return value instanceof String content ? content : null;
    }

    private static LocalDate requiredDate(Map<String, Object> body, String field) {
        String value = text(body, field);
        if (value == null || value.isBlank())
            throw CollectionFailure.invalid("Carga retroativa exige data explícita em '" + field + "'.");
        return date(body, field, null);
    }

    private static LocalDate date(Map<String, Object> body, String field, LocalDate fallback) {
        String value = text(body, field);
        if (value == null || value.isBlank()) return fallback;
        try {
            return LocalDate.parse(value.strip());
        } catch (RuntimeException failure) {
            throw CollectionFailure.invalid("Data inválida em '" + field + "'; use AAAA-MM-DD.");
        }
    }
}
