package br.com.vetorurbano.api.auth;

import java.time.Duration;
public record AuthSettings(Duration inactivity,Duration lifetime,Duration partialLifetime,int loginAttempts,int mfaAttempts,int globalAttempts,boolean secureCookie) {
    public AuthSettings {
        for(var duration:new Duration[]{inactivity,lifetime,partialLifetime})
            if(duration.compareTo(Duration.ofSeconds(1))<0||duration.compareTo(Duration.ofDays(1))>0) throw new IllegalArgumentException("Prazo local inválido.");
        for(int n:new int[]{loginAttempts,mfaAttempts,globalAttempts}) if(n<1||n>1000) throw new IllegalArgumentException("Limite local inválido.");
    }
}
