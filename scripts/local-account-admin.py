#!/usr/bin/env python3
"""Bootstrap/reset MFA sintético offline; JSON privado em stdin, sem segredos em argv.

Ferramenta local, sem HTTP: usa o contêiner de desenvolvimento que guarda as contas sintéticas e
um JRE/JDK já instalado. Endereço do banco, usuário e senha vêm do próprio contêiner.

Uso (JSON por stdin):
    printf '{"action":"reset-mfa","email":"admin@vetorurbano.test"}\\n' \
      | scripts/local-account-admin.py --synthetic-local-only

Contêiner e porta podem ser trocados por `VETOR_LOCAL_DB_CONTAINER` e `VETOR_LOCAL_DB_PORT`;
o executável Java, por `JAVA_HOME` (senão usa o `java` do PATH).
"""
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys

if sys.argv[1:] != ['--synthetic-local-only']:
    raise SystemExit('Exige --synthetic-local-only e JSON por stdin.')
root = Path(__file__).resolve().parent.parent
container = os.environ.get('VETOR_LOCAL_DB_CONTAINER', 'vetor-spec-postgis')
info = json.loads(subprocess.check_output(['podman', 'inspect', container]))[0]
settings = dict(item.split('=', 1) for item in info['Config']['Env'] if '=' in item)
port = os.environ.get('VETOR_LOCAL_DB_PORT', '55436')
os.environ['VETOR_DATABASE_URL'] = 'jdbc:postgresql://127.0.0.1:%s/%s' % (
    port, settings.get('POSTGRES_DB', 'postgres'))
os.environ['VETOR_DATABASE_USERNAME'] = settings.get('POSTGRES_USER', 'postgres')
os.environ['VETOR_DATABASE_PASSWORD'] = settings.get('POSTGRES_PASSWORD', '')
java = os.environ.get('JAVA_HOME') and str(Path(os.environ['JAVA_HOME']) / 'bin/java')
java = java or shutil.which('java')
if not java:
    raise SystemExit('Sem executável Java: defina JAVA_HOME ou instale/ative um java no PATH.')
jar = root / 'apps/api/target/vetor-urbano-api-0.1.0-SNAPSHOT.jar'
if not jar.is_file():
    raise SystemExit('Jar ausente em %s: rode scripts/run-local-stack.sh para construí-lo.' % jar)
os.execv(java, [java, '-Dloader.main=br.com.vetorurbano.api.auth.LocalAccountAdmin', '-cp', str(jar),
                'org.springframework.boot.loader.launch.PropertiesLauncher', '--synthetic-local-only'])
