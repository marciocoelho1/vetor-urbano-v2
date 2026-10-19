package br.com.vetorurbano.api.occurrences;

import br.com.vetorurbano.api.auth.AuthService;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

import static org.assertj.core.api.Assertions.assertThat;

class PdfExportServiceContextTest {
    @Test
    void startsWithoutAccountsAuthenticationService() {
        new ApplicationContextRunner()
                .withPropertyValues("vetor.accounts.enabled=false")
                .withBean(NamedParameterJdbcTemplate.class,
                        () -> new NamedParameterJdbcTemplate(new DriverManagerDataSource()))
                .withUserConfiguration(PdfExportService.class)
                .run(context -> {
                    assertThat(context).hasNotFailed();
                    assertThat(context).hasSingleBean(PdfExportService.class);
                    assertThat(context).doesNotHaveBean(AuthService.class);
                });
    }
}
