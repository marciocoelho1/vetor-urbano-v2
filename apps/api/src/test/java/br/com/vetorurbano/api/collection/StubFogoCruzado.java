package br.com.vetorurbano.api.collection;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.io.InputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.atomic.AtomicInteger;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * Provedor externo substituído <b>no limite HTTP</b>: um servidor real que responde a forma observada
 * da API Fogo Cruzado v2 em 19/10/2026. Não é mock de classe interna — o cliente, a autenticação, a
 * renovação, a paginação, os cabeçalhos, a proteção de borda e as classes de erro são exercitados
 * como em produção.
 *
 * <p>Sem dado real: a forma foi copiada e todos os valores são sintéticos.
 */
final class StubFogoCruzado implements AutoCloseable {
    static final JsonMapper JSON = JsonMapper.builder().build();
    static final String STATE_ID = "3f2504e0-4f89-11d3-9a0c-0305e82c3301";
    static final String SP_STATE_ID = "9f1b0e51-0000-4000-8000-000000000002";

    private final HttpServer server;
    private final Map<String, String> credentials;

    final AtomicInteger loginCalls = new AtomicInteger();
    final AtomicInteger refreshCalls = new AtomicInteger();
    final AtomicInteger occurrenceCalls = new AtomicInteger();
    final AtomicInteger citiesCalls = new AtomicInteger();
    final AtomicInteger statesCalls = new AtomicInteger();
    final List<String> lastQueries = Collections.synchronizedList(new ArrayList<>());
    final List<String> userAgents = Collections.synchronizedList(new ArrayList<>());
    final List<String> authorizationHeaders = Collections.synchronizedList(new ArrayList<>());
    final List<Long> occurrenceRequestNanos = Collections.synchronizedList(new ArrayList<>());

    volatile List<String> cityNames = List.of();
    volatile List<JsonNode> occurrences = List.of();
    volatile String lastUpdateHeader = "2026-10-19T11:26:28-03:00";
    volatile String lastUpdateTimestampHeader = "1792409188";
    volatile String lastUpdateStateIdHeader = STATE_ID;
    volatile String lastUpdateStateHeader = "2026-10-19T09:57:12-03:00";
    volatile String lastUpdateStateTimestampHeader = "1792403832";
    /** Status HTTP forçado por página de ocorrências (1-based); ausente = 200. */
    final Map<Integer, Integer> pageStatuses = new ConcurrentHashMap<>();
    /** Recusa o primeiro pedido autorizado uma única vez, para exercer a renovação. */
    volatile boolean rejectFirstAuthorisedRequest;
    /** Segura a resposta desta página até {@link #releasePage}. */
    volatile int holdPage = -1;
    volatile CountDownLatch holdLatch;
    /** Credenciais inválidas: login sempre 401. */
    volatile boolean rejectLogin;
    /** Renovação sempre recusada, para exercer AUTH_FAILED. */
    volatile boolean rejectRefresh;
    /** Resposta sem pageMeta/data, para exercer INVALID_RESPONSE. */
    volatile boolean malformedOccurrences;

    private final AtomicInteger tokens = new AtomicInteger();
    private final Set<String> rejected = ConcurrentHashMap.newKeySet();
    private volatile boolean rejectedOnce;

    StubFogoCruzado(String email, String password) throws IOException {
        this.credentials = Map.of("email", email, "password", password);
        this.server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        this.server.createContext("/api/v2/auth/login", exchange -> handle(exchange, this::login));
        this.server.createContext("/api/v2/auth/refresh", exchange -> handle(exchange, this::refresh));
        this.server.createContext("/api/v2/states", exchange -> handle(exchange, this::states));
        this.server.createContext("/api/v2/cities", exchange -> handle(exchange, this::cities));
        this.server.createContext("/api/v2/occurrences", exchange -> handle(exchange, this::occurrences));
        this.server.setExecutor(java.util.concurrent.Executors.newFixedThreadPool(4, task -> {
            Thread thread = new Thread(task);
            thread.setDaemon(true);
            return thread;
        }));
        this.server.start();
    }

    String baseUrl() { return "http://127.0.0.1:" + server.getAddress().getPort() + "/api/v2"; }

    void releasePage() {
        CountDownLatch latch = holdLatch;
        if (latch != null) latch.countDown();
    }

    /**
     * Ocorrência sintética na forma observada: {@code city}/{@code neighborhood}/{@code mainReason}
     * como objetos, {@code documentNumber} numérico, coordenadas em texto, {@code relatedRecord} vazio
     * e atributos pessoais por vítima (que a minimização precisa descartar).
     */
    static JsonNode occurrence(long documentNumber, String city, String neighborhood, String date,
            boolean policeAction, boolean massacre, List<String> situations, List<String> personTypes) {
        StringBuilder victims = new StringBuilder();
        for (int index = 0; index < situations.size(); index++) {
            if (index > 0) victims.append(',');
            victims.append("""
                    {"id":"victim-%d","type":"People","situation":"%s","personType":"%s",
                     "age":27,"ageGroup":{"name":"Adulto"},"genre":{"name":"Masculino"},"race":"sintética",
                     "serviceStatus":{"name":"Não se aplica"},"coorporation":{"name":"corporação sintética"},
                     "unit":"unidade sintética","partie":"partido sintético","deathDate":"%s"}
                    """.formatted(index, situations.get(index), personTypes.get(index), date));
        }
        return JSON.readTree("""
                {
                  "id": "occ-%d",
                  "documentNumber": %d,
                  "address": "logradouro sintético 100",
                  "state": {"id": "%s", "name": "Rio de Janeiro"},
                  "region": {"id": "region-1", "region": "Metropolitana", "state": "Rio de Janeiro"},
                  "city": {"id": "city-x", "name": "%s"},
                  "neighborhood": {"id": "nbh-1", "name": "%s"},
                  "subNeighborhood": null,
                  "locality": null,
                  "latitude": "-22.9000000",
                  "longitude": "-43.3000000",
                  "date": "%s",
                  "policeAction": %s,
                  "agentPresence": false,
                  "relatedRecord": "",
                  "contextInfo": {"mainReason": {"id": "reason-1", "name": "Operação policial"},
                                  "complementaryReasons": [], "clippings": [], "massacre": %s,
                                  "policeUnit": "unidade sintética"},
                  "transports": [{"id": "tr-1", "transport": "Bus", "interruptedTransport": true}],
                  "victims": [%s],
                  "animalVictims": []
                }
                """.formatted(documentNumber, documentNumber, STATE_ID, city, neighborhood, date,
                policeAction, massacre, victims));
    }

    private interface Handler { void handle(HttpExchange exchange) throws IOException; }

    private void handle(HttpExchange exchange, Handler handler) throws IOException {
        try {
            handler.handle(exchange);
        } catch (RuntimeException failure) {
            respond(exchange, 500, "{\"msg\":\"stub failure\",\"msgCode\":\"stub_error\",\"code\":500}");
        } finally {
            exchange.close();
        }
    }

    private boolean edgeProtectionAllows(HttpExchange exchange) throws IOException {
        String userAgent = exchange.getRequestHeaders().getFirst("User-Agent");
        userAgents.add(String.valueOf(userAgent));
        if (blocked(userAgent)) {
            respond(exchange, 403, "error code: 1010");
            return false;
        }
        return true;
    }

    /** A proteção de borda bloqueia clientes programáticos sem identificação própria. */
    private static boolean blocked(String userAgent) {
        if (userAgent == null || userAgent.isBlank()) return true;
        String normalized = userAgent.toLowerCase(Locale.ROOT);
        return normalized.contains("java-http-client") || normalized.contains("python")
                || normalized.contains("urllib") || normalized.contains("curl") || normalized.equals("okhttp");
    }

    private void login(HttpExchange exchange) throws IOException {
        loginCalls.incrementAndGet();
        if (!edgeProtectionAllows(exchange)) return;
        if (!"POST".equals(exchange.getRequestMethod())) {
            respond(exchange, 404, "Cannot GET /auth/login");
            return;
        }
        if (rejectLogin) {
            respond(exchange, 401, "{\"msg\":\"Unauthorized access. Incorrect credentials.\",\"msgCode\":\"user_unauthorized\",\"code\":401}");
            return;
        }
        JsonNode body = JSON.readTree(read(exchange));
        if (!credentials.get("email").equals(body.path("email").asString())
                || !credentials.get("password").equals(body.path("password").asString())) {
            respond(exchange, 401, "{\"msg\":\"Unauthorized access. Incorrect credentials.\",\"msgCode\":\"user_unauthorized\",\"code\":401}");
            return;
        }
        respond(exchange, 201, "{\"msg\":\"ok\",\"msgCode\":\"success\",\"code\":201,\"data\":{\"accessToken\":\"stub-token-"
                + tokens.incrementAndGet() + "\",\"expiresIn\":3600}}");
    }

    private void refresh(HttpExchange exchange) throws IOException {
        refreshCalls.incrementAndGet();
        if (!edgeProtectionAllows(exchange)) return;
        String header = exchange.getRequestHeaders().getFirst("Authorization");
        authorizationHeaders.add(String.valueOf(header));
        String current = header == null ? "" : header.replace("Bearer ", "");
        if (rejectRefresh || rejected.contains(current) || !current.startsWith("stub-token-")) {
            respond(exchange, 401, "{\"msg\":\"Unauthorized access. Incorrect credentials.\",\"msgCode\":\"user_unauthorized\",\"code\":401}");
            return;
        }
        respond(exchange, 201, "{\"msg\":\"ok\",\"msgCode\":\"success\",\"code\":201,\"data\":{\"accessToken\":\"stub-token-"
                + tokens.incrementAndGet() + "\",\"expiresIn\":3600}}");
    }

    private void states(HttpExchange exchange) throws IOException {
        statesCalls.incrementAndGet();
        if (!edgeProtectionAllows(exchange)) return;
        if (!authorised(exchange)) return;
        respond(exchange, 200, "{\"msg\":\"ok\",\"code\":200,\"data\":[{\"id\":\"" + STATE_ID + "\",\"name\":\"Rio de Janeiro\"},"
                + "{\"id\":\"" + SP_STATE_ID + "\",\"name\":\"São Paulo\"}]}");
    }

    private void cities(HttpExchange exchange) throws IOException {
        citiesCalls.incrementAndGet();
        if (!edgeProtectionAllows(exchange)) return;
        if (!authorised(exchange)) return;
        String query = exchange.getRequestURI().getQuery();
        if (query == null || !query.contains("stateId=" + STATE_ID)) {
            respond(exchange, 400, "{\"msg\":\"stateId ausente\",\"msgCode\":\"invalid_state\",\"code\":400}");
            return;
        }
        StringBuilder data = new StringBuilder();
        int index = 0;
        for (String name : cityNames) {
            if (index++ > 0) data.append(',');
            data.append("{\"id\":\"city-").append(String.format("%03d", index)).append("\",\"name\":\"")
                    .append(name.toUpperCase(Locale.ROOT)).append("\",\"state\":{\"id\":\"").append(STATE_ID)
                    .append("\",\"name\":\"Rio de Janeiro\"}}");
        }
        respond(exchange, 200, "{\"msg\":\"ok\",\"code\":200,\"data\":[" + data + "]}");
    }

    private void occurrences(HttpExchange exchange) throws IOException {
        occurrenceRequestNanos.add(System.nanoTime());
        occurrenceCalls.incrementAndGet();
        if (!edgeProtectionAllows(exchange)) return;
        String query = exchange.getRequestURI().getQuery();
        lastQueries.add(String.valueOf(query));
        if (!authorised(exchange)) return;
        Map<String, List<String>> parameters = parse(query);
        int page = Integer.parseInt(first(parameters, "page", "1"));
        int take = Integer.parseInt(first(parameters, "take", "100"));
        if (holdPage == page && holdLatch != null) {
            try {
                holdLatch.await();
            } catch (InterruptedException failure) {
                Thread.currentThread().interrupt();
            }
        }
        Integer forced = pageStatuses.get(page);
        if (forced != null) {
            respond(exchange, forced, "{\"msg\":\"falha forçada\",\"msgCode\":\"forced\",\"code\":" + forced + "}");
            return;
        }
        if (malformedOccurrences) {
            respond(exchange, 200, "{\"msg\":\"ok\",\"code\":200}");
            return;
        }
        List<JsonNode> items = occurrences;
        int fromIndex = Math.min((page - 1) * take, items.size());
        int toIndex = Math.min(fromIndex + take, items.size());
        List<JsonNode> slice = items.subList(fromIndex, toIndex);
        boolean hasNext = toIndex < items.size();
        StringBuilder data = new StringBuilder();
        for (int index = 0; index < slice.size(); index++) {
            if (index > 0) data.append(',');
            data.append(slice.get(index).toString());
        }
        int pageCount = take <= 0 ? 1 : (int) Math.ceil(items.size() / (double) take);
        String body = "{\"msg\":\"ok\",\"msgCode\":\"success\",\"code\":200,\"pageMeta\":{\"page\":" + page
                + ",\"take\":" + take + ",\"itemCount\":" + items.size() + ",\"pageCount\":" + pageCount
                + ",\"hasPreviousPage\":" + (page > 1) + ",\"hasNextPage\":" + hasNext + "},\"data\":[" + data + "]}";
        respondWithHeaders(exchange, 200, body);
    }

    private boolean authorised(HttpExchange exchange) throws IOException {
        String header = exchange.getRequestHeaders().getFirst("Authorization");
        authorizationHeaders.add(String.valueOf(header));
        String token = header == null ? "" : header.replace("Bearer ", "");
        if (rejectFirstAuthorisedRequest && !rejectedOnce) {
            rejectedOnce = true;
            respond(exchange, 401, "{\"msg\":\"Unauthorized access. Incorrect credentials.\",\"msgCode\":\"user_unauthorized\",\"code\":401}");
            return false;
        }
        if (token.isBlank() || rejected.contains(token)) {
            respond(exchange, 401, "{\"msg\":\"Unauthorized access. Incorrect credentials.\",\"msgCode\":\"user_unauthorized\",\"code\":401}");
            return false;
        }
        return true;
    }

    private void respondWithHeaders(HttpExchange exchange, int status, String body) throws IOException {
        if (lastUpdateHeader != null) exchange.getResponseHeaders().add("X-Last-Update", lastUpdateHeader);
        if (lastUpdateTimestampHeader != null) exchange.getResponseHeaders().add("X-Last-Update-Timestamp", lastUpdateTimestampHeader);
        if (lastUpdateStateIdHeader != null) exchange.getResponseHeaders().add("X-Last-Update-State-Id", lastUpdateStateIdHeader);
        if (lastUpdateStateHeader != null) exchange.getResponseHeaders().add("X-Last-Update-State", lastUpdateStateHeader);
        if (lastUpdateStateTimestampHeader != null) exchange.getResponseHeaders().add("X-Last-Update-State-Timestamp", lastUpdateStateTimestampHeader);
        respond(exchange, status, body);
    }

    private static void respond(HttpExchange exchange, int status, String body) throws IOException {
        byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().add("Content-Type", "application/json; charset=utf-8");
        exchange.sendResponseHeaders(status, bytes.length);
        exchange.getResponseBody().write(bytes);
    }

    private static String read(HttpExchange exchange) throws IOException {
        try (InputStream input = exchange.getRequestBody()) {
            return new String(input.readAllBytes(), StandardCharsets.UTF_8);
        }
    }

    private static Map<String, List<String>> parse(String query) {
        Map<String, List<String>> parameters = new LinkedHashMap<>();
        if (query == null) return parameters;
        for (String pair : query.split("&")) {
            int separator = pair.indexOf('=');
            if (separator < 0) continue;
            parameters.computeIfAbsent(java.net.URLDecoder.decode(pair.substring(0, separator), StandardCharsets.UTF_8),
                    key -> new ArrayList<>()).add(java.net.URLDecoder.decode(pair.substring(separator + 1), StandardCharsets.UTF_8));
        }
        return parameters;
    }

    private static String first(Map<String, List<String>> parameters, String key, String fallback) {
        List<String> values = parameters.get(key);
        return values == null || values.isEmpty() ? fallback : values.getFirst();
    }

    @Override public void close() { server.stop(0); }
}
