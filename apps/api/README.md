# API Java

Este diretório reserva o espaço da futura API do Vetor Urbano. Ainda não há aplicação Spring Boot, Maven Wrapper, endpoints ou testes.

O SQL não aplicado foi movido para [docs/archive/database/initial-schema-v1.sql](../../docs/archive/database/initial-schema-v1.sql). Ele é uma referência histórica, com diferenças de categorias e estados que precisam de reconciliação antes da criação de migrações reais.

A implementação prevista usa Java e PostgreSQL/PostGIS. Contratos, versões e regras de acesso serão definidos na etapa de backend descrita no [plano](../../PLAN.md) e na [arquitetura](../../docs/architecture/overview.md).
