package br.com.vetorurbano.api.auth;

import static org.junit.jupiter.api.Assertions.*;
import org.junit.jupiter.api.Test;

class TotpTest {
    @Test void rfc6238Sha1VectorReducedToSixDigits() {
        // RFC 6238 appendix B: 94287082 at Unix second 59, SHA1, 20-byte ASCII key.
        assertEquals("287082", Totp.code("12345678901234567890".getBytes(java.nio.charset.StandardCharsets.US_ASCII),1));
        assertEquals("081804", Totp.code("12345678901234567890".getBytes(java.nio.charset.StandardCharsets.US_ASCII),37037036));
    }
}
