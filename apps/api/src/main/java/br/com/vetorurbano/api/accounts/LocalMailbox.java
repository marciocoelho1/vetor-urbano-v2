package br.com.vetorurbano.api.accounts;

import com.sun.net.httpserver.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.*;
import tools.jackson.databind.json.JsonMapper;

/** Operator-only synthetic inbox. No persistence, SMTP, CORS or public API route. */
public final class LocalMailbox implements AutoCloseable {
    /**
     * Mensagem sintética. `kind` distingue confirmação de cadastro, link de recuperação e avisos de
     * segurança (E14); avisos não carregam token, link nem prazo. `body` é orientação sem credenciais.
     */
    public record Message(String kind, String recipient, String subject, String token, Instant expiresAt,
            String link, String body) {}
    private final HttpServer server;
    private final Deque<Message> messages = new ArrayDeque<>();
    private final JsonMapper json = JsonMapper.builder().build();
    public LocalMailbox(int port) throws Exception {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", port), 0);
        server.createContext("/", this::handle);
        server.start();
    }
    public int port() { return server.getAddress().getPort(); }
    public synchronized void deliverConfirmation(String email, String token, Instant expires) {
        add(new Message("CONFIRMATION", email, "Confirme seu cadastro sintético", token, expires,
            "http://127.0.0.1:4201/?conta=local#confirmar=" + token,
            "Confirme o cadastro para entrar nos módulos. Link de uso único."));
    }
    /** E01/E15: link de recuperação de uso único, dez minutos, substituído a cada reenvio efetivo. */
    public synchronized void deliverRecovery(String email, String token, Instant expires) {
        add(new Message("RECOVERY", email, "Redefina sua senha sintética", token, expires,
            "http://127.0.0.1:4201/?conta=local#recuperar=" + token,
            "Use o link para definir uma nova senha. Ele vale dez minutos, serve uma única vez e "
            + "substitui qualquer link anterior. Se não foi você, ignore a mensagem."));
    }
    /** E14: aviso transacional sem token, sem código e sem senha. */
    public synchronized void deliverNotice(String email, String kind, String subject, String body) {
        add(new Message(kind, email, subject, null, null, null, body));
    }
    private void add(Message message) {
        if (messages.size() >= 100) messages.removeFirst();
        messages.addLast(message);
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
            for (var message : messages) {
                html.append("<article><h2>").append(escape(message.recipient())).append("</h2><p><strong>")
                    .append(escape(message.kind())).append("</strong>: ").append(escape(message.subject())).append("</p>");
                if (message.body() != null) html.append("<p>").append(escape(message.body())).append("</p>");
                if (message.token() != null) html.append("<p>Token: <code>").append(message.token()).append("</code></p>");
                if (message.link() != null) html.append("<a href=\"").append(message.link()).append("\">")
                    .append(switch (message.kind()) { case "CONFIRMATION" -> "Abrir confirmação"; case "RECOVERY" -> "Abrir link de recuperação"; default -> "Abrir"; })
                    .append("</a>");
                if (message.expiresAt() != null) html.append("<p>Expira: ")
                    .append(java.time.format.DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss").withZone(java.time.ZoneId.of("America/Sao_Paulo")).format(message.expiresAt()))
                    .append(" (horário de Brasília)</p>");
                html.append("</article>");
            }
            bytes = html.append("</html>").toString().getBytes(StandardCharsets.UTF_8);
        } else { exchange.sendResponseHeaders(404, -1); exchange.close(); return; }
        exchange.sendResponseHeaders(200, bytes.length);
        try (var out = exchange.getResponseBody()) { out.write(bytes); }
        exchange.close();
    }
    private static String escape(String text) { return text.replace("&","&amp;").replace("<","&lt;").replace(">","&gt;").replace("\"","&quot;"); }
    @Override public void close() { server.stop(0); messages.clear(); }
}
