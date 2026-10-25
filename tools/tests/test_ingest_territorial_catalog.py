"""Trava de destino do script de ingestão territorial: recusa antes de qualquer conexão.

A ingestão escreve direto no PostgreSQL, então o destino é validado antes de abrir conexão: banco
de dados reais (porta 55438 / base `vetor_urbano`), host fora do local e porta não declarada
sintética são recusados. O caso legítimo (55432/55436/55442 e host local) continua liberado, e a
flag `--allow-real-database` é o único caminho consciente para outro destino.
"""
import importlib.util
import io
from contextlib import redirect_stderr, redirect_stdout
import os
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

SOURCE = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location(
    'ingest_territorial_catalog', SOURCE / 'scripts/ingest-territorial-catalog.py'
)
m = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(m)

ENV_KEYS = ('PGPORT', 'PGHOST', 'PGDATABASE', 'PGUSER', 'PGPASSWORD')


class DestinationGuardTests(unittest.TestCase):
    def setUp(self):
        self.saved = {key: os.environ[key] for key in ENV_KEYS if key in os.environ}

        def restore():
            for key in ENV_KEYS:
                os.environ.pop(key, None)
            os.environ.update(self.saved)

        self.addCleanup(restore)
        for key in ENV_KEYS:
            os.environ.pop(key, None)

    def refuse(self, database, env, *fragments):
        with patch.dict(os.environ, env):
            with self.assertRaises(SystemExit) as caught:
                m.assert_synthetic_destination(database, False)
        message = str(caught.exception)
        self.assertIn('RECUSADO', message)
        for fragment in fragments:
            self.assertIn(fragment, message)
        return message

    def test_refuses_real_database_port(self):
        self.refuse('vetor_spec_test', {'PGPORT': '55438'}, '55438')

    def test_refuses_real_database_name(self):
        self.refuse('vetor_urbano', {'PGPORT': '55436'}, 'vetor_urbano')

    def test_refuses_non_local_host(self):
        self.refuse('vetor_spec_test', {'PGPORT': '55436', 'PGHOST': '10.0.0.5'}, '10.0.0.5')

    def test_refuses_undeclared_port(self):
        self.refuse('vetor_spec_test', {'PGPORT': '55439'}, '55439')

    def test_reports_every_problem_at_once(self):
        message = self.refuse(
            'vetor_urbano', {'PGPORT': '55438'}, '55438', 'vetor_urbano'
        )
        self.assertNotIn('10.0.0.5', message)

    def test_allows_synthetic_destinations(self):
        for port in ('55432', '55436', '55442'):
            with self.subTest(port=port), patch.dict(
                os.environ, {'PGPORT': port, 'PGHOST': '127.0.0.1'}
            ):
                self.assertIsNone(m.assert_synthetic_destination('vetor_spec_test', False))

    def test_allows_localhost_host(self):
        with patch.dict(os.environ, {'PGPORT': '55436', 'PGHOST': 'localhost'}):
            self.assertIsNone(m.assert_synthetic_destination('vetor_spec_test', False))

    def test_allow_real_flag_warns_instead_of_refusing(self):
        stderr = io.StringIO()
        with patch.dict(os.environ, {'PGPORT': '55438'}), redirect_stderr(stderr):
            self.assertIsNone(m.assert_synthetic_destination('vetor_spec_test', True))
        self.assertIn('AVISO', stderr.getvalue())
        self.assertIn('55438', stderr.getvalue())

    def test_main_refuses_before_touching_the_network_or_psql(self):
        touched = []

        def record(name):
            def inner(*args, **kwargs):
                touched.append(name)
                raise AssertionError(f'{name} chamado antes da recusa de destino')

            return inner

        destinations = (
            ({'PGPORT': '55438'}, 'vetor_spec_test'),
            ({'PGPORT': '55436'}, 'vetor_urbano'),
            ({'PGPORT': '55436', 'PGHOST': '10.0.0.5'}, 'vetor_spec_test'),
            ({'PGPORT': '55439'}, 'vetor_spec_test'),
        )
        for env, database in destinations:
            with self.subTest(env=env, database=database), patch.dict(os.environ, env), patch.object(
                sys, 'argv', ['ingest-territorial-catalog.py', '--database', database]
            ), patch.object(m, 'fetch', record('fetch')), patch.object(
                m, 'psql_command', record('psql_command')
            ), patch('urllib.request.urlopen', record('urlopen')):
                stdout = io.StringIO()
                with redirect_stdout(stdout):
                    with self.assertRaises(SystemExit) as caught:
                        m.main()
                self.assertIn('RECUSADO', str(caught.exception))
                self.assertEqual(touched, [])
                self.assertEqual(stdout.getvalue(), '')


if __name__ == '__main__':
    unittest.main()
