"""
Explainable AI diagnostics router.
Exposes root-cause explanations for dropped, delayed, and unserved jobs.
Fulfills Hackathon Criterion O3.
"""
from typing import List, Dict, Any
from fastapi import APIRouter, HTTPException

from .session import get_session
from ..core.diagnostics import diagnose_all_jobs
from ..core.simulator import ConstellationSession
from ..planners.dispatcher import get_planner
from ..models.schemas import JobDiagnostic

router = APIRouter(prefix="/api/diagnostics", tags=["Explainable AI Diagnostics"])

@router.get("/session/{session_id}")
def get_diagnostics(session_id: str, at_step: int | None = None):
    """
    Get detailed root-cause diagnoses for all jobs in the given session.
    """
    base = get_session(session_id)
    target_step = base.current_step if at_step is None else max(0, min(base.total_steps, at_step))
    session = ConstellationSession(
        scenario=base.scenario,
        goal=base.goal,
        algorithm=base.algorithm,
        session_id=f"{base.session_id}_diagnostic"
    )
    events_by_step = {}
    for event in base.session.events:
        events_by_step.setdefault(event['at_step'], []).append(event)
    planner = get_planner(base.algorithm, base.goal)
    while session.current_step < target_step:
        for event in events_by_step.get(session.current_step, []):
            session.apply_event(event)
        session.advance(planner.plan_step(session, session.current_step))
    for event in events_by_step.get(session.current_step, []):
        session.apply_event(event)

    diagnostics = diagnose_all_jobs(session)
    injected_ids = {
        job['id']
        for event in base.session.events if event['type'] == 'add_jobs'
        for job in event.get('jobs', [])
    }
    for diagnostic in diagnostics:
        diagnostic['is_injected'] = diagnostic['job_id'] in injected_ids
    status_order = {'in_progress': 0, 'active_waiting': 1, 'pending': 2, 'completed': 3, 'missed': 4, 'unfeasible': 5, 'future': 6}
    diagnostics.sort(key=lambda item: (
        0 if item['is_injected'] else 1,
        status_order.get(item['status'], 9),
        -item['priority'],
        item['deadline_step']
    ))
    
    # Summary stats
    unfeasible_count = sum(1 for d in diagnostics if d['status'] == 'unfeasible')
    completed_count = sum(1 for d in diagnostics if d['status'] == 'completed')
    missed_count = sum(1 for d in diagnostics if d['status'] == 'missed')
    in_progress_count = sum(1 for d in diagnostics if d['status'] == 'in_progress')
    
    return {
        "session_id": session_id,
        "step": session.current_step,
        "counts": {
            "total": len(diagnostics),
            "completed": completed_count,
            "missed": missed_count,
            "unfeasible": unfeasible_count,
            "in_progress": in_progress_count
        },
        "diagnostics": diagnostics
    }
