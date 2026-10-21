package br.com.vetorurbano.api.collection;

import static org.junit.jupiter.api.Assertions.*;

import java.net.http.HttpClient;
import java.nio.file.Path;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/**
 * Unidade do cliente HTTP contra um provedor real na fronteira HTTP (o mesmo {@link StubFogoCruzado}
 * usado nas integrações). Cobre autenticação, renovação, paginação, cabeçalhos, proteção de borda e
 * as classes de erro.
 */
class FogoCruzadoClientTest {
    private static final String EMAIL = "conta@example.test";
    private static final String PASSWORD = "segredo sintético de teste";
    private static final Clock CLOCK = Clock.fixed(Instant.parse("2026-10-19T15:00:00Z"), ZoneOffset.UTC);

    private StubFogoCruzado stub;
    private FogoCruzadoClient client;

    @BeforeEach
    void setUp() throws Exception {
        stub = new StubFogoCruzado(EMAIL, PASSWORD);
        client = new FogoCruzadoClient(HttpClient.newHttpClient(), settings(), CollectionCredentials.of(EMAIL, PASSWORD), CLOCK);
    }

    @AfterEach
    void tearDown() { stub.close(); }

    private CollectionSettings settings() {
        return new CollectionSettings(true, stub.baseUrl(), "fogo-cruzado", null, 60,
                LocalDate.parse("2026-06-01"), 100, 20, CollectionSettings.DEFAULT_USER_AGENT);
    }

    @Test
    void logsInOnceAndUsesBearerTokenForReads() {
        stub.cityNames = List.of("Rio de Janeiro", "Niterói");

        var states = client.states();
        var cities = client.cities(StubFogoCruzado.STATE_ID);

        assertEquals(1, stub.loginCalls.get());
        assertEquals(1, stub.statesCalls.get());
        assertEquals(1, stub.citiesCalls.get());
        assertEquals("Rio de Janeiro", states.getFirst().name());
        assertEquals(2, cities.size());
        assertEquals("RIO DE JANEIRO", cities.getFirst().name());
        assertTrue(stub.authorizationHeaders.stream().anyMatch(header -> header.startsWith("Bearer stub-token-")));
    }

    @Test
    void identifiesItselfWithAnExplicitUserAgent() {
        client.states();

        assertFalse(stub.userAgents.isEmpty());
        assertTrue(stub.userAgents.stream().allMatch(agent -> agent.contains("VetorUrbanoLocalCollector")));
    }

    @Test
    void anonymousProgrammaticClientIsBlockedByEdgeProtectionAsItsOwnClass() {
        var anonymous = new FogoCruzadoClient(HttpClient.newHttpClient(),
                new CollectionSettings(true, stub.baseUrl(), "fogo-cruzado", null, 60,
                        LocalDate.parse("2026-06-01"), 100, 20, "Java-http-client/21"),
                CollectionCredentials.of(EMAIL, PASSWORD), CLOCK);

        var failure = assertThrows(FogoCruzadoException.class, anonymous::login);

        assertEquals(CollectionErrorClass.UPSTREAM_BLOCKED, failure.errorClass());
        assertNotEquals(CollectionErrorClass.AUTH_FAILED, failure.errorClass());
        assertNotEquals(CollectionErrorClass.RATE_LIMITED, failure.errorClass());
        assertFalse(failure.getMessage().contains(PASSWORD));
    }

    @Test
    void renewsTokenOnceOnUnauthorisedAndRetriesTheRequest() {
        stub.rejectFirstAuthorisedRequest = true;

        var states = client.states();

        assertEquals(1, stub.refreshCalls.get());
        assertEquals("Rio de Janeiro", states.getFirst().name());
    }

    @Test
    void occurrenceAuthRetryRespectsTheMinimumRequestInterval() {
        stub.rejectFirstAuthorisedRequest = true;

        client.occurrences("2026-06-01", "2026-10-19", StubFogoCruzado.STATE_ID,
                List.of("city-001"), 1, 100);

        List<Long> requestTimes = List.copyOf(stub.occurrenceRequestNanos);
        assertEquals(2, requestTimes.size());
        long intervalNanos = requestTimes.get(1) - requestTimes.get(0);
        assertTrue(intervalNanos >= Duration.ofSeconds(1).toNanos(),
                "intervalo observado: " + Duration.ofNanos(intervalNanos).toMillis() + " ms");
    }

    @Test
    void failedRenewalEndsAsAuthFailedAndNeverAsEmptyResult() {
        stub.rejectRefresh = true;
        stub.rejectFirstAuthorisedRequest = true;

        var failure = assertThrows(FogoCruzadoException.class, () -> client.states());
        assertEquals(CollectionErrorClass.AUTH_FAILED, failure.errorClass());
    }

    @Test
    void rejectedCredentialsEndAsAuthFailedWithoutLeakingTheSecret() {
        stub.rejectLogin = true;

        var failure = assertThrows(FogoCruzadoException.class, () -> client.login());
        assertEquals(CollectionErrorClass.AUTH_FAILED, failure.errorClass());
        assertFalse(failure.getMessage().contains(PASSWORD));
    }

    @Test
    void paginatesWithOrderAscRepeatedCitiesAndDateWindow() {
        var page = client.occurrences("2026-06-01", "2026-10-19", StubFogoCruzado.STATE_ID,
                List.of("city-001", "city-002"), 2, 25);

        String query = stub.lastQueries.getLast();
        assertTrue(query.contains("initialdate=2026-06-01"), query);
        assertTrue(query.contains("finaldate=2026-10-19"), query);
        assertTrue(query.contains("order=ASC"), query);
        // Recorte aprovado sem filtro por tipo: `withVictim` descartaria 428 das 807 ocorrências medidas.
        assertFalse(query.contains("typeOccurrence"), query);
        assertTrue(query.contains("page=2"), query);
        assertTrue(query.contains("take=25"), query);
        assertTrue(query.contains("idCities=city-001&idCities=city-002"), query);
        assertEquals(2, page.page());
        assertEquals(25, page.take());
        assertFalse(page.hasNextPage());
    }

    @Test
    void readsUpstreamUpdateHeadersAsInstantsAndCounters() {
        stub.occurrences = List.of();

        var page = client.occurrences("2026-06-01", "2026-10-19", StubFogoCruzado.STATE_ID, List.of("city-001"), 1, 100);

        assertEquals(Instant.parse("2026-10-19T14:26:28Z"), page.headers().lastUpdate());
        assertEquals(1792409188L, page.headers().lastUpdateTimestamp());
        assertEquals(StubFogoCruzado.STATE_ID, page.headers().lastUpdateStateId());
        assertEquals(Instant.parse("2026-10-19T12:57:12Z"), page.headers().lastUpdateState());
        assertEquals(1792403832L, page.headers().lastUpdateStateTimestamp());
        assertEquals("success", page.msgCode());
    }

    @Test
    void rateLimitAndServerErrorsKeepTheirDistinctClasses() {
        stub.pageStatuses.put(1, 429);
        var limited = assertThrows(FogoCruzadoException.class, () -> client.occurrences("2026-06-01", "2026-10-19",
                StubFogoCruzado.STATE_ID, List.of("city-001"), 1, 100));
        assertEquals(CollectionErrorClass.RATE_LIMITED, limited.errorClass());

        stub.pageStatuses.put(1, 503);
        var unavailable = assertThrows(FogoCruzadoException.class, () -> client.occurrences("2026-06-01", "2026-10-19",
                StubFogoCruzado.STATE_ID, List.of("city-001"), 1, 100));
        assertEquals(CollectionErrorClass.UPSTREAM_UNAVAILABLE, unavailable.errorClass());
    }

    @Test
    void malformedPageIsInvalidResponseAndNotAnEmptyResult() {
        stub.malformedOccurrences = true;

        var failure = assertThrows(FogoCruzadoException.class, () -> client.occurrences("2026-06-01", "2026-10-19",
                StubFogoCruzado.STATE_ID, List.of("city-001"), 1, 100));
        assertEquals(CollectionErrorClass.INVALID_RESPONSE, failure.errorClass());
    }

    @Test
    void unreachableSourceIsUpstreamUnavailable() {
        var offline = new FogoCruzadoClient(HttpClient.newHttpClient(),
                new CollectionSettings(true, "http://127.0.0.1:1/api/v2", "fogo-cruzado", Path.of("/inexistente"),
                        60, LocalDate.parse("2026-06-01"), 100, 20, CollectionSettings.DEFAULT_USER_AGENT),
                CollectionCredentials.of(EMAIL, PASSWORD), Clock.systemUTC());
        var failure = assertThrows(FogoCruzadoException.class, offline::login);
        assertEquals(CollectionErrorClass.UPSTREAM_UNAVAILABLE, failure.errorClass());
    }
}
