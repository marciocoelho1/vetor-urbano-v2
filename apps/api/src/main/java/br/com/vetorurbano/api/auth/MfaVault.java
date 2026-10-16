package br.com.vetorurbano.api.auth;

import java.nio.file.*;
import java.nio.file.attribute.PosixFilePermissions;
import java.security.*;
import java.util.*;
import javax.crypto.Cipher;
import javax.crypto.spec.*;

public final class MfaVault {
    private final byte[] key;
    public MfaVault(Path path) throws Exception {
        path=path.toAbsolutePath();
        Files.createDirectories(path.getParent());
        if(!Files.exists(path,LinkOption.NOFOLLOW_LINKS)) {
            byte[] generated=new byte[32]; new SecureRandom().nextBytes(generated);
            try { Files.createFile(path,PosixFilePermissions.asFileAttribute(PosixFilePermissions.fromString("rw-------")));
                Files.write(path,generated); } catch(FileAlreadyExistsException ignored) { }
        }
        if(Files.isSymbolicLink(path)||!Files.getPosixFilePermissions(path).equals(PosixFilePermissions.fromString("rw-------")))
            throw new IllegalStateException("Chave MFA exige arquivo privado 0600.");
        key=Files.readAllBytes(path);
        if(key.length!=32) throw new IllegalStateException("Chave MFA inválida.");
    }
    public String encrypt(byte[] secret, UUID account) {
        byte[] iv=new byte[12]; new SecureRandom().nextBytes(iv);
        byte[] encrypted=crypt(Cipher.ENCRYPT_MODE,secret,iv,account);
        return Base64.getEncoder().encodeToString(iv)+"."+Base64.getEncoder().encodeToString(encrypted);
    }
    public byte[] decrypt(String encrypted,UUID account) {
        String[] parts=encrypted.split("\\.");
        return crypt(Cipher.DECRYPT_MODE,Base64.getDecoder().decode(parts[1]),Base64.getDecoder().decode(parts[0]),account);
    }
    private byte[] crypt(int mode,byte[] input,byte[] iv,UUID account) {
        try {
            var cipher=Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(mode,new SecretKeySpec(key,"AES"),new GCMParameterSpec(128,iv));
            cipher.updateAAD(account.toString().getBytes(java.nio.charset.StandardCharsets.US_ASCII));
            return cipher.doFinal(input);
        } catch(GeneralSecurityException e) { throw new IllegalStateException("MFA indisponível."); }
    }
}
