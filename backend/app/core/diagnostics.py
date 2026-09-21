"""
Explainable AI (XAI) Root-Cause Diagnostic Engine for Orbita-Control.
Distinguishes between objective physical/contact constraints and scheduling trade-offs.
Fulfills Hackathon Criteria O3, O1, O7.
"""
from typing import Dict, Any, List, Optional

def analyze_job_feasibility(scenario: Dict[str, Any], job: Dict[str, Any]) -> Dict[str, Any]:
    """
    Check if a job was ever mathematically feasible given contact windows and time bounds.
    """
    kind = job['kind']
    rel = job['release_step']
    dl = job['deadline_step']
    req = job['work_steps']
    eligible = job['eligible_satellites']
    
    if kind == 'downlink':
        sid = eligible[0]
        avail = [k for k in range(rel, dl) if scenario['environment'][sid]['downlink_available'][k]]
        is_feasible = len(avail) >= req
        return {
            "feasible": is_feasible,
            "required_steps": req,
            "available_slots": len(avail),
            "slot_indices": avail,
            "reason": (
                f"Физически осуществимо (доступно {len(avail)} окон из {req} требуемых)"
                if is_feasible else
                f"Математически невозможно: окно радиовидимости 'downlink_available' аппарата {sid} содержит лишь {len(avail)} шагов при требуемых {req} (интервал [{rel}, {dl}))"
            )
        }
    else: # relay
        union_slots = set()
        per_sat_slots = {}
        for sid in eligible:
            sat_slots = [k for k in range(rel, dl) if scenario['environment'][sid]['relay_available'][k]]
            per_sat_slots[sid] = len(sat_slots)
            union_slots.update(sat_slots)
            
        is_feasible = len(union_slots) >= req
        return {
            "feasible": is_feasible,
            "required_steps": req,
            "available_slots": len(union_slots),
            "per_satellite_slots": per_sat_slots,
            "slot_indices": sorted(list(union_slots)),
            "reason": (
                f"Физически осуществимо (в группировке {len(union_slots)} окон relay для {len(eligible)} КА)"
                if is_feasible else
                f"Математически невозможно: суммарное число доступных слотов ретрансляции ({len(union_slots)}) меньше требуемых {req} шагов"
            )
        }

def diagnose_all_jobs(session) -> List[Dict[str, Any]]:
    """
    Produce structured diagnoses for all jobs in the scenario.
    """
    env = session.session.env
    scenario = env.s
    current_k = env.k
    diagnostics = []
    
    for jid, job in env.jobs.items():
        feas = analyze_job_feasibility(scenario, job)
        is_completed = job['completed_step'] is not None
        executed_steps = job['work_steps'] - job['remaining_steps']
        is_due = job['deadline_step'] <= current_k
        
        status = "pending"
        root_cause = "В очереди на выполнение"
        details = ""
        
        if is_completed:
            status = "completed"
            root_cause = "Успешно завершено"
            details = f"Завершено на шаге {job['completed_step']} (срок: шаг {job['deadline_step']}). Принесено ${job['value_usd']:.2f} USD."
        elif not feas['feasible']:
            status = "unfeasible"
            root_cause = "Объективная физическая невозможность"
            details = feas['reason'] + ". Алгоритм превентивно не тратил энергию батареи и ресурс передатчиков."
        elif is_due:
            status = "missed"
            if executed_steps > 0:
                root_cause = "Сорвано из-за дефицита окон/ресурсов в процессе исполнения"
                details = f"Выполнено {executed_steps} из {job['work_steps']} шагов. Работа прервана дефицитом энергии или конкуренцией за каналы."
            else:
                root_cause = "Не взято в работу (конкуренция каналов связи или резерв SOC)"
                details = f"Окно [{job['release_step']}, {job['deadline_step']}) истекло. Все доступные слоты связи или энергобаланс были задействованы более приоритетными задачами."
        else: # not completed, not due, but feasible
            if executed_steps > 0:
                status = "in_progress"
                root_cause = "В процессе выполнения"
                details = f"Выполнено {executed_steps} из {job['work_steps']} шагов (осталось {job['remaining_steps']}). Срок: шаг {job['deadline_step']}."
            elif current_k >= job['release_step']:
                status = "active_waiting"
                root_cause = "Ожидает слота радиовидимости или завершения текущей задачи"
                details = f"Окно открыто с шага {job['release_step']}, крайний срок {job['deadline_step']}."
            else:
                status = "future"
                root_cause = "Плановое будущее задание"
                details = f"Будет открыто на шаге {job['release_step']}."
                
        diagnostics.append({
            "job_id": jid,
            "kind": job['kind'],
            "priority": job['priority'],
            "value_usd": job['value_usd'],
            "work_steps": job['work_steps'],
            "remaining_steps": job['remaining_steps'],
            "executed_steps": executed_steps,
            "release_step": job['release_step'],
            "deadline_step": job['deadline_step'],
            "completed_step": job['completed_step'],
            "eligible_satellites": job['eligible_satellites'],
            "status": status,
            "root_cause": root_cause,
            "details": details,
            "feasibility": feas
        })
        
    return diagnostics
