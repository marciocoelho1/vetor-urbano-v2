package br.com.vetorurbano.api.collection;

import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * Cliente HTTP da fonte autorizada (API Fogo Cruzado v2).
 *
 * <p><b>Seam de teste:</b> o cliente fala HTTP real contra
 * {@code vetor.collection.source-base-url}. A substituição do provedor externo nos testes é feita
 * <b>no limite HTTP</b> — um servidor local de verdade responde o mesmo contrato observado — e não
 * com mocks internos do cliente. Assim, autenticação, renovação, paginação, cabeçalhos, proteção de
 * borda e classes de erro são exercitados de ponta a ponta como em produção.
 *
 * <p><b>User-Agent obrigatório:</b> a proteção da fonte bloqueia clientes programáticos sem
 * identificação com HTTP 403 e corpo «error code: 1010». O cliente envia um User-Agent próprio e
 * traduz esse bloqueio para {@link CollectionErrorClass#UPSTREAM_BLOCKED}, distinto de 401/429/5xx.
 *
 * <p>O token vive apenas em memória durante a execução; nunca é persistido, logado ou serializado.
 */
public class FogoCruzadoClient {
    private static final JsonMapper JSON = JsonMapper.builder().build();
    private static final String LOGIN_PATH = "/auth/login";
    private static final String REFRESH_PATH = "/auth/refresh";
    private static final String STATES_PATH = "/states";
    private static final String CITIES_PATH = "/cities";
    private static final String OCCURRENCES_PATH = "/occurrences";

    private final HttpClient http;
    private final CollectionSettings settings;
    private final CollectionCredentials credentials;
    private final Clock clock;
    private final Duration timeout;

    private volatile String token;
    private volatile Instant tokenExpiresAt = Instant.EPOCH;

    public FogoCruzadoClient(HttpClient http, CollectionSettings settings, CollectionCredentials credentials, Clock clock) {
        this(http, settings, credentials, clock, Duration.ofSeconds(20));
    }

    public FogoCruzadoClient(HttpClient http, CollectionSettings settings, CollectionCredentials credentials,
            Clock clock, Duration timeout) {
        this.http = http;
        this.settings = settings;
        this.credentials = credentials;
        this.clock = clock;
        this.timeout = timeout;
    }

    public record SourceState(String id, String name) {}
    public record SourceCity(String id, String name) {}

    /** Metadados de atualização da fonte. Nunca conteúdo de ocorrência. */
    public record UpstreamHeaders(Instant lastUpdate, Long lastUpdateTimestamp, Instant lastUpdateState,
            String lastUpdateStateId, Long lastUpdateStateTimestamp) {}

    /** Página de ocorrências já interpretada, com metadados, cabeçalhos e itens crus. */
    public record Page(int page, int take, int itemCount, int pageCount, boolean hasPreviousPage,
            boolean hasNextPage, List<JsonNode> data, UpstreamHeaders headers, String code, String msgCode) {}

    public boolean credentialsAvailable() { return credentials.available(); }

    /** Autentica (HTTP 201) e guarda o token só em memória. */
    public synchronized String login() {
        if (!credentials.available())
            throw new FogoCruzadoException(CollectionErrorClass.AUTH_FAILED,
                    "Credencial da fonte ausente; coleta não configurada.");
        Map<String, Object> body = Map.of("email", credentials.email(), "password", credentials.password());
        HttpResponse<String> response = send("POST", LOGIN_PATH, body, null);
        requireAccepted(response, "Autenticação");
        JsonNode data = parse(response, "Autenticação").path("data");
        return storeToken(data, "Autenticação");
    }

    /**
     * Renovação explícita: o token atual vai como Bearer e, conforme o contrato escrito, também no
     * corpo {@code {accessToken}}. Uma recusa termina como {@code AUTH_FAILED}.
     */
    public synchronized String refresh(String current) {
        if (current == null || current.isBlank())
            throw new FogoCruzadoException(CollectionErrorClass.AUTH_FAILED, "Renovação sem token atual.");
        HttpResponse<String> response = send("POST", REFRESH_PATH, Map.of("accessToken", current), current);
        requireAccepted(response, "Renovação");
        JsonNode data = parse(response, "Renovação").path("data");
        return storeToken(data, "Renovação");
    }

    private String storeToken(JsonNode data, String what) {
        String accessToken = data.path("accessToken").asString();
        if (accessToken == null || accessToken.isBlank())
            throw new FogoCruzadoException(CollectionErrorClass.INVALID_RESPONSE,
                    what + " sem accessToken na resposta da fonte.");
        long expiresIn = data.path("expiresIn").asLong(3600);
        this.token = accessToken;
        this.tokenExpiresAt = clock.instant().plusSeconds(Math.max(60, expiresIn) - 30);
        return accessToken;
    }

    private String currentToken() {
        String current = token;
        if (current == null || !clock.instant().isBefore(tokenExpiresAt)) return login();
        return current;
    }

    public List<SourceState> states() {
        JsonNode data = authorisedGet(STATES_PATH, "Estados").path("data");
        List<SourceState> states = new ArrayList<>();
        if (data.isArray()) for (JsonNode node : data)
            states.add(new SourceState(node.path("id").asString(), node.path("name").asString()));
        return List.copyOf(states);
    }

    public List<SourceCity> cities(String stateId) {
        requireStateId(stateId);
        JsonNode data = authorisedGet(CITIES_PATH + "?stateId=" + encode(stateId), "Cidades").path("data");
        List<SourceCity> cities = new ArrayList<>();
        if (data.isArray()) for (JsonNode node : data)
            cities.add(new SourceCity(node.path("id").asString(), node.path("name").asString()));
        return List.copyOf(cities);
    }

    /**
     * {@code initialdate}/{@code finaldate} são datas simples {@code YYYY-MM-DD}; {@code idCities} repete.
     * {@code order=ASC} devolve do mais antigo ao mais novo, o que serve ao checkpoint de retomada.
     *
     * <p><b>Sem filtro por tipo:</b> a consulta não envia {@code typeOccurrence}. O recorte aprovado é
     * «as ocorrências registradas desde 01/06/2026» na Região Metropolitana e na cidade do Rio, sem
     * recorte por presença de vítima — medido na própria fonte em 19/10/2026, {@code withVictim}
     * devolveria 379 de 807 ocorrências e descartaria 428 silenciosamente. Disparo sem vítima é
     * ocorrência do produto (tipo {@code DISPAROS} com zero mortos), não item de outra natureza.
     */
    public Page occurrences(String initialDate, String finalDate, String stateId, List<String> cityIds,
            int page, int take) {
        requireStateId(stateId);
        if (initialDate == null || finalDate == null)
            throw new CollectionFailure(400, "INVALID_COLLECTION_RUN", "Janela da coleta incompleta.");
        if (take < 1 || take > 1000)
            throw new CollectionFailure(400, "INVALID_COLLECTION_RUN", "Tamanho de página inválido.");
        if (page < 1)
            throw new CollectionFailure(400, "INVALID_COLLECTION_RUN", "Página inválida.");
        StringBuilder query = new StringBuilder(OCCURRENCES_PATH)
                .append("?initialdate=").append(encode(initialDate))
                .append("&finaldate=").append(encode(finalDate))
                .append("&idState=").append(encode(stateId))
                .append("&order=ASC")
                .append("&page=").append(page)
                .append("&take=").append(take);
        for (String city : cityIds) query.append("&idCities=").append(encode(city));
        HttpResponse<String> response = authorisedResponse(query.toString());
        JsonNode root = parse(response, "Ocorrências");
        JsonNode data = root.path("data");
        if (!data.isArray())
            throw new FogoCruzadoException(CollectionErrorClass.INVALID_RESPONSE,
                    "Resposta de ocorrências sem lista em data.");
        JsonNode meta = root.path("pageMeta");
        List<JsonNode> items = new ArrayList<>();
        data.forEach(items::add);
        int reportedTake = meta.path("take").asInt(take);
        return new Page(
                meta.path("page").asInt(page),
                reportedTake <= 0 ? take : reportedTake,
                meta.path("itemCount").asInt(items.size()),
                meta.path("pageCount").asInt(items.isEmpty() ? 0 : 1),
                meta.path("hasPreviousPage").asBoolean(false),
                meta.path("hasNextPage").asBoolean(false),
                List.copyOf(items),
                headers(response),
                root.path("code").asString(),
                root.path("msgCode").asString());
    }

    private JsonNode authorisedGet(String path, String what) {
        return parse(authorisedResponse(path), what);
    }

    /** Resposta crua autorizada, para onde os cabeçalhos de atualização da fonte importam. */
    private HttpResponse<String> authorisedResponse(String path) {
        return authorisedSend("GET", path, null);
    }

    /**
     * Uma recusa 401 renova o token <b>uma única vez</b>; se a renovação falhar ou a segunda tentativa
     * também recusar, a execução termina como {@code AUTH_FAILED}.
     */
    private HttpResponse<String> authorisedSend(String method, String path, Map<String, Object> body) {
        String current = currentToken();
        boolean occurrenceRequest = path.startsWith(OCCURRENCES_PATH);
        HttpResponse<String> response = send(method, path, body, current);
        if (response.statusCode() == 401) {
            long firstAttemptCompleted = System.nanoTime();
            String renewed = refresh(current);
            if (occurrenceRequest) waitForOccurrenceRetry(firstAttemptCompleted);
            response = send(method, path, body, renewed);
        }
        requireAccepted(response, "Fonte em " + path);
        return response;
    }

    private void waitForOccurrenceRetry(long firstAttemptCompleted) {
        long remaining = CollectionSettings.BACKFILL_MIN_REQUEST_INTERVAL.toNanos()
                - (System.nanoTime() - firstAttemptCompleted);
        if (remaining <= 0) return;
        try {
            TimeUnit.NANOSECONDS.sleep(remaining);
        } catch (InterruptedException failure) {
            Thread.currentThread().interrupt();
            throw new FogoCruzadoException(CollectionErrorClass.UPSTREAM_UNAVAILABLE,
                    "Renovação interrompida antes de repetir a consulta de ocorrências.");
        }
    }

    private void requireAccepted(HttpResponse<String> response, String what) {
        int status = response.statusCode();
        if (status == 200 || status == 201) return;
        throw new FogoCruzadoException(CollectionErrorClass.fromHttpStatus(status, response.body()),
                what + ": recusa da fonte (HTTP " + status + ")"
                        + (CollectionErrorClass.isBlocked(response.body()) ? " por proteção de borda." : "."));
    }

    private JsonNode parse(HttpResponse<String> response, String what) {
        try {
            JsonNode root = JSON.readTree(response.body());
            if (root == null || root.isNull())
                throw new FogoCruzadoException(CollectionErrorClass.INVALID_RESPONSE, what + ": resposta vazia da fonte.");
            return root;
        } catch (FogoCruzadoException failure) {
            throw failure;
        } catch (RuntimeException failure) {
            throw new FogoCruzadoException(CollectionErrorClass.INVALID_RESPONSE, what + ": resposta ilegível da fonte.");
        }
    }

    private HttpResponse<String> send(String method, String path, Map<String, Object> body, String bearer) {
        HttpRequest.Builder builder = HttpRequest.newBuilder(URI.create(base() + path)).timeout(timeout)
                .header("User-Agent", settings.userAgent())
                .header("Accept", "application/json");
        if (bearer != null) builder.header("Authorization", "Bearer " + bearer);
        if (body == null) {
            builder.method(method, HttpRequest.BodyPublishers.noBody());
        } else {
            builder.header("Content-Type", "application/json");
            builder.method(method, HttpRequest.BodyPublishers.ofString(JSON.writeValueAsString(body), StandardCharsets.UTF_8));
        }
        try {
            return http.send(builder.build(), HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
        } catch (IOException failure) {
            throw new FogoCruzadoException(CollectionErrorClass.UPSTREAM_UNAVAILABLE,
                    "Fonte indisponível ao chamar " + path + ".");
        } catch (InterruptedException failure) {
            Thread.currentThread().interrupt();
            throw new FogoCruzadoException(CollectionErrorClass.UPSTREAM_UNAVAILABLE,
                    "Chamada à fonte interrompida em " + path + ".");
        }
    }

    /**
     * Cabeçalhos observados na fonte: {@code X-Last-Update}, {@code X-Last-Update-Timestamp},
     * {@code X-Last-Update-State-Id}, {@code X-Last-Update-State}, {@code X-Last-Update-State-Timestamp}.
     * O primeiro vem com deslocamento explícito ({@code -03:00}) e é normalizado para instante UTC.
     */
    private static UpstreamHeaders headers(HttpResponse<String> response) {
        return new UpstreamHeaders(
                headerInstant(response, "X-Last-Update"),
                headerNumber(response, "X-Last-Update-Timestamp"),
                headerInstant(response, "X-Last-Update-State"),
                response.headers().firstValue("X-Last-Update-State-Id").orElse(null),
                headerNumber(response, "X-Last-Update-State-Timestamp"));
    }

    private static Long headerNumber(HttpResponse<String> response, String header) {
        var value = response.headers().firstValue(header);
        if (value.isEmpty() || value.get().isBlank()) return null;
        try {
            return Long.valueOf(value.get().strip());
        } catch (NumberFormatException failure) {
            return null;
        }
    }

    private static Instant headerInstant(HttpResponse<String> response, String header) {
        var value = response.headers().firstValue(header);
        if (value.isEmpty() || value.get().isBlank()) return null;
        String raw = value.get().strip();
        try {
            return Instant.parse(raw);
        } catch (DateTimeParseException ignored) {
            // segue para deslocamento explícito
        }
        try {
            return java.time.OffsetDateTime.parse(raw).toInstant();
        } catch (DateTimeParseException ignored) {
            return null;
        }
    }

    private String base() {
        String base = settings.sourceBaseUrl();
        return base.endsWith("/") ? base.substring(0, base.length() - 1) : base;
    }

    private static void requireStateId(String stateId) {
        if (stateId == null || stateId.isBlank())
            throw new FogoCruzadoException(CollectionErrorClass.INVALID_RESPONSE,
                    "Estado da fonte não resolvido para o recorte aprovado.");
    }

    private static String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }
}
