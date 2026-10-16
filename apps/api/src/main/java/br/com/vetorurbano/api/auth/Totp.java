package br.com.vetorurbano.api.auth;

import java.nio.ByteBuffer;
import java.security.*;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

public final class Totp {
    private Totp() {}
    public static String code(byte[] secret, long counter) {
        try {
            var mac=Mac.getInstance("HmacSHA1"); mac.init(new SecretKeySpec(secret,"HmacSHA1"));
            byte[] result=mac.doFinal(ByteBuffer.allocate(8).putLong(counter).array());
            int offset=result[result.length-1]&15;
            int binary=ByteBuffer.wrap(result,offset,4).getInt()&0x7fffffff;
            return String.format(java.util.Locale.ROOT,"%06d",binary%1000000);
        } catch(GeneralSecurityException e) { throw new IllegalStateException("MFA indisponível."); }
    }
    public static String base32(byte[] bytes) {
        var result=new StringBuilder(); int buffer=0,bits=0;
        for(byte b:bytes) { buffer=(buffer<<8)|(b&255); bits+=8;
            while(bits>=5) { bits-=5; result.append("ABCDEFGHIJKLMNOPQRSTUVWXYZ234567".charAt((buffer>>bits)&31)); }
        }
        if(bits>0) result.append("ABCDEFGHIJKLMNOPQRSTUVWXYZ234567".charAt((buffer<<(5-bits))&31));
        return result.toString();
    }
}
