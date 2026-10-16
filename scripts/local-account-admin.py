#!/usr/bin/env python3
"""Bootstrap/reset MFA sintético offline; JSON privado em stdin, sem segredos em argv.
Requer acesso local ao contêiner de desenvolvimento e JDK 21. Não usa HTTP.
"""
import json
import os
from pathlib import Path
import subprocess
import sys

if sys.argv[1:] != ['--synthetic-local-only']:
    raise SystemExit('Exige --synthetic-local-only e JSON por stdin.')
root = Path(__file__).resolve().parent.parent
container = os.environ.get('VETOR_LOCAL_DB_CONTAINER', 'vetor-api-ticket12-db')
info = json.loads(subprocess.check_output(['podman', 'inspect', container]))[0]
settings = dict(item.split('=', 1) for item in info['Config']['Env'] if '=' in item)
os.environ['VETOR_DATABASE_URL'] = 'jdbc:postgresql://127.0.0.1:55432/' + settings.get('POSTGRES_DB', 'postgres')
os.environ['VETOR_DATABASE_USERNAME'] = settings.get('POSTGRES_USER', 'postgres')
os.environ['VETOR_DATABASE_PASSWORD'] = settings.get('POSTGRES_PASSWORD', '')
java = str(Path(os.environ.get('JAVA_HOME', '/tmp/vu-jdk-21')) / 'bin/java')
jar = root / 'apps/api/target/vetor-urbano-api-0.1.0-SNAPSHOT.jar'
os.execv(java, [java, '-Dloader.main=br.com.vetorurbano.api.auth.LocalAccountAdmin', '-cp', str(jar),
                    'org.springframework.boot.loader.launch.PropertiesLauncher', '--synthetic-local-only'])
