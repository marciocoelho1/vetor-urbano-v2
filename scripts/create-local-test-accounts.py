#!/usr/bin/env python3
"""Cria apenas duas fixtures locais autorizadas; não altera a política de cadastro.

Uso: python3 scripts/create-local-test-accounts.py --synthetic-local-only
Requer vetor-spec-postgis iniciado, com migrações V1–V5 aplicadas.
Não redefine contas existentes nem configura/burla MFA.
"""
import base64
import hashlib
import secrets
import subprocess
import sys
import uuid


def main():
    if sys.argv[1:] != ['--synthetic-local-only']:
        raise SystemExit('Exige --synthetic-local-only; somente fixtures locais.')
    statements = ['BEGIN;']
    for name, email, role in [
        ('Administrador de teste', 'admin@vetorurbano.test', 'ADMIN'),
        ('Usuário de teste', 'usuario@vetorurbano.test', 'USER'),
    ]:
        salt = secrets.token_bytes(16)
        key = hashlib.pbkdf2_hmac('sha256', b'123456', salt, 600000, 32)
        encoded = 'pbkdf2-sha256$600000$' + base64.b64encode(salt).decode() + '$' + base64.b64encode(key).decode()
        account = uuid.uuid4()
        # Todos os valores são fixtures fixas ou material aleatório local; sem entrada SQL externa.
        statements.append(f"""
WITH inserted AS (
    INSERT INTO local_accounts
        (id, display_name, email, password_hash, role, status,
         created_at, confirmed_at, last_sent_at, resend_window_start)
    VALUES ('{account}', '{name}', '{email}', '{encoded}', '{role}', 'CONFIRMED',
            now(), now(), now(), now())
    ON CONFLICT (email) DO NOTHING
    RETURNING id
)
INSERT INTO auth_audit_events(account_id, occurred_at, action, outcome)
SELECT id, now(), 'TEST_FIXTURE_BOOTSTRAP', 'CREATED' FROM inserted;
""")
    statements.append('COMMIT;')
    # Credenciais do banco são usadas dentro do contêiner e nunca impressas.
    subprocess.run([
        'podman', 'exec', '-i', 'vetor-spec-postgis', 'sh', '-c',
        'test "$POSTGRES_DB" = vetor_spec_test || exit 2; '
        'exec psql -X -q -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"',
    ], input='\n'.join(statements), text=True, check=True, stdout=subprocess.DEVNULL)
    print('Fixtures locais provisionadas; contas existentes preservadas. Verifique login e papéis via HTTP.')


if __name__ == '__main__':
    main()
