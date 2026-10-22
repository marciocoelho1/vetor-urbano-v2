"""Control-flow regressions using temporary Git repos and a fake Codex executable."""
import copy
from contextlib import redirect_stdout, redirect_stderr
import io
import fcntl
import importlib.util
import json
import os
from pathlib import Path
import shutil
import signal
import subprocess
import sys
import tempfile
import time
import unittest
from unittest.mock import patch

SOURCE = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location('ticketctl', SOURCE / 'ticketctl.py')
m = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(m)


class ControllerTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='vetor-controller-')
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.path = self.root / '.scratch/state.json'
        self.logs = self.root / '.scratch/logs'
        self.logs.mkdir(parents=True)
        shutil.copytree(SOURCE / 'prompts', self.root / 'tools/prompts')
        shutil.copy2(SOURCE / 'ticketctl-result.schema.json', self.root / 'tools/ticketctl-result.schema.json')
        (self.root / '.gitignore').write_text('.scratch/\n')
        (self.root / 'existing.txt').write_text('preserve\n')
        self.git('init', '-q')
        self.git('config', 'user.name', 'Fixture')
        self.git('config', 'user.email', 'fixture@example.invalid')
        self.git('add', '.')
        self.git('commit', '-qm', 'baseline')
        self.config = json.loads((SOURCE / 'ticketctl.json').read_text())
        self.config.update(queue=['12', '13'], mandatory_phases=[], dependencies={'13': ['12']}, ticket_stages={})
        self.config['adapters']['codex']['binary'] = str(SOURCE / 'tests/fake_codex.py')
        self.config['ticket_checks'] = {t: [[sys.executable, '-c', 'print("check passed")']] for t in ['12', '13']}
        self.patch = patch.multiple(m, ROOT=self.root, STATE=self.path)
        self.patch.start()
        self.addCleanup(self.patch.stop)
        self.control('happy')
        self.state = m.defaults(self.config)
        self.state.update(version=2, mode='real', phase_completed={})
        self.ctl = m.Controller(self.config, self.state, self.path, self.logs)

    def git(self, *args):
        return subprocess.check_output(['git', *args], cwd=self.root, text=True).strip()

    def control(self, scenario):
        m.save(self.root / '.scratch/fake-control.json', {'scenario': scenario, 'calls': []})

    def calls(self):
        return m.load(self.root / '.scratch/fake-control.json', {})['calls']

    def reload(self):
        self.state = m.load(self.path, {})
        self.ctl = m.Controller(self.config, self.state, self.path, self.logs)

    def test_two_tasks_review_correction_commit(self):
        self.control('correction')
        self.assertEqual(self.ctl.auto(), 0)
        self.assertEqual([c['phase'] for c in self.calls()], ['implement','review','correction','review','implement','review'])
        self.assertEqual(self.state['tickets']['12']['correction_rounds'], 1)
        self.assertTrue(all(self.ctl.accepted(t) for t in ['12','13']))
        self.assertEqual(self.git('rev-list','--count','HEAD'), '3')
        argv = self.calls()[0]['args']
        self.assertIn('service_tier="default"', argv)
        self.assertIn('features.multi_agent=false', argv)
        self.assertFalse(any(arg.startswith('model_providers.') for arg in argv))
        self.assertIn('gpt-6.1-sol', argv)

    def test_config_rejection_is_visible_and_checkpoint_is_resumable(self):
        self.control('config-rejected')
        output=io.StringIO()
        with redirect_stdout(output), redirect_stderr(output):
            self.assertEqual(self.ctl.auto(),3)
        text=output.getvalue()
        for fragment in ['12','implement','gpt-6.1-sol','medium','config_rejected','código de saída=1','Error loading config.toml','reserved built-in provider IDs']:
            self.assertIn(fragment,text)
        rec=self.state['tickets']['12']
        self.assertIn(rec['implement_log'],text)
        self.assertIn('Built-in providers cannot be overridden',Path(rec['implement_log']).read_text())
        self.assertEqual(rec['returncode'],1)
        self.assertEqual(self.state['active']['phase'],'implement')
        self.assertFalse(self.ctl.accepted('12'))
        self.assertEqual(len(self.calls()),1)
        self.assertFalse((self.root/'ticket-12.txt').exists())
        run_id=rec['run_id']
        self.control('happy'); self.reload()
        self.assertEqual(self.ctl.auto(),0)
        self.assertEqual(self.state['tickets']['12']['run_id'],run_id)

    def test_multiline_bootstrap_error_keeps_relevant_cause(self):
        log=self.logs/'bootstrap.log'
        log.write_text('Error: failed to load bootstrap configuration\n\nCaused by:\n    model_providers contains reserved built-in provider IDs: `openai`. Built-in providers cannot be overridden.\n    in `model_providers`\n')
        self.assertEqual(m.classify_cli_failure(log,'exit'),'config_rejected')
        self.assertIn('reserved built-in provider IDs',m.error_excerpt(log))
        self.assertIn('Built-in providers cannot be overridden',m.error_excerpt(log))

    def test_progress_is_flushed_before_cli_starts(self):
        output=io.StringIO()
        original=m.managed_run
        def observed(command,*args,**kwargs):
            if command[0]==str(SOURCE/'tests/fake_codex.py'):
                for fragment in ['12','implement','gpt-6.1-sol','medium']:
                    self.assertIn(fragment,output.getvalue())
            return original(command,*args,**kwargs)
        with redirect_stdout(output),patch.object(m,'managed_run',side_effect=observed),patch('builtins.print',wraps=print) as printing:
            self.ctl.start('12');self.ctl.step()
            self.assertTrue(any(call.kwargs.get('flush') for call in printing.call_args_list))

    def test_resume_review_does_not_reimplement(self):
        self.control('interrupt-review')
        self.assertEqual(self.ctl.auto(), 3)
        self.assertEqual(self.state['active']['phase'], 'review')
        self.reload()
        self.assertEqual(self.ctl.auto(), 0)
        self.assertEqual(sum(c['ticket']=='12' and c['phase']=='implement' for c in self.calls()),1)

    def test_resume_verification_at_failed_command(self):
        self.config['queue']=['12']
        self.ctl.start('12'); self.ctl.step()
        self.config['ticket_checks']['12'] = [[sys.executable,'-c','print("first")'],[sys.executable,'-c','print("second")']]
        original = m.run_command
        def interrupted(cmd, *args):
            if 'second' in cmd[-1]:
                return 130, 'interrupted'
            return original(cmd, *args)
        with patch.object(m,'run_command',side_effect=interrupted):
            self.assertEqual(self.ctl.step(), 3)
        self.reload()
        self.assertEqual(self.state['active']['phase'], 'verification')
        self.assertEqual(len(self.state['tickets']['12']['verification_v2']['results']),1)
        with patch.object(m,'run_command',wraps=original) as run:
            self.assertEqual(self.ctl.step(),0)
            self.assertEqual(run.call_count,1)

    def test_resume_correction_does_not_consume_extra_round(self):
        self.control('interrupt-correction')
        self.assertEqual(self.ctl.auto(),3)
        self.assertEqual(self.state['active']['phase'],'correction')
        self.reload()
        self.assertEqual(self.ctl.auto(),0)
        self.assertEqual(self.state['tickets']['12']['correction_rounds'],1)

    def test_quota_latches_across_restart_without_calls(self):
        self.control('quota')
        self.assertEqual(self.ctl.auto(),3)
        calls = len(self.calls())
        self.reload()
        self.assertEqual(self.ctl.auto(),3)
        self.assertEqual(len(self.calls()),calls)
        self.assertEqual(self.state['active']['phase'],'review')
        self.assertEqual(self.state['provider_pause']['reason'],'quota_exhausted')

    def test_structured_quota_also_pauses_all_provider_calls(self):
        self.control('structured-quota')
        self.assertEqual(self.ctl.auto(),3)
        self.assertEqual(self.state['provider_pause']['reason'],'quota_exhausted')
        count=len(self.calls())
        self.reload()
        self.assertEqual(self.ctl.auto(),3)
        self.assertEqual(len(self.calls()),count)

    def test_two_correction_round_limit(self):
        self.control('limit')
        self.assertEqual(self.ctl.auto(),3)
        self.assertEqual(self.state['tickets']['12']['pause_reason'],'correction_limit')
        self.assertEqual(self.state['tickets']['12']['correction_rounds'],2)
        self.assertEqual(sum(c['phase']=='correction' for c in self.calls()),2)

    def test_independent_task_continues_when_blocked(self):
        self.control('blocked')
        self.config['dependencies']={}
        self.assertEqual(self.ctl.auto(),3)
        self.assertTrue(self.ctl.accepted('13'))
        self.assertEqual(self.state['tickets']['12']['status'],'blocked')

    def test_mandatory_phase_blocks_independent_task(self):
        self.control('blocked')
        self.config.update(mandatory_phases=['12'], dependencies={})
        self.assertEqual(self.ctl.auto(),3)
        self.assertFalse(any(c['ticket']=='13' for c in self.calls()))

    def test_invalid_acceptance_never_releases_dependency(self):
        for scenario in ['wrong-binding','text-only','mutate-review']:
            with self.subTest(scenario=scenario):
                self.control(scenario)
                state = {**m.defaults(self.config),'mode':'real','version':2}
                ctl = m.Controller(self.config,state,self.path,self.logs)
                self.assertEqual(ctl.auto(),3)
                self.assertFalse(ctl.accepted('12'))
                self.assertFalse(any(c['ticket']=='13' for c in self.calls()))

    def test_changed_content_and_logs_invalidate_review(self):
        self.ctl.start('12'); self.ctl.step(); self.ctl.step(); self.ctl.step()
        self.assertEqual(self.state['active']['phase'],'commit')
        (self.root/'ticket-12.txt').write_text('changed after review')
        self.ctl.step()
        self.assertEqual(self.state['active']['phase'],'verification')
        self.ctl.step()
        v=self.state['tickets']['12']['verification_v2']
        Path(v['results'][0]['log']).write_text('tampered')
        self.ctl.step()
        self.assertEqual(self.state['active']['phase'],'verification')

    def test_simulation_cannot_release_real_dependencies(self):
        self.state['tickets']['12']={'status':'accepted','acceptance':'simulation_only'}
        self.assertFalse(self.ctl.ready('13'))
        with self.assertRaises(ValueError):
            m.Controller(self.config,{'mode':'simulation'},self.path,self.logs)

    def test_rebaseline_releases_only_the_named_paths_and_unblocks_commit(self):
        (self.root / 'existing.txt').write_text('dirty before start\n')
        snapshot = m.worktree_snapshot()
        self.state['tickets']['12'] = {
            'status': 'awaiting_commit',
            'baseline_worktree': snapshot,
            'commit_block': 'ticket modified files already dirty at start',
        }
        self.state['tickets']['12']['baseline_worktree']['staged'] = False
        # The tree changes after the baseline was taken: the ticket corrects the dirty file.
        (self.root / 'existing.txt').write_text('corrected by the ticket\n')
        self.assertEqual(m.commit_ticket('12', self.config, self.state, self.state['tickets']['12']), 3)
        self.assertEqual(self.state['tickets']['12']['commit_block'],
                         'ticket modified files already dirty at start')

        self.assertEqual(m.rebaseline_ticket('12', self.state, ['existing.txt'],
                                            'base anterior às correções do ticket', self.config), 0)
        rec = self.state['tickets']['12']
        self.assertNotIn('existing.txt', rec['baseline_worktree']['files'])
        self.assertEqual(rec['baseline_worktree']['files'], {})
        self.assertNotIn('commit_block', rec)
        self.assertEqual(rec['rebaselines'][0]['released_files'], ['existing.txt'])

        self.assertEqual(m.commit_ticket('12', self.config, self.state, rec), 0)
        self.assertEqual(self.git('show', '--name-only', '--format=', 'HEAD'), 'existing.txt')
        self.assertEqual((self.root / 'existing.txt').read_text(), 'corrected by the ticket\n')

    def test_rebaseline_refuses_stale_paths_short_notes_and_mandatory_phases(self):
        (self.root / 'existing.txt').write_text('dirty\n')
        self.state['tickets']['12'] = {'baseline_worktree': m.worktree_snapshot()}
        self.state['tickets']['12']['baseline_worktree']['staged'] = False
        with self.assertRaisesRegex(ValueError, 'motivo do rebaseline'):
            m.rebaseline_ticket('12', self.state, [], 'curto', self.config)
        with self.assertRaisesRegex(ValueError, 'não está alterado'):
            m.rebaseline_ticket('12', self.state, ['never-seen.txt'],
                                'justificativa suficientemente longa', self.config)
        # Dirty but created after the baseline: it belongs to the ticket, not to the pre-existing work.
        (self.root / 'ticket-new.txt').write_text('created by the ticket\n')
        with self.assertRaisesRegex(ValueError, 'não fazia parte da base'):
            m.rebaseline_ticket('12', self.state, ['ticket-new.txt'],
                                'justificativa suficientemente longa', self.config)
        mandatory = {**self.config, 'mandatory_phases': ['06']}
        with self.assertRaisesRegex(ValueError, 'não libera arquivos'):
            m.rebaseline_ticket('06', self.state, ['existing.txt'],
                                'justificativa suficientemente longa', mandatory)
        self.state['tickets']['06'] = {'baseline_worktree': m.worktree_snapshot()}
        self.state['tickets']['06']['baseline_worktree']['staged'] = False
        self.assertEqual(m.rebaseline_ticket('06', self.state, [],
                                             'fase obrigatória com base refeita', mandatory), 0)
        with self.assertRaisesRegex(ValueError, 'Fase obrigatória'):
            m.reconcile_ticket('06', self.state, 'accepted', 'verified',
                               'fase obrigatória não é aceita fora do controlador', [], None, mandatory)
        with self.assertRaisesRegex(ValueError, 'não tem registro'):
            m.rebaseline_ticket('99', self.state, [], 'justificativa suficientemente longa', self.config)

        # Untracked files are part of the snapshot and keep being protected unless released.
        (self.root / 'untracked-baseline.txt').write_text('pre-existing untracked\n')
        rec = {'baseline_worktree': m.worktree_snapshot()}
        rec['baseline_worktree']['staged'] = False
        self.state['tickets']['12'] = rec
        self.assertEqual(m.rebaseline_ticket('12', self.state, [], 'base refeita sem liberar arquivos',
                                             self.config), 0)
        self.assertIn('untracked-baseline.txt', self.state['tickets']['12']['baseline_worktree']['files'])

    def test_rebaseline_refuses_a_staged_index(self):
        (self.root / 'existing.txt').write_text('dirty\n')
        self.git('add', 'existing.txt')
        self.state['tickets']['12'] = {'baseline_worktree': {'files': {}, 'staged': False}}
        with self.assertRaisesRegex(ValueError, 'staged'):
            m.rebaseline_ticket('12', self.state, [], 'justificativa suficientemente longa', self.config)

    def test_reconcile_records_acceptance_with_evidence_and_releases_dependents(self):
        commit = self.commit_checkpoint('docs/history/reconcile-12.md')
        self.assertEqual(m.reconcile_ticket('12', self.state, 'accepted', 'verified_local_demonstration',
                                           'verificação local registrada com evidência versionada',
                                           ['docs/history/reconcile-12.md'], commit, self.config), 0)
        self.ctl.state = self.state
        self.assertTrue(self.ctl.accepted('12'))
        self.assertTrue(self.ctl.ready('13'))
        rec = self.state['tickets']['12']
        self.assertEqual(rec['integration_commit'], commit)
        self.assertEqual(rec['acceptance'], 'verified_local_demonstration')
        self.assertEqual(rec['reconciliations'][0]['evidence'], ['docs/history/reconcile-12.md'])
        self.assertEqual(self.state['events'][-1]['kind'], 'reconciled')

    def test_reconcile_refuses_inference_without_evidence_and_mandatory_acceptance(self):
        with self.assertRaisesRegex(ValueError, 'justificativa'):
            m.reconcile_ticket('12', self.state, 'accepted', 'verified', 'curto', [], None, self.config)
        with self.assertRaisesRegex(ValueError, 'evidência'):
            m.reconcile_ticket('12', self.state, 'accepted', 'verified',
                               'verificação local sem prova nomeada', [], None, self.config)
        with self.assertRaisesRegex(ValueError, 'não comprovado como ancestral'):
            m.reconcile_ticket('12', self.state, 'accepted', 'verified',
                               'verificação local com commit inventado', [], 'deadbeef', self.config)
        with self.assertRaisesRegex(ValueError, 'arquivo versionado'):
            m.reconcile_ticket('12', self.state, 'accepted', 'verified',
                               'verificação local com caminho inexistente', ['docs/missing.md'], None,
                               self.config)
        mandatory = {**self.config, 'mandatory_phases': ['12']}
        with self.assertRaisesRegex(ValueError, 'Fase obrigatória'):
            m.reconcile_ticket('12', self.state, 'accepted', 'verified',
                               'tentativa de aceitar fase obrigatória por fora',
                               [], None, mandatory)
        with self.assertRaisesRegex(ValueError, 'Status de reconciliação'):
            m.reconcile_ticket('12', self.state, 'done', 'verified',
                               'status fora da lista permitida', [], None, self.config)

    def test_reconcile_keeps_a_blocked_ticket_blocked_and_records_the_reason(self):
        self.state['tickets']['12'] = {'status': 'blocked', 'pause_reason': 'limitação de ferramenta'}
        self.assertEqual(m.reconcile_ticket('12', self.state, 'blocked', 'tool_limitation_recorded',
                                           'bloqueio registrado por limitação de ferramenta',
                                           [], None, self.config), 0)
        rec = self.state['tickets']['12']
        self.assertEqual(rec['status'], 'blocked')
        self.assertEqual(rec['pause_reason'], 'limitação de ferramenta')
        self.assertFalse(m.Controller(self.config, self.state, self.path, self.logs).accepted('12'))

    def test_preserve_dirty_work(self):
        (self.root/'existing.txt').write_text('dirty before execution')
        self.assertEqual(self.ctl.auto(),0)
        self.assertEqual((self.root/'existing.txt').read_text(),'dirty before execution')
        self.assertIn('existing.txt',self.git('status','--short'))

    def test_migrate_preserves_history_and_stage(self):
        state={'version':1,'active':{'ticket':'07','run_id':'old','phase':'implement'},'tickets':{'07':{'checkpoint':'review','status':'paused','failure_detail':'Firefox MapLibre unresolved','executor_log':'old.log'},'06':{'status':'accepted','acceptance':'historical'},'36':{'status':'accepted_partial','acceptance':'documentary_transparency_only'},'integrated_review':{'status':'queued'}},'events':[]}
        before=copy.deepcopy(state)
        m.migrate(self.config,state)
        self.assertEqual(state['active']['phase'],'review')
        self.assertEqual(state['tickets']['06'],before['tickets']['06'])
        self.assertEqual(state['tickets']['36'],before['tickets']['36'])
        self.assertEqual(state['tickets']['07']['failure_detail'],before['tickets']['07']['failure_detail'])
        self.assertEqual(state['tickets']['07']['executor_profile'],'sol_medium')
        self.assertIn('integrated-review',state['tickets'])


    def test_complete_phase_requires_versioned_evidence_and_ancestor_commit(self):
        mandatory = {**self.config, 'mandatory_phases': ['06']}
        with self.assertRaisesRegex(ValueError, 'Fase desconhecida'):
            m.complete_phase('12', '12', 'nota suficientemente longa para registrar', [], None,
                             self.state, mandatory)
        with self.assertRaisesRegex(ValueError, 'próprio nome'):
            m.complete_phase('12', '06', 'nota suficientemente longa para registrar', [], None,
                             self.state, mandatory)
        commit = self.commit_checkpoint('docs/history/phase-06.md')
        with self.assertRaisesRegex(ValueError, 'mínimo 20'):
            m.complete_phase('06', '06', 'curta', ['docs/history/phase-06.md'], commit,
                             self.state, mandatory)
        with self.assertRaisesRegex(ValueError, 'ao menos uma evidência'):
            m.complete_phase('06', '06', 'fase concluída com prova verificável e commitada', [], commit,
                             self.state, mandatory)
        (self.root / 'docs/history/untracked.md').write_text('solto\\n')
        with self.assertRaisesRegex(ValueError, 'não está versionada'):
            m.complete_phase('06', '06', 'fase concluída com prova verificável e commitada',
                             ['docs/history/untracked.md'], commit, self.state, mandatory)
        with self.assertRaisesRegex(ValueError, 'ancestral de HEAD'):
            m.complete_phase('06', '06', 'fase concluída com prova verificável e commitada',
                             ['docs/history/phase-06.md'], 'deadbeef', self.state, mandatory)
        self.assertFalse(m.phase_gate_valid(self.state.get('phase_completed', {}).get('06')))

    def test_complete_phase_unblocks_the_gate_and_refuses_duplicate(self):
        mandatory = {**self.config, 'mandatory_phases': ['06']}
        commit = self.commit_checkpoint('docs/history/phase-06.md')
        self.assertEqual(m.complete_phase('06', '06',
                                          'fase 06 verificada localmente com prova versionada',
                                          ['docs/history/phase-06.md'], commit, self.state, mandatory), 0)
        self.ctl.state = self.state
        self.assertTrue(self.ctl.gate_done('06'))
        record = self.state['phase_completed']['06']
        self.assertEqual(record['acceptance'], 'verified_local_demonstration')
        self.assertEqual(record['verification']['git_confirmed_commits'], [commit])
        self.assertEqual(record['commit'], commit)
        self.assertEqual(self.state['events'][-1]['kind'], 'phase_completed')
        with self.assertRaisesRegex(ValueError, 'já concluída'):
            m.complete_phase('06', '06', 'tentativa de registrar a mesma fase duas vezes',
                             ['docs/history/phase-06.md'], commit, self.state, mandatory)

    def test_complete_phase_rejects_evidence_absent_from_head_and_active_run(self):
        mandatory = {**self.config, 'mandatory_phases': ['06']}
        self.commit_checkpoint('docs/history/phase-06.md')
        # Versionada no índice, mas ainda fora de HEAD: o gate não pode contar com ela.
        (self.root / 'docs/history/phase-06-index.md').write_text('só no índice\\n')
        self.git('add', 'docs/history/phase-06-index.md')
        with self.assertRaisesRegex(ValueError, 'não está commitada em HEAD'):
            m.complete_phase('06', '06', 'evidência apenas no índice do Git, sem commit',
                             ['docs/history/phase-06-index.md'], None, self.state, mandatory)
        self.state['active'] = {'ticket': '06'}
        with self.assertRaisesRegex(ValueError, 'execução ativa'):
            m.complete_phase('06', '06', 'tentativa enquanto a fase está em execução',
                             ['docs/history/phase-06.md'], None, self.state, mandatory)

    def commit_checkpoint(self, *paths):
        for relative in paths:
            path = self.root / relative
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(f'evidence for {relative}\\n')
            self.git('add', '--', relative)
        self.git('commit', '-qm', 'add historical evidence')
        return self.git('rev-parse', 'HEAD')

    def test_record_local_demonstration_preserves_owner_acceptance_and_backs_up(self):
        state_path = self.root / '.scratch/consulta-coerente/implementation-state.json'
        m.save(state_path, {'tickets': {'20': {'state': 'pending', 'acceptance': 'not verified'}}})
        commit = self.commit_checkpoint('docs/history/ticket-20.md')

        m.record_local_demonstration(
            '20', commit, ['docs/history/ticket-20.md'],
            {'web': 'historical web checks', 'api': 'historical API checks',
             'browser': 'historical browser checks', 'limits': 'owner acceptance pending'},
            code_commits=[commit],
        )

        updated = m.load(state_path, {})['tickets']['20']
        self.assertEqual(updated['state'], 'done')
        self.assertEqual(updated['acceptance'], 'verified_local_demonstration')
        self.assertEqual(updated['technical_acceptance'], 'verified_local_demonstration')
        self.assertEqual(updated['owner_acceptance'], 'pending_with_responsible')
        self.assertEqual(updated['integration_commit'], commit)
        self.assertEqual(updated['verification']['git_confirmed_commits'], [commit])
        backups = list(state_path.parent.glob('implementation-state.json.pre-local-evidence-*'))
        self.assertEqual(len(backups), 1)
        self.assertEqual(m.load(backups[0], {})['tickets']['20']['state'], 'pending')

    def test_sync_historical_phases_preserves_blockers_and_owner_decisions(self):
        checkpoint_paths = [f'docs/history/ticket-{tid}-evidence.md' for tid in ['06','36','07','10','20','35']]
        commit = self.commit_checkpoint(*checkpoint_paths)
        records = {}
        for tid, checkpoint in zip(['06','36','07','10','20','35'], checkpoint_paths):
            records[tid] = {
                'state': 'done', 'acceptance': 'verified_local_demonstration',
                'commit': commit[:7], 'integration_commit': commit,
                'owner_acceptance': 'pending_with_responsible' if tid in {'20','35','36'} else 'not_applicable',
                'verification': {'historical_checkpoints': [checkpoint], 'web': 'passed',
                                 'browser': 'passed', 'diff_check': 'passed'},
            }
        m.save(self.root / '.scratch/consulta-coerente/implementation-state.json', {'tickets': records})
        state = {
            'version': 2, 'active': None, 'events': [], 'phase_completed': {'reconciliation': {'source': 'legacy'}},
            'tickets': {
                '06': {'status': 'blocked', 'acceptance': 'historical_verified_local_demonstration', 'pause_reason': 'old 06 block'},
                '36': {'status': 'accepted_partial', 'acceptance': 'documentary_transparency_only', 'pending': ['27']},
                '07': {'status': 'blocked', 'pause_reason': 'old 07 block'},
                '10': {'status': 'accepted', 'acceptance': 'historical_verified_local_demonstration'},
            },
        }

        m.sync_historical_state(state)

        self.assertEqual(state['tickets']['06']['status'], 'blocked')
        self.assertEqual(state['tickets']['06']['pause_reason'], 'old 06 block')
        self.assertEqual(state['tickets']['36']['status'], 'accepted_partial')
        self.assertEqual(state['tickets']['36']['pending'], ['27'])
        self.assertEqual(state['tickets']['07']['status'], 'blocked')
        self.assertEqual(state['tickets']['10']['status'], 'accepted')
        for tid in ['06', '36', '07', '10']:
            self.assertNotIn(tid, state['phase_completed'])
        for tid in ['20', '35']:
            self.assertEqual(state['tickets'][tid]['technical_acceptance'], 'verified_local_demonstration')
            self.assertEqual(state['tickets'][tid]['owner_acceptance'], 'pending_with_responsible')
        for tid in ['23', '24']:
            self.assertEqual(state['tickets'][tid]['status'], 'blocked')
            self.assertEqual(state['tickets'][tid]['acceptance'], 'product_decision_pending')

    def test_sync_removes_only_synthetic_historical_phase_entries(self):
        m.save(self.root / '.scratch/consulta-coerente/implementation-state.json', {'tickets': {}})
        actual_phase = {'evidence_kind': 'controller_phase_completion', 'result': 'verified'}
        state = {
            'version': 2, 'active': None, 'events': [],
            'phase_completed': {
                '06': {'evidence_kind': 'historical_local_verification', 'acceptance': 'verified_local_demonstration'},
                '07': actual_phase,
                'reconciliation': {'source': 'legacy_documentary_pilot'},
            },
            'tickets': {},
        }

        m.sync_historical_state(state)

        self.assertNotIn('06', state['phase_completed'])
        self.assertEqual(state['phase_completed']['07'], actual_phase)
        self.assertIn('reconciliation', state['phase_completed'])

    def test_synced_controller_does_not_bypass_uncompleted_b5_phases(self):
        checkpoint_paths = [f'docs/history/{name}.md' for name in ['phase-06', 'phase-36', 'phase-07', 'phase-10', 'ticket-20', 'ticket-35']]
        commit = self.commit_checkpoint(*checkpoint_paths)
        records = {}
        for tid, checkpoint in zip(['06', '36', '07', '10', '20', '35'], checkpoint_paths):
            records[tid] = {
                'state': 'done', 'acceptance': 'verified_local_demonstration',
                'integration_commit': commit,
                'owner_acceptance': 'pending_with_responsible' if tid in {'20', '35', '36'} else 'not_applicable',
                'verification': {'historical_checkpoints': [checkpoint], 'web': 'passed',
                                 'api': 'passed', 'browser': 'passed', 'limits': 'historical'},
            }
        m.save(self.root / '.scratch/consulta-coerente/implementation-state.json', {'tickets': records})
        self.config.update(
            queue=['reconciliation', '06', '36', '07', '10', 'integrated-review', '21', '22', '23', '24'],
            mandatory_phases=['reconciliation', '06', '36', '07', '10', 'integrated-review'],
            dependencies={'21': ['20'], '22': ['20']},
        )
        state = {
            'version': 2, 'active': None, 'events': [],
            'phase_completed': {
                'reconciliation': {'source': 'documented'},
                'integrated-review': {'review': {'outcome': 'accepted'}, 'verification': {'results': ['passed']}},
            },
            'tickets': {
                '06': {'status': 'blocked', 'pause_reason': 'historical blocker'},
                '36': {'status': 'accepted_partial', 'pending': ['publication after implementations']},
                '07': {'status': 'blocked', 'pause_reason': 'historical blocker'},
                '10': {'status': 'accepted'},
            },
        }

        m.sync_historical_state(state)
        controller = m.Controller(self.config, state, self.path, self.logs)

        self.assertNotIn('06', state['phase_completed'])
        self.assertNotIn('36', state['phase_completed'])
        self.assertNotIn('07', state['phase_completed'])
        self.assertNotIn('10', state['phase_completed'])
        self.assertFalse(controller.ready('21'))
        self.assertFalse(controller.ready('23'))
        self.assertFalse(controller.ready('24'))
        self.assertEqual(controller.start('21'), 3)
        self.assertIsNone(state['active'])

    def test_blocked_product_decision_cannot_pass_run_gate(self):
        self.config.update(queue=['23'], mandatory_phases=[], dependencies={})
        self.state['tickets']['23'] = {
            'status': 'blocked', 'acceptance': 'product_decision_pending',
            'pause_reason': 'the responsible owner has not approved the rule',
        }
        self.assertFalse(self.ctl.ready('23'))
        self.assertEqual(self.ctl.start('23'), 3)
        self.assertIsNone(self.state['active'])

    def test_historical_phase_gate_rejects_missing_or_uncommitted_evidence(self):
        self.config.update(queue=['21'], mandatory_phases=['06'], dependencies={})
        self.state['phase_completed']['06'] = {
            'evidence_kind': 'historical_local_verification',
            'acceptance': 'verified_local_demonstration', 'commit': 'missing',
            'checkpoints': ['docs/history/missing.md'],
        }
        self.assertFalse(self.ctl.gate_done('06'))

    def test_integrated_review_without_implementation(self):
        self.config.update(queue=['integrated-review'],mandatory_phases=['integrated-review'],dependencies={})
        self.config['phase_checks']['integrated-review']=[[sys.executable,'-c','print("integrated check")']]
        self.assertEqual(self.ctl.auto(),0)
        self.assertEqual([c['phase'] for c in self.calls()],['review'])

    def test_process_group_cleanup_on_timeout_and_normal_exit(self):
        for timeout in [True,False]:
            pidfile=self.root/'child.pid'
            script='import subprocess,time; from pathlib import Path; p=subprocess.Popen(["sleep","30"],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL); Path("child.pid").write_text(str(p.pid)); '+('time.sleep(30)' if timeout else 'pass')
            code,kind,_=m.managed_run([sys.executable,'-c',script],self.root,timeout=.2 if timeout else 5)
            self.assertEqual(kind,'timeout' if timeout else 'exit')
            pid=int(pidfile.read_text())
            for _ in range(30):
                stat=Path(f'/proc/{pid}/stat')
                if not stat.exists() or stat.read_text().split()[2]=='Z':
                    break
                time.sleep(.01)
            else:
                self.fail('child process still alive')

    def test_exact_routing_and_preserved_dependencies(self):
        config=json.loads((SOURCE/'ticketctl.json').read_text())
        luna={'16','19','22','27','28','29','33','34'}
        high={'12','13','14','15','17','18','23','24','25','26','30','31','32'}
        for ticket,profile in config['ticket_profiles'].items():
            spec=config['profiles'][profile]
            self.assertEqual(spec['model'],'gpt-6-luna' if ticket in luna else 'gpt-6.1-sol')
            self.assertEqual(spec['effort'],'medium')
            review=config['profiles'][config['review_profiles'].get(ticket,config['review_profile'])]
            self.assertEqual(review['model'],'gpt-6.1-sol')
            self.assertEqual(review['effort'],'high' if ticket in high else 'medium')
        self.assertEqual(set(config['adapters']),{'codex'})
        self.assertEqual(config['phase_profiles']['07'],'sol_medium')
        self.assertEqual(config['phase_profiles']['10'],'luna_medium')

    def test_multistage_resume_keeps_completed_stage(self):
        self.config['ticket_stages']={'12':['one','two']}
        self.ctl.start('12'); self.ctl.step()
        self.assertEqual(self.state['active']['phase'],'implement')
        self.assertEqual(self.state['tickets']['12']['stage_index'],1)
        self.reload()
        self.assertEqual(self.ctl.auto(),0)
        self.assertEqual(sum(c['ticket']=='12' and c['phase']=='implement' for c in self.calls()),2)

    def test_partial_acceptance_is_preserved_after_document_phase(self):
        self.config.update(queue=['36'],mandatory_phases=['36'],dependencies={})
        self.state['tickets']['36']={'status':'accepted_partial','acceptance':'documentary_transparency_only','pending':['27']}
        self.config['phase_checks']['36']=[[sys.executable,'-c','print("document check")']]
        self.assertEqual(self.ctl.auto(),0)
        self.assertEqual(self.state['tickets']['36']['status'],'accepted_partial')
        self.assertEqual(self.state['tickets']['36']['pending'],['27'])
        self.assertIn('36',self.state['phase_completed'])
        self.assertFalse(self.ctl.accepted('36'))

    def test_quota_detector_ignores_quoted_agent_text(self):
        log=self.logs/'quoted.log'
        log.write_text(json.dumps({'type':'item.completed','item':{'text':'usage_limit_reached example'}}))
        self.assertEqual(m.classify_cli_failure(log,'exit'),'exit')
        log.write_text(json.dumps({'type':'turn.failed','error':{'message':'usage_limit_reached'}}))
        self.assertEqual(m.classify_cli_failure(log,'exit'),'quota_exhausted')

    def test_verification_failure_enters_correction_and_checks_again(self):
        self.ctl.start('12'); self.ctl.step()
        with patch.object(m,'run_command',return_value=(1,'exit')):
            self.assertEqual(self.ctl.step(),0)
        self.assertEqual(self.state['active']['phase'],'correction')
        self.assertEqual(self.ctl.auto(),0)
        self.assertEqual(self.state['tickets']['12']['correction_rounds'],1)

    def test_controller_sigterm_cleans_provider_and_grandchild(self):
        pidfile=self.root/'grandchild.pid'
        leader=self.root/'leader.pid'
        driver=self.root/'driver.py'
        child_code='import subprocess,time; from pathlib import Path; p=subprocess.Popen(["sleep","30"]); Path("grandchild.pid").write_text(str(p.pid)); time.sleep(30)'
        driver.write_text('import importlib.util,signal,sys\nfrom pathlib import Path\ns=importlib.util.spec_from_file_location("ctl",'+repr(str(SOURCE/'ticketctl.py'))+'); m=importlib.util.module_from_spec(s); s.loader.exec_module(m)\nsignal.signal(signal.SIGTERM,lambda *_: (_ for _ in ()).throw(KeyboardInterrupt()))\nPath("leader.pid").write_text(str(__import__("os").getpid()))\ncode,kind,_=m.managed_run([sys.executable,"-c",'+repr(child_code)+'],Path.cwd(),timeout=30)\nprint(kind)\n')
        proc=subprocess.Popen([sys.executable,str(driver)],cwd=self.root,stdout=subprocess.PIPE,text=True)
        try:
            for _ in range(100):
                if pidfile.exists(): break
                time.sleep(.01)
            self.assertTrue(pidfile.exists())
            proc.send_signal(signal.SIGTERM)
            output,_=proc.communicate(timeout=3)
            self.assertIn('interrupted',output)
            pid=int(pidfile.read_text())
            stat=Path(f'/proc/{pid}/stat')
            self.assertTrue(not stat.exists() or stat.read_text().split()[2]=='Z')
        finally:
            if proc.poll() is None: proc.kill(); proc.wait()
            if proc.stdout: proc.stdout.close()

    def test_all_cli_operations_obey_lock_before_loading(self):
        shutil.copy2(SOURCE/'ticketctl.py',self.root/'tools/ticketctl.py')
        shutil.copy2(SOURCE/'ticketctl.json',self.root/'tools/ticketctl.json')
        lock=self.root/'.scratch/consulta-coerente/controller.lock'
        lock.parent.mkdir(parents=True)
        with lock.open('a') as handle:
            fcntl.flock(handle,fcntl.LOCK_EX|fcntl.LOCK_NB)
            for cmd in ['auto','status','models','simulate','run','next','phase','verify','review','correct','resume','migrate','clear-quota']:
                result=subprocess.run([sys.executable,str(self.root/'tools/ticketctl.py'),cmd],capture_output=True,text=True)
                self.assertEqual(result.returncode,3,(cmd,result.stderr))
                self.assertIn('Outro controlador',result.stdout)
        self.assertFalse((lock.parent/'controller-state.json').exists())

    def test_simulation_cli_ignores_real_state_override(self):
        shutil.copy2(SOURCE/'ticketctl.py',self.root/'tools/ticketctl.py')
        shutil.copy2(SOURCE/'ticketctl.json',self.root/'tools/ticketctl.json')
        self.path.write_text('{"sentinel":"real untouched"}')
        before=self.path.read_bytes()
        env={**os.environ,'TICKETCTL_STATE':str(self.path)}
        result=subprocess.run([sys.executable,str(self.root/'tools/ticketctl.py'),'simulate','--scenario','two-tasks'],env=env,capture_output=True,text=True)
        self.assertEqual(result.returncode,0,result.stderr)
        self.assertEqual(self.path.read_bytes(),before)
        sim=m.load(self.root/'.scratch/consulta-coerente/controller-simulation-v2/state.json',{})
        self.assertEqual(sim['mode'],'simulation')
        self.assertTrue(all(r['status']=='simulated_complete' for r in sim['tickets'].values()))


if __name__=='__main__':
    unittest.main(verbosity=2)
