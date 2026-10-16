package br.com.vetorurbano.api.auth;

import java.nio.file.Path;
import java.time.*;
import org.springframework.context.annotation.*;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.env.Environment;
import org.springframework.jdbc.core.JdbcTemplate;
import br.com.vetorurbano.api.accounts.AccountPassword;

@Configuration
@Profile("local")
@ConditionalOnProperty(name="vetor.accounts.enabled",havingValue="true")
public class AuthConfiguration {
    @Bean AuthSettings authSettings(Environment e) {
        return new AuthSettings(e.getProperty("vetor.auth.inactivity",Duration.class,Duration.ofHours(1)),
            e.getProperty("vetor.auth.lifetime",Duration.class,Duration.ofHours(12)),
            e.getProperty("vetor.auth.partial-lifetime",Duration.class,Duration.ofMinutes(5)),
            e.getProperty("vetor.auth.login-attempts",Integer.class,10),e.getProperty("vetor.auth.mfa-attempts",Integer.class,5),
            e.getProperty("vetor.auth.global-attempts",Integer.class,60),e.getProperty("vetor.auth.secure-cookie",Boolean.class,false));
    }
    @Bean MfaVault mfaVault(Environment e) throws Exception {
        return new MfaVault(Path.of(e.getProperty("vetor.auth.key-file",System.getProperty("user.home")+"/.local/share/vetor-urbano/mfa.key")));
    }
    @Bean AuthService authService(JdbcTemplate jdbc,AccountPassword password,Clock clock,AuthSettings settings,MfaVault vault) {
        return new AuthService(jdbc,password,clock,settings,vault);
    }
}
