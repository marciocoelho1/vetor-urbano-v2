package br.com.vetorurbano.api.accounts;

import com.sun.net.httpserver.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.*;
import tools.jackson.databind.json.JsonMapper;

/** Operator-only synthetic inbox. No persistence, SMTP, CORS or public API route. */
public final class LocalMailbox implements AutoCloseable {
    public record Message(String recipient, String subject, String token, Instant expiresAt, String link) {}
    private final HttpServer server;
    private final Deque<Message> messages = new ArrayDeque<>();
    private final JsonMapper json = JsonMapper.builder().build();
    public LocalMailbox(int port) throws Exception {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", port), 0);
        server.createContext("/", this::handle);
        server.start();
    }
    public int port() { return server.getAddress().getPort(); }
    public synchronized void deliver(String email, String token, Instant expires) {
        if (messages.size() >= 100) messages.removeFirst();
        messages.addLast(new Message(email, "Confirme seu cadastro sintético", token, expires,
            "http://127.0.0.1:4201/?conta=local#confirmar=" + token));
    }
    private synchronized void handle(HttpExchange exchange) throws java.io.IOException {
        var headers = exchange.getResponseHeaders();
        headers.set("Cache-Control", "no-store");
        headers.set("X-Content-Type-Options", "nosniff");
        headers.set("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'; base-uri 'none'");
        String host = exchange.getRequestHeaders().getFirst("Host");
        String origin = exchange.getRequestHeaders().getFirst("Origin");
        boolean allowedHost = ("127.0.0.1:" + port()).equals(host) || ("localhost:" + port()).equals(host);
        boolean allowedOrigin = origin == null || ("http://" + host).equals(origin);
        if (!allowedHost || !allowedOrigin || !exchange.getRequestMethod().equals("GET")) {
            exchange.sendResponseHeaders(403, -1); exchange.close(); return;
        }
        byte[] bytes;
        if (exchange.getRequestURI().getPath().equals("/messages")) {
            headers.set("Content-Type", "application/json; charset=utf-8");
            bytes = json.writeValueAsBytes(List.copyOf(messages));
        } else if (exchange.getRequestURI().getPath().equals("/")) {
            headers.set("Content-Type", "text/html; charset=utf-8");
            var html = new StringBuilder("<!doctype html><html lang=pt-BR><meta charset=utf-8><meta name=referrer content=no-referrer><title>Caixa local sintética</title><h1>Caixa local de teste</h1><p>Somente operador local e identidades .test. Mensagens apenas em memória. Atualize a página para ver novas mensagens.</p>");
            if (messages.isEmpty()) html.append("<p>Nenhuma mensagem recebida.</p>");
            for (var message : messages) html.append("<article><h2>").append(escape(message.recipient()))
                .append("</h2><p>").append(escape(message.subject())).append("</p><a href=\"")
                .append(message.link()).append("\">Abrir confirmação</a><p>Token: <code>")
                .append(message.token()).append("</code></p><p>Expira: ").append(java.time.format.DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss").withZone(java.time.ZoneId.of("America/Sao_Paulo")).format(message.expiresAt())).append(" (horário de Brasília)</p></article>");
            bytes = html.append("</html>").toString().getBytes(StandardCharsets.UTF_8);
        } else { exchange.sendResponseHeaders(404, -1); exchange.close(); return; }
        exchange.sendResponseHeaders(200, bytes.length);
        try (var out = exchange.getResponseBody()) { out.write(bytes); }
        exchange.close();
    }
    private static String escape(String text) { return text.replace("&","&amp;").replace("<","&lt;").replace(">","&gt;").replace("\"","&quot;"); }
    @Override public void close() { server.stop(0); messages.clear(); }
}
