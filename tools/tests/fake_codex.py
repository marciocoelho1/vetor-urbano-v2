#!/usr/bin/env python3
"""Offline Codex fixture: never forwards commands or calls a provider."""
import json
from pathlib import Path
import re
import sys

args = sys.argv[1:]
prompt = sys.stdin.read()
context = json.loads(re.search(r'copie estes vínculos exatamente: (\{[^\n]+\})', prompt).group(1))
control = Path('.scratch/fake-control.json')
state = json.loads(control.read_text())
phase, name = context['phase'], context['ticket']
state.setdefault('calls', []).append({'ticket': name, 'phase': phase, 'args': args})
count = sum(c['phase'] == phase and c['ticket'] == name for c in state['calls'])
control.write_text(json.dumps(state))
scenario = state.get('scenario', 'happy')
if scenario == 'config-rejected' or any(arg.startswith('model_providers.openai.') for arg in args):
    print('Error loading config.toml: model_providers contains reserved built-in provider IDs: `openai`. Built-in providers cannot be overridden.', file=sys.stderr)
    sys.exit(1)
if scenario == 'quota' and phase == 'review':
    print(json.dumps({'type': 'turn.failed', 'error': {'message': 'usage_limit_reached'}}))
    sys.exit(1)
if scenario == 'interrupt-review' and name == '12' and phase == 'review' and count == 1:
    sys.exit(130)
if scenario == 'interrupt-correction' and phase == 'correction' and count == 1:
    sys.exit(130)
if phase in {'implement', 'correction'}:
    Path(f'ticket-{name}.txt').write_text(f'{name} {phase} {count}\n')
outcome = 'accepted' if phase == 'review' else 'completed'
if phase == 'review' and (scenario == 'limit' or (scenario in {'correction', 'interrupt-correction'} and name == '12' and count == 1)):
    outcome = 'changes_required'
if scenario == 'blocked' and name == '12':
    outcome = 'blocked'
result = {**context, 'outcome': outcome, 'findings': ['consertar conteúdo'] if outcome == 'changes_required' else [], 'summary': 'fixture offline'}
if scenario == 'structured-quota' and phase == 'review':
    result['outcome'] = 'quota_exhausted'
if scenario == 'wrong-binding' and phase == 'review':
    result['snapshot'] = 'wrong'
if scenario == 'mutate-review' and phase == 'review':
    Path('changed-by-review.txt').write_text('no acceptance')
if scenario == 'text-only' and phase == 'review':
    Path(args[args.index('--output-last-message') + 1]).write_text('REVIEW_ACCEPTED')
else:
    Path(args[args.index('--output-last-message') + 1]).write_text(json.dumps(result))
print(json.dumps({'type': 'turn.completed'}))
