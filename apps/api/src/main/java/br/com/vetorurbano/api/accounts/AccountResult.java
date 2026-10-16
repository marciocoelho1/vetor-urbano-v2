package br.com.vetorurbano.api.accounts;

public record AccountResult(int status, String code, String message) {
    static AccountResult pending() {
        return new AccountResult(202, "CONFIRMATION_PENDING", "Confirmação pendente. Se o cadastro estiver elegível, consulte a mensagem na caixa local. Reenvios respeitam os limites configurados.");
    }
    static AccountResult invalid() { return new AccountResult(400, "INVALID_REQUEST", "Revise os campos permitidos e os valores informados."); }
}
