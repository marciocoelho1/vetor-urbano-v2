package br.com.vetorurbano.api.accounts;

import java.net.InetAddress;
import java.time.*;
import org.springframework.boot.autoconfigure.condition.*;
import org.springframework.context.annotation.*;
import org.springframework.core.env.Environment;
import br.com.vetorurbano.api.auth.AuthService;

@Configuration
@Profile("local")
@ConditionalOnProperty(name = "vetor.accounts.enabled", havingValue = "true")
public class AccountLocalConfiguration {
    @Bean
    AccountSettings accountSettings(Environment env) throws Exception {
        if (!InetAddress.getByName(env.getProperty("server.address", "127.0.0.1")).isLoopbackAddress()) {
            throw new IllegalArgumentException("Contas sintéticas exigem servidor em loopback.");
        }
        return new AccountSettings(env.getProperty("vetor.accounts.token-ttl", Duration.class, Duration.ofMinutes(15)),
            env.getProperty("vetor.accounts.recovery-ttl", Duration.class, Duration.ofMinutes(10)),
            env.getProperty("vetor.accounts.resend-cooldown", Duration.class, Duration.ofSeconds(60)),
            env.getProperty("vetor.accounts.resends-per-hour", Integer.class, 3),
            env.getProperty("vetor.accounts.requests-per-minute", Integer.class, 30),
            env.getProperty("vetor.accounts.sensitive-attempts", Integer.class, 10),
            env.getProperty("vetor.accounts.mailbox-port", Integer.class, 8025),
            env.getProperty("vetor.accounts.password-iterations", Integer.class, 600000));
    }
    @Bean @ConditionalOnMissingBean(Clock.class)
    Clock accountClock() { return Clock.systemUTC(); }
    @Bean(destroyMethod = "close")
    LocalMailbox localMailbox(AccountSettings settings) throws Exception { return new LocalMailbox(settings.mailboxPort()); }
    @Bean
    AccountPassword accountPassword(AccountSettings settings) { return new AccountPassword(settings.passwordIterations()); }
    @Bean
    AccountService accountService(org.springframework.jdbc.core.JdbcTemplate jdbc, AccountSettings settings,
            Clock clock, LocalMailbox mailbox, AccountPassword password, AuthService auth) {
        return new AccountService(jdbc, settings, clock, mailbox, password, auth);
    }
}
