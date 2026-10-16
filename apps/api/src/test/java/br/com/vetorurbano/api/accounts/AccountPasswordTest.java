package br.com.vetorurbano.api.accounts;

import static org.junit.jupiter.api.Assertions.*;
import java.util.Base64;
import org.junit.jupiter.api.Test;

class AccountPasswordTest {
    @Test
    void saltIsUniqueAndDerivedCredentialsVerifyWithoutStoringReusablePassword() {
        var passwords=new AccountPassword(600000);
        String secret="Frase inteiramente sintética 13";
        String first=passwords.derive(secret),second=passwords.derive(secret);
        assertFalse(first.equals(second));
        assertFalse(first.contains(secret));
        var parts=first.split("\\$");
        assertEquals("pbkdf2-sha256",parts[0]); assertEquals("600000",parts[1]);
        assertEquals(16,Base64.getDecoder().decode(parts[2]).length);
        assertEquals(32,Base64.getDecoder().decode(parts[3]).length);
        assertTrue(passwords.matches(secret,first));
        assertFalse(passwords.matches("Outra frase sintética 13",first));
    }
    @Test
    void unicodeAndSpacesAreNotSilentlyTrimmedOrTruncated() {
        var passwords=new AccountPassword(600000);
        String secret="  Senha sintética com espaços 🌳 e Unicode  ";
        String encoded=passwords.derive(secret);
        assertTrue(passwords.matches(secret,encoded));
        assertFalse(passwords.matches(secret.strip(),encoded));
    }
}
