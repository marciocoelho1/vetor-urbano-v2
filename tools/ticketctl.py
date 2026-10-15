#!/usr/bin/env python3
"""Control sequential ticket work through Codex CLI and Antigravity CLI."""
from __future__ import annotations

import argparse
import fcntl
import hashlib
import json
import os
from pathlib import Path
import shlex
import subprocess
import sys
import time
import uuid

ROOT = Path(__file__).resolve().parents[1]
CONFIG = ROOT / "tools/ticketctl.json"
STATE = Path(os.environ.get("TICKETCTL_STATE", ROOT / ".scratch/consulta-coerente/controller-state.json"))
LOGS = ROOT / ".scratch/consulta-coerente/controller-logs"
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


def ticket_id(raw):
    return f"{int(raw):02d}"


def event(state, kind, **data):
    state["events"].append({"at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                            "kind": kind, **data})


def worktree_snapshot():
    status = subprocess.run(["git", "status", "--porcelain", "--untracked-files=all"], cwd=ROOT,
                            text=True, capture_output=True, check=True).stdout.splitlines()
    files = {}
    staged = False
    for line in status:
        if len(line) < 4:
            continue
        staged = staged or line[0] != " "
        path = line[3:]
        target = ROOT / path
        digest = hashlib.sha256(target.read_bytes()).hexdigest() if target.is_file() else None
        files[path] = digest
    return {"files": files, "staged": staged}


def commit_ticket(name, config, state, rec):
    baseline = rec.get("baseline_worktree", {"files": {}, "staged": False})
    if baseline.get("staged"):
        rec.update(status="awaiting_commit", commit_block="index already contained staged work before ticket start")
        save(STATE, state)
        print(f"Ticket {name}: commit bloqueado porque o índice já tinha trabalho staged antes da execução.")
        return 3
    current = worktree_snapshot()["files"]
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
    add = subprocess.run(["git", "add", "--", *candidates], cwd=ROOT, text=True, capture_output=True)
    if add.returncode:
        rec.update(status="awaiting_commit", commit_block="git add failed", commit_output=add.stderr[-2000:])
        save(STATE, state)
        return add.returncode
    message = f"feat: implement ticket {name}"
    commit = subprocess.run(["git", "commit", "-m", message], cwd=ROOT, text=True, capture_output=True)
    if commit.returncode:
        rec.update(status="awaiting_commit", commit_block="git commit failed", commit_output=commit.stderr[-2000:])
        save(STATE, state)
        return commit.returncode
    head = subprocess.run(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True, capture_output=True, check=True).stdout.strip()
    rec.update(status="accepted", acceptance="verified_and_reviewed", commit=head, committed_files=candidates)
    state["active"] = None
    event(state, "accepted", ticket=name, commit=head)
    save(STATE, state)
    print(f"Ticket {name} aceito e commitado em {head}.")
    return 0


def run_command(command, cwd, log, timeout):
    if isinstance(command, dict):
        cwd = cwd / command.get("cwd", ".")
        command = command["argv"]
    with log.open("a") as output:
        output.write("\n$ " + shlex.join(command) + "\n")
        output.flush()
        try:
            result = subprocess.run(command, cwd=cwd, stdout=output, stderr=subprocess.STDOUT,
                                    timeout=timeout, check=False)
            return result.returncode, "exit"
        except KeyboardInterrupt:
            output.write("\nCHECKPOINT: execução interrompida pelo operador\n")
            return 130, "interrupted"
        except subprocess.TimeoutExpired:
            return 124, "timeout"
        except OSError as error:
            output.write(f"\nCLI_START_ERROR: {error}\n")
            return 127, "unavailable"


def render_prompt(template, values):
    text = template.read_text()
    for key, value in values.items():
        text = text.replace("{{" + key + "}}", str(value))
    return text


def final_response(path):
    raw = path.read_text(errors="replace") if path.exists() else ""
    final_start = raw.rfind("\ncodex\n")
    text = raw[final_start + len("\ncodex\n"):] if final_start >= 0 else ""
    return text.split("\ntokens used", 1)[0].strip()


def classify_cli_failure(log, kind):
    if kind != "exit":
        return kind
    content = log.read_text(errors="replace").lower() if log.exists() else ""
    if "operation not permitted" in content or "read-only file system" in content:
        return "sandbox_blocked"
    if any(marker in content for marker in ("quota exceeded", "usage limit", "rate limit")):
        return "quota_exhausted"
    if any(marker in content for marker in ("unauthorized", "authentication required", "not logged in")):
        return "authentication_unavailable"
    return kind


def invoke(config, role, profile, prompt, log, cwd):
    spec = config["profiles"][profile]
    adapter = config["adapters"][spec["tool"]]
    command = [adapter["binary"], *adapter["args"], "--model", spec["model"]]
    if spec.get("effort"):
        command += ["--effort", spec["effort"]] if spec["tool"] == "antigravity" else ["-c", f'model_reasoning_effort="{spec["effort"]}"']
    if spec["tool"] == "codex":
        command += ["-C", str(cwd), "--sandbox", "workspace-write", "-"]
        # codex exec accepts prompt from stdin when argument is '-'.
        with log.open("a") as output:
            output.write("\n$ " + shlex.join(command) + "\n")
            output.flush()
            try:
                result = subprocess.run(command, input=prompt, text=True, cwd=cwd,
                                        stdout=output, stderr=subprocess.STDOUT,
                                        timeout=config["timeout_seconds"], check=False)
                return result.returncode, "exit"
            except subprocess.TimeoutExpired:
                return 124, "timeout"
            except KeyboardInterrupt:
                output.write("\nCHECKPOINT: execução interrompida pelo operador\n")
                return 130, "interrupted"
            except OSError as error:
                output.write(f"\nCLI_START_ERROR: {error}\n")
                return 127, "unavailable"
    command += ["--mode", adapter.get("mode", "accept-edits"), "--print-timeout", f'{config["timeout_seconds"]}s', f"--print={prompt}"]
    return run_command(command, cwd, log, config["timeout_seconds"] + 30)


def check_models(config):
    results = {}
    for tool, adapter in config["adapters"].items():
        cmd = [adapter["binary"], *adapter["models_args"]]
        try:
            p = subprocess.run(cmd, cwd=ROOT, text=True, capture_output=True, timeout=30)
            results[tool] = {"returncode": p.returncode, "output": (p.stdout + p.stderr)[-6000:]}
        except (OSError, subprocess.TimeoutExpired) as error:
            results[tool] = {"returncode": 127, "output": str(error)}
    return results


def dependency_map(config):
    return {k: set(v) for k, v in config["dependencies"].items()}


def sync_historical_state(state):
    historical = load(ROOT / ".scratch/consulta-coerente/implementation-state.json", {}).get("tickets", {})
    for tid, record in historical.items():
        if tid in state["tickets"]:
            continue
        if record.get("acceptance") == "verified_local_demonstration":
            state["tickets"][tid] = {"status": "accepted", "acceptance": "historical_verified_local_demonstration",
                                      "commit": record.get("integration_commit") or record.get("commit"),
                                      "evidence": record.get("verification", {})}
        elif tid == "36" and record.get("static_review", {}).get("status") == "partial_pending_ticket_27":
            state["tickets"][tid] = {"status": "accepted_partial", "acceptance": "documentary_transparency_only",
                                      "commit": "a836616", "pending": ["effective correction intake/tracking depends on ticket 27"]}


def run_next(config, state):
    if state.get("active"):
        print(f"Execução ativa para {state['active']['ticket']}; retome com: python3 tools/ticketctl.py resume")
        return 3
    statuses = state["tickets"]
    deps = dependency_map(config)
    for item in config["queue"]:
        record = statuses.get(item, {})
        if record.get("status") in {"accepted", "accepted_partial", "simulation_only"}:
            continue
        if item in config["phase_profiles"]:
            return run_phase(item, config, state)
        if all(statuses.get(dep, {}).get("status") == "accepted" for dep in deps.get(item, set())):
            fake = argparse.Namespace(ticket=item, scenario="happy")
            return run_ticket(fake, config, state)
    print("Nenhum ticket está pronto; consulte status para dependências e bloqueios.")
    return 3


def choose_profile(config, ticket, phase=None):
    if phase:
        return config["phase_profiles"][phase]
    return config["ticket_profiles"][ticket]


def run_phase(name, config, state):
    allowed = {"reconciliation", "06", "36", "07", "10", "integrated-review"}
    if name not in allowed:
        print(f"Fase desconhecida: {name}")
        return 2
    if state.get("active") and state["active"].get("ticket") != name:
        print("Há outra execução ativa; retome-a antes de iniciar esta fase.")
        return 3
    runid = (state.get("active") or {}).get("run_id") or uuid.uuid4().hex[:12]
    state["active"] = {"ticket": name, "run_id": runid, "phase": "implement"}
    rec = state["tickets"].setdefault(name, {"attempts": 0})
    rec.update(status="running", phase="implement", run_id=runid, attempts=rec.get("attempts", 0) + 1)
    event(state, "phase_start", phase=name, run_id=runid)
    save(STATE, state)
    LOGS.mkdir(parents=True, exist_ok=True)
    log = LOGS / f"phase-{name}-{runid}.log"
    prompt_file = ROOT / ("tools/prompts/reconcile.md" if name == "reconciliation" else "tools/prompts/implement.md")
    if name == "reconciliation":
        prompt = prompt_file.read_text()
    elif name == "integrated-review":
        prompt = render_prompt(ROOT / "tools/prompts/review.md", {
            "ticket": "revisão integrada das fases iniciais", "ticket_file": "tickets originais 06, 07, 10 e 36",
            "logs": json.dumps({key: state["tickets"].get(key, {}) for key in ["reconciliation", "06", "36", "07", "10"]}, ensure_ascii=False)})
    else:
        phase_files = {"06": "06-dois-modos.md", "07": "07-agrupamentos-sobreposicoes.md", "10": "10-consulta-atualizacao-estados.md", "36": "36-documentos-institucionais.md"}
        prompt = render_prompt(prompt_file, {"ticket": name, "ticket_file": ROOT / ".scratch/consulta-coerente/issues" / phase_files[name], "repo": ROOT})
        if name == "07":
            prompt += ("\n\nDiagnóstico atual: os testes direcionados passam para agrupamentos em MapLibre/Leaflet e sobreposições em Leaflet; a seleção MapLibre passa em Chromium, mas no Firefox o clique físico no botão do popup não aciona o handler. A seleção por Enter passa. Investigue e corrija o caminho real de mouse/Firefox sem reduzir a cobertura. Preserve identidade, total, coordenadas antes/depois, seleção de cada item, teclado e lista. Remova toda instrumentação DEBUG temporária e execute as verificações do controlador.\n")
    prior_log = rec.get("executor_log")
    if prior_log:
        prompt += f"\n\nCheckpoint anterior: leia e continue a partir do log {ROOT / prior_log}. Não repita etapas concluídas sem motivo.\n"
    profile = config["phase_profiles"]["integrated_review" if name == "integrated-review" else name]
    code, kind = invoke(config, "executor", profile, prompt, log, ROOT)
    if code:
        kind = classify_cli_failure(log, kind)
        rec.update(status="paused", pause_reason=kind, returncode=code, checkpoint="implement", executor_log=str(log.relative_to(ROOT)))
        event(state, "checkpoint", ticket=name, reason=kind, returncode=code)
        save(STATE, state)
        return code
    if name == "integrated-review":
        result = final_response(log)
        rec["review_log"] = str(log.relative_to(ROOT))
        if result.startswith("REVIEW_ACCEPTED"):
            rec.update(status="accepted", acceptance="integrated_initial_review", commit=None)
            state["active"] = None
            event(state, "accepted", ticket=name, commit=None)
            save(STATE, state)
            print("Revisão integrada inicial aprovada; sem aceite adicional de tickets funcionais.")
            return 0
        rec.update(status="correction_required", correction_rounds=rec.get("correction_rounds", 0))
        save(STATE, state)
        print(f"Revisão integrada encontrou achados; consulte {log}.")
        return 4
    checks = config.get("phase_checks", {}).get(name, [])
    if name == "reconciliation":
        checks = [["bash", "scripts/verify.sh", "planning"], ["git", "diff", "--check"]]
    check_results = []
    for command in checks:
        result, kind = run_command(command, ROOT, log, config["timeout_seconds"])
        check_results.append({"command": command, "returncode": result, "kind": kind})
        if result:
            rec.update(status="paused", pause_reason="verification_failed", checkpoint="verification", verification=check_results)
            state["active"]["phase"] = "verification"
            event(state, "verification_failed", ticket=name, command=command, returncode=result)
            save(STATE, state)
            return result
    rec.update(status="awaiting_review", executor_log=str(log.relative_to(ROOT)), verification=check_results)
    state["active"]["phase"] = "review"
    event(state, "executor_finished", ticket=name, log=str(log.relative_to(ROOT)))
    save(STATE, state)
    print(f"Fase {name} executada; verificações passaram. Execute review {name} para revisão independente.")
    return 0


def review_phase(name, config, state):
    rec = state["tickets"].get(name, {})
    if not state.get("active") or state["active"].get("ticket") != name or rec.get("status") != "awaiting_review":
        print(f"Fase {name} não está aguardando revisão.")
        return 3
    log = LOGS / f"review-{name}-{state['active']['run_id']}.log"
    ticket_path = config.get("ticket_files", {}).get(name, f"ticket {name}")
    prompt = render_prompt(ROOT / "tools/prompts/review.md", {
        "ticket": name, "ticket_file": ROOT / ("tickets 06, 07, 09, 10, 11, 12 e 36" if name == "reconciliation" else ticket_path),
        "logs": rec.get("executor_log", "") + " " + str(rec.get("verification", []))})
    code, kind = invoke(config, "reviewer", config["review_profile"], prompt, log, ROOT)
    if code:
        rec.update(status="paused", pause_reason=kind, checkpoint="review")
        save(STATE, state)
        return code
    result = final_response(log)
    rec["review_log"] = str(log.relative_to(ROOT))
    if result.startswith("REVIEW_ACCEPTED"):
        if name in config["ticket_profiles"]:
            return commit_ticket(name, config, state, rec)
        rec.update(status="accepted", acceptance="local_documentary_review", commit=None)
        state["active"] = None
        event(state, "accepted", ticket=name, commit=None)
        save(STATE, state)
        print(f"Revisão da fase {name} aprovada; registro documental concluído sem commit isolado.")
        return 0
    rec.update(status="correction_required", correction_rounds=rec.get("correction_rounds", 0))
    save(STATE, state)
    print(f"Revisão da fase {name} requer correção; consulte {log}.")
    return 4


def correct_phase(name, config, state):
    rec = state["tickets"].get(name, {})
    # Revalidate any legacy/provisional acceptance from logs before corrections.
    prior_log = ROOT / rec.get("review_log", "") if rec.get("review_log") else None
    prior = prior_log.read_text(errors="replace") if prior_log and prior_log.exists() else ""
    final_start = prior.rfind("\ncodex\n")
    prior_final = prior[final_start + len("\ncodex\n"):] if final_start >= 0 else ""
    prior_final = prior_final.split("\ntokens used", 1)[0].strip()
    if rec.get("status") == "accepted" and not prior_final.startswith("REVIEW_ACCEPTED"):
        rec["status"] = "correction_required"
        state["active"] = {"ticket": name, "run_id": rec.get("run_id"), "phase": "review"}
    if not state.get("active") or state["active"].get("ticket") != name or rec.get("status") != "correction_required":
        print(f"Fase {name} não tem achados aguardando correção.")
        return 3
    rounds = rec.get("correction_rounds", 0)
    if rounds >= 2:
        rec.update(status="blocked", pause_reason="correction_limit")
        save(STATE, state)
        print(f"Fase {name} bloqueada após duas rodadas de correção.")
        return 3
    runid = state["active"]["run_id"]
    review_log = ROOT / rec["review_log"]
    findings = review_log.read_text(errors="replace") if review_log.exists() else "Log de revisão ausente."
    prompt = ("Corrija somente os achados concretos da revisão independente abaixo. Preserve trabalho existente, não marque critérios como aceitos sem evidência e não faça commit. "
              "Reexecute apenas verificações afetadas e descreva arquivos alterados e resultados.\n\nACHADOS:\n" + findings)
    log = LOGS / f"correction-{name}-{runid}-{rounds + 1}.log"
    profile = (config["phase_profiles"].get("reconciliation" if name == "reconciliation" else name)
               or config["ticket_profiles"].get(name))
    if not profile:
        print(f"Perfil de correção não configurado para {name}.")
        return 3
    code, kind = invoke(config, "executor", profile, prompt, log, ROOT)
    rec["correction_rounds"] = rounds + 1
    if code:
        rec.update(status="paused", pause_reason=kind, checkpoint="correction")
        save(STATE, state)
        return code
    commands = ([["bash", "scripts/verify.sh", "planning"], ["git", "diff", "--check"]]
                if name == "reconciliation" else config.get("ticket_checks", {}).get(name, []))
    results = []
    for command in commands:
        result, kind = run_command(command, ROOT, log, config["timeout_seconds"])
        results.append({"command": command, "returncode": result, "kind": kind})
        if result:
            rec.update(status="paused", pause_reason="verification_failed", checkpoint="verification", verification=results)
            save(STATE, state)
            return result
    rec.update(status="awaiting_review", verification=results, correction_log=str(log.relative_to(ROOT)))
    state["active"]["phase"] = "review"
    save(STATE, state)
    print(f"Correção rodada {rounds + 1} concluída; rode review {name}.")
    return 0


def verify_ticket(name, config, state):
    rec = state["tickets"].get(name, {})
    if not state.get("active") or state["active"].get("ticket") != name or rec.get("status") not in {"awaiting_verification", "paused"}:
        print(f"Ticket {name} não está aguardando verificação.")
        return 3
    checks = config.get("ticket_checks", {}).get(name, [])
    if not checks:
        rec.update(status="blocked", pause_reason="checks_missing", checkpoint="verification")
        save(STATE, state)
        print(f"Ticket {name} sem comandos de verificação configurados; aceite bloqueado.")
        return 3
    runid = state["active"]["run_id"]
    log = LOGS / f"verify-{name}-{runid}.log"
    results = []
    for command in checks:
        code, kind = run_command(command, ROOT, log, config["timeout_seconds"])
        results.append({"command": command, "returncode": code, "kind": kind})
        rec["verification"] = results
        save(STATE, state)
        if code:
            rec.update(status="paused", pause_reason="verification_failed", returncode=code, checkpoint="verification",
                       verification_log=str(log.relative_to(ROOT)))
            state["active"]["phase"] = "verification"
            event(state, "verification_failed", ticket=name, command=command, returncode=code)
            save(STATE, state)
            print(f"Verificação falhou ({kind}, código {code}); checkpoint: {log}")
            return code
    rec.update(status="awaiting_review", verification_log=str(log.relative_to(ROOT)))
    state["active"]["phase"] = "review"
    save(STATE, state)
    print(f"Verificações de {name} passaram; execute review {name}.")
    return 0


def run_ticket(args, config, state, *, simulated=False):
    tid = ticket_id(args.ticket)
    profiles = config["profiles"]
    deps = dependency_map(config).get(tid, set())
    statuses = state["tickets"]
    blocked = [d for d in sorted(deps) if statuses.get(d, {}).get("status") != "accepted"]
    if simulated and args.scenario == "dependency-blocked":
        blocked = sorted(deps)
    if blocked and (not simulated or args.scenario == "dependency-blocked"):
        print(f"Ticket {tid} bloqueado por dependências não aceitas: {', '.join(blocked)}")
        statuses[tid] = {"status": "blocked_dependency", "blocked_by": blocked}
        event(state, "dependency_block", ticket=tid, blocked_by=blocked)
        save(STATE, state)
        return 3
    if state.get("active") and state["active"].get("ticket") != tid:
        print("Há uma execução ativa; retome-a antes de iniciar outra.")
        return 3
    active = state.get("active") or {}
    runid = active.get("run_id") or uuid.uuid4().hex[:12]
    record = statuses.setdefault(tid, {"status": "queued", "attempts": 0})
    record.setdefault("baseline_worktree", worktree_snapshot())
    record.update({"run_id": runid, "status": "running", "phase": "implement", "attempts": record.get("attempts", 0) + 1})
    state["active"] = {"ticket": tid, "run_id": runid, "phase": "implement"}
    event(state, "ticket_start", ticket=tid, run_id=runid)
    save(STATE, state)
    log = LOGS / f"{tid}-{runid}.log"
    ticket_file = ROOT / config["ticket_files"][tid]
    prompt = render_prompt(ROOT / "tools/prompts/implement.md", {"ticket": tid, "ticket_file": ticket_file, "repo": ROOT})

    if simulated:
        fail = args.scenario == "failure-resume" and record["attempts"] == 1
        (log.parent).mkdir(parents=True, exist_ok=True)
        log.write_text(f"SIMULATED ticket={tid} attempt={record['attempts']} failure={fail}\n")
        if fail:
            record.update(status="paused", pause_reason="simulated_failure", checkpoint="implement")
            state["active"] = {"ticket": tid, "run_id": runid, "phase": "implement"}
            event(state, "checkpoint", ticket=tid, reason="simulated_failure")
            save(STATE, state)
            print(f"Falha simulada; checkpoint salvo. Retome com: python3 tools/ticketctl.py resume")
            return 1
        record.update(status="accepted", acceptance="simulation_only", commit=None, evidence=[])
        state["active"] = None
        event(state, "simulated_acceptance", ticket=tid)
        save(STATE, state)
        print(f"Ticket {tid}: simulação concluída (não é aceite funcional).")
        return 0

    profile = choose_profile(config, tid)
    stages = config.get("ticket_stages", {}).get(tid, [])
    stage_index = record.get("stage_index", 0)
    while stage_index < max(1, len(stages)):
        stage_prompt = prompt
        if stages:
            stage_prompt += (f"\n\nETAPA TÉCNICA {stage_index + 1}/{len(stages)}: {stages[stage_index]}. "
                             "Implemente somente esta etapa, preserve as anteriores e deixe o estado local pronto para a próxima. "
                             "Não declare o ticket aceito até todas as etapas e verificações completas.")
        code, kind = invoke(config, "executor", profile, stage_prompt, log, ROOT)
        if code:
            kind = classify_cli_failure(log, kind)
            record.update(status="paused", pause_reason=kind, returncode=code, checkpoint="implement",
                          stage_index=stage_index, executor_log=str(log.relative_to(ROOT)))
            event(state, "checkpoint", ticket=tid, reason=kind, stage=stage_index + 1, returncode=code,
                  log=str(log.relative_to(ROOT)))
            save(STATE, state)
            print(f"Executor parou ({kind}, código {code}); checkpoint da etapa {stage_index + 1} e log salvos em {log}.")
            return code
        stage_index += 1
        record.update(stage_index=stage_index, checkpoint="implement")
        save(STATE, state)
    record.update(status="awaiting_verification", executor_log=str(log.relative_to(ROOT)))
    state["active"]["phase"] = "verification"
    record["phase"] = "verification"
    event(state, "executor_finished", ticket=tid, log=str(log.relative_to(ROOT)))
    save(STATE, state)
    return verify_ticket(tid, config, state)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=["status", "simulate", "run", "next", "phase", "verify", "review", "correct", "resume", "models"])
    parser.add_argument("ticket", nargs="?")
    parser.add_argument("--scenario", choices=["happy", "failure-resume", "dependency-blocked"], default="happy")
    parser.add_argument("--ticket", dest="resume_ticket")
    args = parser.parse_args()
    global STATE
    if args.command == "simulate" or os.environ.get("TICKETCTL_SIMULATE") == "1":
        STATE = ROOT / ".scratch/consulta-coerente/controller-simulation-state.json"
        if args.command == "simulate" and args.scenario != "failure-resume":
            STATE.unlink(missing_ok=True)
    config = load(CONFIG, {})
    state = load(STATE, defaults(config))
    if (args.command == "simulate" and args.scenario == "failure-resume"
            and not (state.get("active") or {}).get("ticket") == ticket_id(args.ticket or "12")):
        state = defaults(config)
    sync_historical_state(state)
    if args.command == "models":
        print(json.dumps(check_models(config), indent=2, ensure_ascii=False))
        return 0
    if args.command == "status":
        print(json.dumps(state, indent=2, ensure_ascii=False))
        return 0
    if args.command == "next":
        with LOCK.open("w") as lock:
            try:
                fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            except BlockingIOError:
                print("Outro controlador está executando um ticket.")
                return 3
            return run_next(config, state)
    if args.command in {"phase", "verify", "review", "correct"}:
        if not args.ticket:
            parser.error("fase é obrigatória")
        with LOCK.open("w") as lock:
            try:
                fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            except BlockingIOError:
                print("Outro controlador está executando um ticket.")
                return 3
            if args.command == "phase":
                return run_phase(args.ticket, config, state)
            if args.command == "verify":
                return verify_ticket(args.ticket, config, state)
            if args.command == "review":
                return review_phase(args.ticket, config, state)
            return correct_phase(args.ticket, config, state)
    if args.command in {"run", "simulate"}:
        if not args.ticket:
            parser.error("ticket é obrigatório")
        if args.command == "simulate" and args.scenario == "dependency-blocked":
            args.ticket = "12"
        if args.command == "simulate" and args.scenario != "dependency-blocked":
            # Simulation validates control flow without pretending historical work was accepted.
            state["tickets"].setdefault("02", {"status": "accepted", "acceptance": "simulation_fixture"})
            state["tickets"].setdefault("04", {"status": "accepted", "acceptance": "simulation_fixture"})
            state["tickets"].setdefault("05", {"status": "accepted", "acceptance": "simulation_fixture"})
        lockfile = LOCK
        lockfile.parent.mkdir(parents=True, exist_ok=True)
        with lockfile.open("w") as lock:
            try:
                fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            except BlockingIOError:
                print("Outro controlador está executando um ticket.")
                return 3
            return run_ticket(args, config, state, simulated=args.command == "simulate")
    if args.command == "resume":
        active = state.get("active")
        tid = args.resume_ticket or (active or {}).get("ticket")
        if not tid:
            print("Não há checkpoint retomável.")
            return 3
        tid = ticket_id(tid)
        if not active or active.get("ticket") != tid:
            print(f"Ticket {tid} não tem checkpoint ativo.")
            return 3
        if tid in config["phase_profiles"]:
            with LOCK.open("w") as lock:
                fcntl.flock(lock, fcntl.LOCK_EX)
                return run_phase(tid, config, state)
        record = state["tickets"].get(tid, {})
        if record.get("checkpoint") == "verification":
            return verify_ticket(tid, config, state)
        state["tickets"].setdefault(tid, {})["status"] = "queued"
        # A simulation failure is resumed explicitly as a clean subsequent attempt.
        active["phase"] = "implement"
        fake = argparse.Namespace(ticket=tid, scenario="failure-resume")
        with LOCK.open("w") as lock:
            fcntl.flock(lock, fcntl.LOCK_EX)
            simulated = (STATE == ROOT / ".scratch/consulta-coerente/controller-simulation-state.json"
                         or os.environ.get("TICKETCTL_SIMULATE") == "1")
            return run_ticket(fake, config, state, simulated=simulated)


if __name__ == "__main__":
    sys.exit(main())
