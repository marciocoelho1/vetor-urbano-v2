package br.com.vetorurbano.api.accounts;

import java.security.*;
import java.util.*;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;

public final class AccountPassword {
    private final int iterations;
    private final SecureRandom random = new SecureRandom();
    public AccountPassword(int iterations) { this.iterations = iterations; }

    public static boolean valid(String secret) {
        if(secret==null) return false;
        int length=secret.codePointCount(0,secret.length());
        return length>=15 && length<=128 && !Set.of("passwordpassword", "123456789012345", "senha senha senha", "vetor urbano vetor urbano").contains(secret.toLowerCase(Locale.ROOT));
    }

    public String derive(String password) {
        byte[] salt = new byte[16]; random.nextBytes(salt);
        return "pbkdf2-sha256$" + iterations + "$" + Base64.getEncoder().encodeToString(salt)
            + "$" + Base64.getEncoder().encodeToString(key(password, salt, iterations));
    }
    public boolean matches(String password, String encoded) {
        String[] parts = encoded.split("\\$");
        if (parts.length != 4 || !parts[0].equals("pbkdf2-sha256")) return false;
        try {
            return MessageDigest.isEqual(Base64.getDecoder().decode(parts[3]),
                key(password, Base64.getDecoder().decode(parts[2]), Integer.parseInt(parts[1])));
        } catch (IllegalArgumentException exception) { return false; }
    }
    private byte[] key(String password, byte[] salt, int count) {
        char[] chars = password.toCharArray();
        var spec = new PBEKeySpec(chars, salt, count, 256);
        try { return SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(spec).getEncoded(); }
        catch (GeneralSecurityException exception) { throw new IllegalStateException("Derivação indisponível."); }
        finally { spec.clearPassword(); Arrays.fill(chars, '\0'); }
    }
}
