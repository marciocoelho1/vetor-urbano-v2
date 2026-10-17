package br.com.vetorurbano.api.accounts;

public record AccountResult(int status, String code, String message) {
    static AccountResult pending() {
        return new AccountResult(202, "CONFIRMATION_PENDING", "Confirmação pendente. Se o cadastro estiver elegível, consulte a mensagem na caixa local. Reenvios respeitam os limites configurados.");
    }
    static AccountResult invalid() { return new AccountResult(400, "INVALID_REQUEST", "Revise os campos permitidos e os valores informados."); }
    /** Resposta indistinguível para conta confirmada, pendente, inexistente ou suprimida por limite. */
    static AccountResult recoveryPending() {
        return new AccountResult(202, "RECOVERY_PENDING", "Se houver uma conta confirmada para este e-mail, o link de recuperação chegará na caixa local. Ele vale dez minutos e serve uma única vez.");
    }
}
