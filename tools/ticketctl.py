#!/usr/bin/env python3
"""Control sequential ticket work exclusively through Codex CLI."""
from __future__ import annotations

import argparse
import fcntl
import hashlib
import json
import os
from pathlib import Path
import shlex
import signal
import shutil
import subprocess
import sys
import time
import uuid

ROOT = Path(__file__).resolve().parents[1]
CONFIG = ROOT / "tools/ticketctl.json"
STATE = Path(os.environ.get("TICKETCTL_STATE", ROOT / ".scratch/consulta-coerente/controller-state.json"))
LOCK = ROOT / ".scratch/consulta-coerente/controller.lock"


def load(path: Path, fallback):
    return json.loads(path.read_text()) if path.exists() else fallback


def save(path: Path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_suffix(path.suffix + ".tmp")
    temp.write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n")
    temp.replace(path)


def defaults(config):
    return {"version": 1, "active": None, "tickets": {}, "events": [],
            "queue": config["queue"]}


def event(state, kind, **data):
    state["events"].append({"at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                            "kind": kind, **data})


def worktree_snapshot():
    # -z preserves spaces, unicode and renames; include the index as well as worktree bytes.
    status = git(["status", "--porcelain=v1", "-z", "--untracked-files=all"])
    files, staged = {}, False
    entries = status.split("\0")
    while entries:
        line = entries.pop(0)
        if not line:
            continue
        staged = staged or line[0] not in {" ", "?"}
        path = line[3:]
        if "R" in line[:2] or "C" in line[:2]:
            entries.pop(0)
        files[path] = file_digest(ROOT / path)
    return {"files": files, "staged": staged}


def commit_ticket(name, config, state, rec):
    baseline = rec.get("baseline_worktree", {"files": {}, "staged": False})
    if baseline.get("staged"):
        rec.update(status="awaiting_commit", commit_block="index already contained staged work before ticket start")
        save(STATE, state)
        print(f"Ticket {name}: commit bloqueado porque o índice já tinha trabalho staged antes da execução.")
        return 3
    current_snapshot = worktree_snapshot()
    if current_snapshot["staged"]:
        rec.update(status="awaiting_commit", commit_block="index changed during ticket execution")
        save(STATE, state)
        return 3
    current = current_snapshot["files"]
    conflicts = [path for path, digest in baseline["files"].items() if current.get(path) != digest]
    if conflicts:
        rec.update(status="awaiting_commit", commit_block="ticket modified files already dirty at start", commit_conflicts=conflicts)
        save(STATE, state)
        print(f"Ticket {name}: commit bloqueado em arquivos preexistentes alterados: {', '.join(conflicts)}")
        return 3
    candidates = sorted(path for path in current if path not in baseline["files"])
    if not candidates:
        rec.update(status="awaiting_commit", commit_block="no isolated ticket changes found")
        save(STATE, state)
        print(f"Ticket {name}: revisão passou, mas não há alterações isoladas para commit.")
        return 3
    add = git_result(["add", "--", *candidates])
    if add.returncode:
        rec.update(status="awaiting_commit", commit_block="git add failed", commit_output=add.stderr[-2000:])
        save(STATE, state)
        return add.returncode
    message = f"feat: implement ticket {name}"
    commit = git_result(["commit", "-m", message])
    if commit.returncode:
        rec.update(status="awaiting_commit", commit_block="git commit failed", commit_output=commit.stderr[-2000:])
        save(STATE, state)
        return commit.returncode
    head = git(["rev-parse", "HEAD"]).strip()
    rec.update(status="accepted", acceptance="verified_and_reviewed", commit=head, committed_files=candidates)
    state["active"] = None
    event(state, "accepted", ticket=name, commit=head)
    save(STATE, state)
    print(f"Ticket {name} aceito e commitado em {head}.")
    return 0


def file_digest(path):
    if path.is_symlink():
        return "symlink:" + os.readlink(path)
    return hashlib.sha256(path.read_bytes()).hexdigest() if path.is_file() else None


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, ensure_ascii=False).encode()).hexdigest()


def managed_run(command, cwd, *, output=None, prompt=None, timeout=30):
    """Own a process group, including grandchildren, until every exit path is cleaned up."""
    proc = None
    try:
        proc = subprocess.Popen(command, cwd=cwd, stdin=subprocess.PIPE if prompt is not None else subprocess.DEVNULL,
                                stdout=output or subprocess.PIPE, stderr=subprocess.STDOUT,
                                text=True, start_new_session=True)
        data, _ = proc.communicate(input=prompt, timeout=timeout)
        return proc.returncode, "exit", data or ""
    except subprocess.TimeoutExpired:
        return 124, "timeout", ""
    except KeyboardInterrupt:
        return 130, "interrupted", ""
    except OSError as error:
        if output:
            output.write(f"\nCLI_START_ERROR: {error}\n")
        return 127, "unavailable", str(error)
    finally:
        if proc:
            try:
                os.killpg(proc.pid, signal.SIGTERM)
                # Kill the group even when its leader has already exited.
                try:
                    proc.wait(timeout=0.2)
                except subprocess.TimeoutExpired:
                    pass
                os.killpg(proc.pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
            proc.wait()
            for stream in (proc.stdin, proc.stdout, proc.stderr):
                if stream:
                    stream.close()


def git(argv):
    code, kind, output = managed_run(["git", *argv], ROOT)
    if code:
        raise RuntimeError(f"git {argv[0]}: {kind} ({code}): {output[-1000:]}")
    return output


def snapshot():
    paths = git(["ls-files", "-z", "--cached", "--others", "--exclude-standard"]).split("\0")
    return digest({"head": git(["rev-parse", "HEAD"]).strip(),
                   "index": git(["diff", "--cached", "--binary"]),
                   "files": {p: [file_digest(ROOT / p), (ROOT / p).lstat().st_mode if (ROOT / p).exists() else None]
                             for p in sorted(set(paths)) if p}})


def run_command(command, cwd, log, timeout):
    if isinstance(command, dict):
        cwd = cwd / command.get("cwd", ".")
        command = command["argv"]
    log.parent.mkdir(parents=True, exist_ok=True)
    with log.open("a") as output:
        output.write("\n$ " + shlex.join(command) + "\n")
        output.flush()
        code, kind, _ = managed_run(command, cwd, output=output, timeout=timeout)
        return code, kind


def render_prompt(template, values):
    text = template.read_text()
    for key, value in values.items():
        text = text.replace("{{" + key + "}}", str(value))
    return text


QUOTA_MARKERS = ("quota exceeded", "usage limit", "rate limit", "insufficient_quota",
                 "usage_limit_reached", "rate_limit_exceeded", "quota_exhausted", "too many requests")


def classify_cli_failure(log, kind):
    lines = log.read_text(errors="replace").splitlines() if log.exists() else []
    errors = []
    for line in lines:
        if line.startswith("$ "):
            continue
        try:
            entry = json.loads(line)
            if entry.get("type") not in {"error", "turn.failed"}:
                continue
        except (ValueError, AttributeError):
            pass
        errors.append(line)
    content = "\n".join(errors).lower()
    if any(marker in content for marker in ("error loading config.toml", "failed to load bootstrap configuration", "reserved built-in provider ids")):
        return "config_rejected"
    if any(marker in content for marker in QUOTA_MARKERS):
        return "quota_exhausted"
    if kind != "exit":
        return kind
    if "operation not permitted" in content or "read-only file system" in content:
        return "sandbox_blocked"
    if any(marker in content for marker in ("unauthorized", "authentication required", "not logged in")):
        return "authentication_unavailable"
    return kind


def error_excerpt(log):
    """Keep detailed logs on disk; show errors rather than agent content in the terminal."""
    if not log or not Path(log).is_file():
        return ""
    lines = []
    for raw in Path(log).read_text(errors="replace").splitlines():
        if not raw.strip() or raw.startswith("$ "):
            continue
        try:
            entry = json.loads(raw)
            if not isinstance(entry, dict) or entry.get("type") not in {"error", "turn.failed"}:
                continue
            raw = json.dumps(entry.get("error", entry.get("message", entry)), ensure_ascii=False)
        except ValueError:
            pass
        lines.append(raw)
    relevant = [line for line in lines if any(word in line.lower() for word in
                ("error", "failed", "exception", "quota", "limit", "not permitted", "unavailable", "reserved built-in", "cannot be overridden"))]
    return "\n".join((relevant or lines)[-5:])[-2000:]


def invoke(config, role, profile, prompt, log, cwd, result_path):
    spec = config["profiles"][profile]
    if spec["tool"] != "codex":
        raise ValueError("Somente Codex CLI é permitido")
    adapter = config["adapters"]["codex"]
    command = [adapter["binary"], *adapter["args"], "--model", spec["model"],
               "-c", f'model_reasoning_effort="{spec["effort"]}"',
               "-c", 'service_tier="default"', "-c", 'model_provider="openai"',
               "-c", "features.multi_agent=false", "-c", "features.fast_mode=false",
               "-c", "features.step_model_switching=false", "-c", "agents.max_threads=1",
               "-c", "features.unbounded_connection_retries=false",
               "-c", 'approval_policy="never"', "--json",
               "--output-schema", str(ROOT / "tools/ticketctl-result.schema.json"),
               "--output-last-message", str(result_path),
               "-C", str(cwd), "--sandbox", "read-only" if role == "reviewer" else "workspace-write", "-"]
    with log.open("a") as output:
        output.write("\n$ " + shlex.join(command) + "\n")
        output.flush()
        code, kind, _ = managed_run(command, cwd, output=output, prompt=prompt,
                                    timeout=config["timeout_seconds"])
    kind = classify_cli_failure(log, kind)
    return code, kind


def check_models(config):
    # Local inventory only: models availability is not probed with paid inference.
    return {"profiles": config["profiles"], "speed": config["codex_speed"],
            "availability": "não consultada; nenhum fallback permitido"}


def dependency_map(config):
    return {k: set(v) for k, v in config["dependencies"].items()}


def sync_historical_state(state):
    historical = load(ROOT / ".scratch/consulta-coerente/implementation-state.json", {}).get("tickets", {})
    state.setdefault("tickets", {})
    state.setdefault("phase_completed", {})
    for tid, record in historical.items():
        proof = historical_local_evidence(record)
        if proof is None:
            if tid not in state["tickets"] and tid == "36" and record.get("static_review", {}).get("status") == "partial_pending_ticket_27":
                state["tickets"][tid] = {"status": "accepted_partial", "acceptance": "documentary_transparency_only",
                                          "commit": "a836616", "pending": ["effective correction intake/tracking depends on ticket 27"]}
            continue
        evidence = {"acceptance": "verified_local_demonstration", **proof}
        if tid in state["tickets"]:
            # Reconcile technical evidence without replacing historical status, decision, or blockers.
            current = state["tickets"][tid]
            current.setdefault("technical_acceptance", "verified_local_demonstration")
            current.setdefault("technical_evidence", evidence)
            continue
        state["tickets"][tid] = {
            "status": "accepted",
            "acceptance": "historical_verified_local_demonstration",
            "technical_acceptance": "verified_local_demonstration",
            "owner_acceptance": record.get("owner_acceptance", "not_recorded"),
            "commit": proof["commit"],
            "evidence": record.get("verification", {}),
        }

    # Only the controller can complete a mandatory phase. Remove phase entries that an earlier
    # reconciliation synthesized from ticket history, but preserve controller-recorded completions.
    for phase in ("06", "36", "07", "10"):
        completion = state["phase_completed"].get(phase)
        if isinstance(completion, dict) and completion.get("evidence_kind") == "historical_local_verification":
            del state["phase_completed"][phase]

    for tid in ("23", "24"):
        rec = state["tickets"].setdefault(tid, {})
        if rec.get("status") in {None, "pending"}:
            rec.update(
                status="blocked",
                acceptance="product_decision_pending",
                owner_acceptance="pending_with_responsible",
                pause_reason="Decisão de produto pendente; regra de confiabilidade e parâmetros ainda não aprovados.",
            )
    return state


def git_result(argv):
    from types import SimpleNamespace
    code, _, output = managed_run(["git", *argv], ROOT)
    return SimpleNamespace(returncode=code, stderr=output)


def backup_file(path, purpose):
    if not path.exists():
        return None
    backup = path.with_name(f"{path.name}.{purpose}-{uuid.uuid4().hex[:8]}")
    shutil.copy2(path, backup)
    return backup


def historical_local_evidence(record):
    if record.get("acceptance") != "verified_local_demonstration":
        return None
    verification = record.get("verification", {})
    checkpoints = record.get("checkpoints") or verification.get("historical_checkpoints", [])
    if not isinstance(checkpoints, list) or not checkpoints:
        return None
    for checkpoint in checkpoints:
        relative = Path(checkpoint)
        if relative.is_absolute() or ".." in relative.parts or not (ROOT / relative).is_file():
            return None
    commit = record.get("integration_commit") or record.get("commit")
    if not commit or git_result(["merge-base", "--is-ancestor", commit, "HEAD"]).returncode:
        return None
    confirmed_commits = verification.get("git_confirmed_commits", [])
    if not isinstance(confirmed_commits, list) or any(
        not isinstance(item, str) or not item or git_result(["merge-base", "--is-ancestor", item, "HEAD"]).returncode
        for item in confirmed_commits
    ):
        return None
    committed = any(not git_result(["cat-file", "-e", f"HEAD:{checkpoint}"]).returncode for checkpoint in checkpoints)
    if not committed:
        return None
    full_commit = git(["rev-parse", f"{commit}^{{commit}}" ]).strip()
    return {"commit": full_commit, "checkpoints": checkpoints, "verification": verification}


def record_local_demonstration(ticket, commit, checkpoints, verification, code_commits=None):
    if ticket not in {"20", "35"}:
        raise ValueError("Somente os tickets 20 e 35 têm evidência técnica pendente nesta reconciliação.")
    required = {"web", "api", "browser", "limits"}
    if not isinstance(verification, dict) or any(not verification.get(key) for key in required):
        raise ValueError("Registre web, API, browser e limites históricos explicitamente.")
    if not checkpoints or any(not isinstance(item, str) for item in checkpoints):
        raise ValueError("Informe ao menos um checkpoint histórico versionado.")
    confirmed_commits = []
    for code_commit in code_commits or []:
        if not isinstance(code_commit, str) or not code_commit or git_result(["merge-base", "--is-ancestor", code_commit, "HEAD"]).returncode:
            raise ValueError(f"Commit técnico não comprovado como ancestral de HEAD: {code_commit!r}.")
        confirmed_commits.append(git(["rev-parse", f"{code_commit}^{{commit}}" ]).strip())
    if confirmed_commits:
        verification = {**verification, "git_confirmed_commits": confirmed_commits}
    path = ROOT / ".scratch/consulta-coerente/implementation-state.json"
    state = load(path, {})
    record = state.get("tickets", {}).get(ticket)
    if not record or record.get("state") != "pending" or record.get("acceptance") not in {None, "not verified"}:
        raise ValueError(f"Ticket {ticket} não está pendente de registro técnico.")
    combined_verification = {
        **record.get("verification", {}),
        **verification,
        "historical_checkpoints": checkpoints,
        "evidence_scope": "historical_local_verification_not_reexecuted",
    }
    candidate = {
        "acceptance": "verified_local_demonstration",
        "integration_commit": commit,
        "verification": combined_verification,
    }
    proof = historical_local_evidence(candidate)
    if proof is None:
        raise ValueError("O commit precisa ser ancestral ao HEAD e ao menos um checkpoint precisa existir e estar versionado.")
    backup_file(path, "pre-local-evidence")
    record.update(
        state="done",
        acceptance="verified_local_demonstration",
        technical_acceptance="verified_local_demonstration",
        owner_acceptance="pending_with_responsible",
        commit=proof["commit"][:7],
        integration_commit=proof["commit"],
        verification=combined_verification,
    )
    save(path, state)
    return proof


def canonical(name):
    return "integrated-review" if name == "integrated_review" else name


def migrate(config, state):
    """Add operational metadata without rewriting any historical acceptance."""
    state.setdefault("mode", "real")
    state.setdefault("phase_completed", {})
    if state.get("version", 1) < 2:
        for old, new in [("integrated_review", "integrated-review")]:
            if old in state["tickets"]:
                if new in state["tickets"]:
                    state.setdefault("legacy_aliases", {})[old] = state["tickets"][old]
                else:
                    state["tickets"][new] = state["tickets"][old]
                del state["tickets"][old]
        if state.get("active"):
            active = state["active"]
            active["ticket"] = canonical(active["ticket"])
            rec = state["tickets"][active["ticket"]]
            phase = rec.get("checkpoint", active.get("phase", "implement"))
            if rec.get("status") == "awaiting_review":
                phase = "review"
            elif rec.get("status") == "correction_required":
                phase = "correction"
            elif rec.get("status") == "awaiting_commit":
                phase = "commit"
            active["phase"] = phase
        # Documentary pilot was actually completed; keep its historical evidence.
        if state["tickets"].get("reconciliation", {}).get("status") == "accepted":
            state["phase_completed"]["reconciliation"] = {"source": "legacy_documentary_pilot"}
        rec = state["tickets"].get("07")
        if rec:
            rec["executor_profile"] = "sol_medium"
            rec["migration_note"] = "Codex Sol Medium; diagnóstico e alterações anteriores preservados; Firefox/MapLibre pendente"
        state["version"] = 2
        event(state, "codex_only_migration", executor_07="sol_medium")
    state["queue"] = config["queue"]
    return state


class Controller:
    def __init__(self, config, state, state_path, logs, *, simulated=False, scenario="happy"):
        self.config, self.state = config, state
        self.path, self.logs = state_path, logs
        self.simulated, self.scenario = simulated, scenario
        expected = "simulation" if simulated else "real"
        if state.get("mode", "real") != expected:
            raise ValueError("Estado incompatível: simulação e operação real não podem se misturar")
        self.logs.mkdir(parents=True, exist_ok=True)

    def persist(self):
        save(self.path, self.state)

    def accepted(self, name):
        rec = self.state["tickets"].get(name, {})
        return (rec.get("status") == "accepted" and
                rec.get("acceptance") not in {"simulation_only", "simulation_fixture"}) if not self.simulated else rec.get("status") == "simulated_complete"

    def gate_done(self, name):
        proof = self.state.get("phase_completed", {}).get(name)
        if proof is None:
            return False
        if proof.get("evidence_kind") == "historical_local_verification":
            return historical_local_evidence(proof) is not None
        return True

    def ready(self, name):
        rec = self.state["tickets"].get(name, {})
        if rec.get("status") in {"blocked", "awaiting_commit", "paused"}:
            return False
        mandatory = self.config.get("mandatory_phases", [])
        preceding = mandatory[:mandatory.index(name)] if name in mandatory else mandatory
        if not all(self.gate_done(p) for p in preceding):
            return False
        return all(self.accepted(dep) for dep in self.config["dependencies"].get(name, []))

    def select(self):
        for name in self.config["queue"]:
            rec = self.state["tickets"].get(name, {})
            if name in self.config.get("mandatory_phases", []):
                if self.gate_done(name):
                    continue
            elif self.accepted(name):
                continue
            if rec.get("status") in {"blocked", "awaiting_commit", "paused"}:
                continue
            if self.ready(name):
                return name
        return None

    def start(self, name):
        if not self.ready(name):
            print(f"{name}: dependências ou fases obrigatórias pendentes")
            return 3
        rec = self.state["tickets"].setdefault(name, {})
        if name in self.config.get("mandatory_phases", []) and rec.get("acceptance"):
            rec.setdefault("historical_before_phase", dict(rec))
        rec.setdefault("baseline_worktree", worktree_snapshot())
        runid = uuid.uuid4().hex[:12]
        rec.update(run_id=runid, status="running", attempts=rec.get("attempts", 0) + 1)
        self.state["active"] = {"ticket": name, "run_id": runid,
                                "phase": "verification" if name == "integrated-review" else "implement"}
        self.transition(self.state["active"]["phase"])
        return 0

    def transition(self, phase):
        active = self.state["active"]
        active["phase"] = phase
        rec = self.state["tickets"][active["ticket"]]
        rec.update(phase=phase, checkpoint=phase, status="running")
        event(self.state, "transition", ticket=active["ticket"], phase=phase)
        self.persist()

    def profile(self, name, phase):
        if phase == "review":
            return self.config.get("review_profiles", {}).get(name, self.config["review_profile"])
        return self.config["phase_profiles"].get(name) or self.config["ticket_profiles"][name]

    def report_failure(self, reason, details=None):
        active = self.state["active"]
        details = details or {}
        log = details.get("log")
        code = details.get("returncode", "não se aplica")
        print(f"Falha: tarefa={active['ticket']} etapa={active['phase']} motivo={reason} "
              f"código de saída={code} log={log or 'não gerado'}", file=sys.stderr, flush=True)
        excerpt = details.get("error") or error_excerpt(log)
        if excerpt:
            print(excerpt, file=sys.stderr, flush=True)

    def stop(self, reason, *, blocked=False):
        active = self.state["active"]
        rec = self.state["tickets"][active["ticket"]]
        details = rec.get("last_cli") if rec.get("last_cli", {}).get("phase") == active["phase"] else rec.get("last_verification") if active["phase"] == "verification" else None
        self.report_failure(reason, details)
        rec.update(status="blocked" if blocked else "paused", pause_reason=reason,
                   checkpoint=active["phase"])
        event(self.state, "checkpoint", ticket=active["ticket"], phase=active["phase"], reason=reason)
        if reason == "quota_exhausted":
            self.state["provider_pause"] = {"reason": reason, "ticket": active["ticket"]}
        elif blocked:
            self.state["active"] = None
        self.persist()
        return 3

    def checks(self, name):
        return self.config.get("phase_checks", {}).get(name) or self.config.get("ticket_checks", {}).get(name, [])

    def fingerprint(self):
        name = (self.state.get("active") or {}).get("ticket", "")
        names = self.config.get("mandatory_phases", []) if name == "integrated-review" else [name]
        tickets = {t: self.config.get("ticket_files", {}).get(t) for t in names}
        return digest({"repository": snapshot(), "configuration": self.config,
                       "tickets": {t: file_digest(ROOT / p) if p else None for t, p in tickets.items()}})

    def verification_valid(self, rec):
        v = rec.get("verification_v2", {})
        payload = {k: v[k] for k in ("snapshot", "results", "checks") if k in v}
        return (bool(v.get("results")) and v.get("id") == digest(payload) and
                v.get("snapshot") == self.fingerprint() and
                v.get("checks") == self.checks(self.state["active"]["ticket"]) and
                len(v["results"]) == len(v["checks"]) and
                all(r["returncode"] == 0 and bool(r["log_sha256"]) and file_digest(Path(r["log"])) == r["log_sha256"]
                    for r in v["results"]))

    def request(self, name, phase, rec):
        before = self.fingerprint()
        context = {"ticket": name, "phase": phase, "run_id": rec["run_id"],
                   "request_id": uuid.uuid4().hex, "snapshot": before,
                   "verification_id": rec.get("verification_v2", {}).get("id", "") if phase == "review" else ""}
        profile = self.profile(name, phase)
        stem = self.logs / f"{name}-{phase}-{context['request_id']}"
        log, result_path = stem.with_suffix(".log"), stem.with_suffix(".json")
        rec[f"{phase}_log"] = str(log)
        event(self.state, "invocation", **context, profile=profile, spec=self.config["profiles"][profile])
        self.persist()
        if self.simulated:
            outcome = "accepted" if phase == "review" else "completed"
            count = sum(e.get("kind") == "invocation" and e.get("ticket") == name and e.get("phase") == phase for e in self.state["events"])
            if self.scenario in {"correction", "two-tasks"} and name == self.config["queue"][0] and phase == "review" and count == 1:
                outcome = "changes_required"
            if self.scenario == "correction-limit" and phase == "review":
                outcome = "changes_required"
            if self.scenario == "blocked" and name == self.config["queue"][0]:
                outcome = "blocked"
            if self.scenario == "quota" and phase == "review":
                log.write_text('rate_limit_exceeded\n')
                rec["last_cli"] = {"phase": phase, "returncode": 1, "log": str(log)}
                return None, "quota_exhausted"
            if self.scenario == "failure-resume" and phase == "review" and count == 1:
                log.write_text('SIMULATED interruption\n')
                rec["last_cli"] = {"phase": phase, "returncode": 130, "log": str(log)}
                return None, "interrupted"
            result = {**context, "outcome": outcome, "findings": ["achado simulado"] if outcome == "changes_required" else [], "summary": "SIMULATED"}
            save(result_path, result)
            log.write_text(json.dumps(result) + "\n")
            code, kind = 0, "exit"
        else:
            template = ROOT / "tools/prompts" / ("review.md" if phase == "review" else "reconcile.md" if name == "reconciliation" else "implement.md")
            prompt = render_prompt(template, {"ticket": name, "ticket_file": self.config.get("ticket_files", {}).get(name, "tickets iniciais 06/07/10/36"), "repo": ROOT, "logs": json.dumps(rec, ensure_ascii=False)})
            stages = self.config.get("ticket_stages", {}).get(name, [])
            if phase == "implement" and stages:
                prompt += f"\nImplemente somente etapa {rec.get('stage_index', 0) + 1}: {stages[rec.get('stage_index', 0)]}. Preserve etapas anteriores."
            if phase == "correction":
                prompt += "\nCorrija somente estes achados da verificação/revisão: " + json.dumps(rec.get("findings", []), ensure_ascii=False)
            if name == "36":
                prompt += "\nEscopo desta fase: ajuste documental; recebimento/acompanhamento efetivo continua pendente do 27. Não aceite o ticket inteiro."
            if name == "integrated-review":
                prompt += "\nRevise os critérios e o código atual das fases iniciais, incluindo código já em HEAD; não limite ao diff. Tickets e evidências: " + json.dumps({t: {"ticket_file": self.config.get("ticket_files", {}).get(t), "record": self.state["tickets"].get(t, {})} for t in self.config.get("mandatory_phases", []) if t != name}, ensure_ascii=False)
            prompt += "\nContinue exatamente o checkpoint e leia logs anteriores:\n" + json.dumps(rec, ensure_ascii=False)
            prompt += "\nContrato: devolva apenas JSON conforme schema; copie estes vínculos exatamente: " + json.dumps(context)
            prompt += "\nNunca crie subagentes, troque modelo, repita chamada após cota, compre créditos, faça commit/push ou publique. Se houver cota esgotada, use outcome quota_exhausted. Para outro bloqueio, use outcome blocked e descreva. Na revisão, accepted exige evidência dos critérios; achados exigem changes_required. Execução/correção concluída usa completed."
            code, kind = invoke(self.config, "reviewer" if phase == "review" else "executor", profile, prompt, log, ROOT, result_path)
        rec["last_cli"] = {"phase": phase, "returncode": code, "kind": kind, "log": str(log)}
        if kind == "quota_exhausted" or code:
            rec["returncode"] = code
            return None, kind if kind != "exit" else f"cli_exit_{code}"
        try:
            result = load(result_path, None)
            if not isinstance(result, dict) or set(result) != set(context) | {"outcome", "findings", "summary"}:
                raise ValueError("campos inesperados")
            if any(result.get(k) != v for k, v in context.items()):
                raise ValueError("vínculo divergente")
            if not isinstance(result["findings"], list) or not all(isinstance(f, str) for f in result["findings"]) or not isinstance(result["summary"], str):
                raise ValueError("tipos inválidos")
            allowed = {"accepted", "changes_required", "blocked", "quota_exhausted"} if phase == "review" else {"completed", "blocked", "quota_exhausted"}
            if result["outcome"] not in allowed or (result["outcome"] == "accepted" and result["findings"]):
                raise ValueError("resultado incoerente")
            if phase == "review" and self.fingerprint() != before:
                return None, "review_changed_content"
        except (ValueError, TypeError, KeyError) as error:
            rec["result_error"] = str(error)
            rec["last_cli"]["error"] = str(error)
            return None, "invalid_structured_result"
        rec["last_result"] = result
        rec[f"{phase}_result"] = str(result_path)
        self.persist()
        return result, None

    def correction_needed(self, rec, findings):
        rec["findings"] = findings
        if rec.get("correction_rounds", 0) >= 2:
            return self.stop("correction_limit", blocked=True)
        self.transition("correction")
        return 0

    def step(self):
        if self.state.get("provider_pause"):
            print("Provedor pausado por cota; nenhuma chamada realizada.")
            return 3
        active = self.state["active"]
        name, phase = active["ticket"], active["phase"]
        spec = self.config["profiles"][self.profile(name, phase)]
        print(f"Tarefa={name} etapa={phase} modelo={spec['model']} esforço={spec['effort']}"
              + (" (verificação local)" if phase == "verification" else ""), flush=True)
        rec = self.state["tickets"][name]
        if phase in {"implement", "correction"}:
            if phase == "correction" and not rec.get("correction_inflight"):
                if rec.get("correction_rounds", 0) >= 2:
                    return self.stop("correction_limit", blocked=True)
                rec["correction_rounds"] = rec.get("correction_rounds", 0) + 1
                rec["correction_inflight"] = True
                self.persist()
            result, failure = self.request(name, phase, rec)
            if failure:
                return self.stop(failure)
            if result["outcome"] == "quota_exhausted":
                return self.stop("quota_exhausted")
            if result["outcome"] == "blocked":
                return self.stop(result["summary"], blocked=True)
            if phase == "implement":
                rec["stage_index"] = rec.get("stage_index", 0) + 1
                if rec["stage_index"] < len(self.config.get("ticket_stages", {}).get(name, [])):
                    self.persist()
                    return 0
            rec.pop("correction_inflight", None)
            rec.pop("verification_v2", None)
            self.transition("verification")
        elif phase == "verification":
            checks = self.checks(name)
            if not checks:
                return self.stop("checks_missing", blocked=True)
            before = self.fingerprint()
            v = rec.get("verification_v2", {})
            if v.get("snapshot") != before or v.get("checks") != checks:
                v = {"snapshot": before, "checks": checks, "results": []}
                rec["verification_v2"] = v
            for index in range(len(v["results"]), len(checks)):
                log = self.logs / f"verify-{name}-{uuid.uuid4().hex}.log"
                self.persist()
                print(f"Verificação {index + 1}/{len(checks)}: {checks[index]} log={log}", flush=True)
                if self.simulated:
                    code, kind = 0, "exit"
                    log.write_text("SIMULATED verification\n")
                else:
                    code, kind = run_command(checks[index], ROOT, log, self.config["timeout_seconds"])
                result = {"command": checks[index], "returncode": code, "kind": kind, "log": str(log), "log_sha256": file_digest(log)}
                rec["last_verification"] = result
                if code:
                    if kind in {"interrupted", "timeout", "unavailable"}:
                        return self.stop(kind)
                    self.report_failure("verification_failed", result)
                    rec.pop("verification_v2", None)
                    return self.correction_needed(rec, [json.dumps(result)])
                v["results"].append(result)
                self.persist()
            if self.fingerprint() != before:
                rec.pop("verification_v2", None)
                return self.stop("content_changed_during_verification")
            v["id"] = digest({k: v[k] for k in ("snapshot", "checks", "results")})
            self.transition("review")
        elif phase == "review":
            if not self.verification_valid(rec):
                rec.pop("verification_v2", None)
                self.transition("verification")
                return 0
            result, failure = self.request(name, phase, rec)
            if failure:
                return self.stop(failure)
            if result["outcome"] == "quota_exhausted":
                return self.stop("quota_exhausted")
            if result["outcome"] == "blocked":
                return self.stop(result["summary"], blocked=True)
            if result["outcome"] == "changes_required":
                return self.correction_needed(rec, result["findings"] or [result["summary"]])
            rec["approved_result"] = result
            self.transition("commit")
        elif phase == "commit":
            approved = rec.get("approved_result", {})
            if not self.verification_valid(rec) or approved.get("snapshot") != self.fingerprint() or approved.get("verification_id") != rec["verification_v2"]["id"]:
                rec.pop("verification_v2", None)
                self.transition("verification")
                return 0
            if not self.simulated and name not in self.config.get("mandatory_phases", []):
                code = commit_ticket(name, self.config, self.state, rec)
                if code:
                    rec.update(status="awaiting_commit", checkpoint="commit")
                    self.state["active"] = None
                    self.persist()
                    return code
            else:
                if name in self.config.get("mandatory_phases", []):
                    self.state.setdefault("phase_completed", {})[name] = {"review": approved, "verification": rec["verification_v2"]}
                historical = rec.get("historical_before_phase")
                if historical:
                    rec["status"] = historical["status"]
                    rec["acceptance"] = historical["acceptance"]
                else:
                    rec.update(status="simulated_complete" if self.simulated else "accepted",
                               acceptance="simulation_only" if self.simulated else "verified_and_reviewed_phase")
                self.state["active"] = None
            event(self.state, "completed", ticket=name, simulated=self.simulated)
            self.persist()
        else:
            return self.stop("unknown_checkpoint", blocked=True)
        return 0

    def auto(self, *, one=False):
        while True:
            if self.state.get("provider_pause"):
                print("Fila pausada por cota; chamadas ao provedor suspensas.")
                return 3
            if not self.state.get("active"):
                name = self.select()
                if not name:
                    pending = [n for n in self.config["queue"] if not (self.gate_done(n) if n in self.config.get("mandatory_phases", []) else self.accepted(n))]
                    print("Fila concluída." if not pending else "Fila sem tarefa pronta: " + ", ".join(pending))
                    return 0 if not pending else 3
                self.start(name)
            code = self.step()
            if one:
                return code
            if code and self.state.get("active"):
                return code


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=["auto", "status", "simulate", "run", "next", "phase", "verify", "review", "correct", "resume", "models", "migrate", "record-local-demo", "clear-quota"])
    parser.add_argument("ticket", nargs="?")
    parser.add_argument("--ticket", dest="resume_ticket")
    parser.add_argument("--scenario", choices=["happy", "two-tasks", "correction", "failure-resume", "dependency-blocked", "quota", "correction-limit", "blocked"], default="happy")
    parser.add_argument("--commit")
    parser.add_argument("--code-commit", action="append", default=[])
    parser.add_argument("--checkpoint", action="append", default=[])
    parser.add_argument("--web-evidence")
    parser.add_argument("--api-evidence")
    parser.add_argument("--browser-evidence")
    parser.add_argument("--limits-evidence")
    args = parser.parse_args()
    global STATE
    simulated = args.command == "simulate" or os.environ.get("TICKETCTL_SIMULATE") == "1"
    # TICKETCTL_STATE is a real-state path only. Simulation never reads or writes it.
    if simulated:
        STATE = ROOT / ".scratch/consulta-coerente/controller-simulation-v2/state.json"
    logs = STATE.parent / ("logs" if simulated else "controller-logs")
    LOCK.parent.mkdir(parents=True, exist_ok=True)
    with LOCK.open("a+") as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            print("Outro controlador está ativo; nenhuma operação executada.")
            return 3
        # All reads, migration, initialization and writes happen inside the lock.
        config = load(CONFIG, {})
        if args.command == "models":
            print(json.dumps(check_models(config), indent=2, ensure_ascii=False))
            return 0
        if args.command == "record-local-demo":
            if simulated:
                print("Registro de evidência técnica não pode usar estado simulado.")
                return 3
            verification = {
                "web": args.web_evidence,
                "api": args.api_evidence,
                "browser": args.browser_evidence,
                "limits": args.limits_evidence,
            }
            try:
                proof = record_local_demonstration(
                    args.ticket, args.commit, args.checkpoint, verification, args.code_commit
                )
            except ValueError as error:
                print(f"Registro técnico recusado: {error}")
                return 2
            print(f"Ticket {args.ticket}: verificação local demonstrada; aceite do responsável permanece pendente; commit={proof['commit']}.")
            return 0
        if simulated:
            config = {**config, "queue": ["12", "13"], "mandatory_phases": [], "dependencies": {"13": ["12"]}, "ticket_stages": {}}
        state = load(STATE, defaults(config))
        if simulated:
            if not STATE.exists():
                state.update(mode="simulation", version=2, scenario=args.scenario)
            args.scenario = state.get("scenario", args.scenario)
            if args.scenario == "dependency-blocked":
                config["dependencies"] = {"12": ["missing"], "13": ["12"]}
        else:
            if STATE.exists() and state.get("version", 1) < 2:
                backup_file(STATE, "pre-codex")
            elif args.command == "migrate" and STATE.exists():
                backup_file(STATE, "pre-reconcile")
            sync_historical_state(state)
            migrate(config, state)
        ctl = Controller(config, state, STATE, logs, simulated=simulated, scenario=args.scenario)
        ctl.persist()
        if args.command == "status":
            print(json.dumps(state, indent=2, ensure_ascii=False))
            return 0
        if args.command == "migrate":
            print("Checkpoint migrado; nenhuma chamada ao provedor.")
            return 0
        if args.command == "clear-quota":
            state.pop("provider_pause", None)
            event(state, "quota_pause_cleared_by_operator")
            ctl.persist()
            print("Pausa removida explicitamente. Use auto quando a cota estiver disponível.")
            return 0
        name = canonical(args.resume_ticket or args.ticket or (state.get("active") or {}).get("ticket", ""))
        if args.command in {"run", "phase"}:
            if not name or state.get("active"):
                print("Informe tarefa sem outra execução ativa; use resume para o checkpoint.")
                return 3
            if name not in config["queue"]:
                print("Tarefa fora da fila configurada")
                return 2
            if ctl.start(name):
                return 3
        if args.command in {"verify", "review", "correct", "resume"}:
            active = state.get("active")
            if not active and name and state["tickets"].get(name, {}).get("checkpoint"):
                rec = state["tickets"][name]
                state["active"] = {"ticket": name, "run_id": rec["run_id"], "phase": rec["checkpoint"]}
                active = state["active"]
            if not active or (name and active["ticket"] != name):
                print("Não há checkpoint ativo correspondente.")
                return 3
            required = {"verify": "verification", "review": "review", "correct": "correction"}.get(args.command)
            if required and active["phase"] != required:
                print(f"Checkpoint está em {active['phase']}; use resume.")
                return 3
        try:
            return ctl.auto(one=args.command in {"next", "verify", "review", "correct"})
        except KeyboardInterrupt:
            return ctl.stop("interrupted") if state.get("active") else 130


if __name__ == "__main__":
    signal.signal(signal.SIGTERM, lambda *_: (_ for _ in ()).throw(KeyboardInterrupt()))
    sys.exit(main())
