"""
What-If Branching and Strategy Comparison Router.
Fulfills Hackathon Criteria O4, T4, O1.
"""
from typing import Dict, Any, Optional
from fastapi import APIRouter, HTTPException

from ..models.schemas import CompareBranchesRequest
from .session import get_session, SESSIONS, PLANNERS
from ..planners.dispatcher import get_planner
from ..core.simulator import ConstellationSession

router = APIRouter(prefix="/api/compare", tags=["What-If Comparison"])

@router.post("/branches")
def compare_branches(req: CompareBranchesRequest):
    """
    Fork an existing session at its current step into two independent branches
    and run them to completion to compare strategies (e.g. Priority vs Commercial, or Smart vs Baseline).
    """
    base_session = get_session(req.base_session_id)
    fork_step = base_session.current_step if req.fork_step is None else max(0, min(base_session.total_steps, req.fork_step))

    source = ConstellationSession(
        scenario=base_session.scenario,
        goal=base_session.goal,
        algorithm=base_session.algorithm,
        session_id=f"{base_session.session_id}_at_{fork_step}"
    )
    events_by_step = {}
    for event in base_session.session.events:
        events_by_step.setdefault(event['at_step'], []).append(event)
    source_planner = get_planner(source.algorithm, source.goal)
    while source.current_step < fork_step:
        for event in events_by_step.get(source.current_step, []):
            source.apply_event(event)
        source.advance(source_planner.plan_step(source, source.current_step))
    for event in events_by_step.get(source.current_step, []):
        source.apply_event(event)
    
    # Create two independent forks
    branch_a = source.fork(new_session_id=f"{base_session.session_id}_branch_a_{fork_step}")
    branch_a.goal = req.branch_a_goal
    branch_a.algorithm = req.branch_a_algorithm
    planner_a = get_planner(req.branch_a_algorithm, req.branch_a_goal)
    
    branch_b = source.fork(new_session_id=f"{base_session.session_id}_branch_b_{fork_step}")
    branch_b.goal = req.branch_b_goal
    branch_b.algorithm = req.branch_b_algorithm
    planner_b = get_planner(req.branch_b_algorithm, req.branch_b_goal)
    
    # Run Branch A to completion
    while not branch_a.is_finished:
        actions_a = planner_a.plan_step(branch_a, branch_a.current_step)
        branch_a.advance(actions_a)
        
    # Run Branch B to completion
    while not branch_b.is_finished:
        actions_b = planner_b.plan_step(branch_b, branch_b.current_step)
        branch_b.advance(actions_b)
        
    sum_a = branch_a.summary()
    sum_b = branch_b.summary()
    
    delta = {
        "revenue_usd": round(sum_a["revenue_usd"] - sum_b["revenue_usd"], 2),
        "critical_p3_jobs": sum_a["critical_jobs_completed_on_time"] - sum_b["critical_jobs_completed_on_time"],
        "jobs_completed": sum_a["jobs_completed"] - sum_b["jobs_completed"],
        "min_soc_pct": round(sum_a["minimum_soc_pct"] - sum_b["minimum_soc_pct"], 2),
        "wasted_work_steps": sum_a["work_steps_in_missed_jobs"] - sum_b["work_steps_in_missed_jobs"]
    }
    
    # Store forked sessions in memory so operator can inspect or switch to them
    SESSIONS[branch_a.session_id] = branch_a
    PLANNERS[branch_a.session_id] = planner_a
    SESSIONS[branch_b.session_id] = branch_b
    PLANNERS[branch_b.session_id] = planner_b
    
    # Build explanatory conclusion
    conclusions = []
    if delta["critical_p3_jobs"] > 0:
        conclusions.append(f"Ветвь А спасает на {delta['critical_p3_jobs']} критических задач (P3) больше.")
    elif delta["critical_p3_jobs"] < 0:
        conclusions.append(f"Ветвь B спасает на {abs(delta['critical_p3_jobs'])} критических задач (P3) больше.")
        
    if delta["revenue_usd"] > 0:
        conclusions.append(f"Ветвь А приносит на ${delta['revenue_usd']:,.2f} USD больше выручки.")
    elif delta["revenue_usd"] < 0:
        conclusions.append(f"Ветвь B приносит на ${abs(delta['revenue_usd']):,.2f} USD больше выручки.")
        
    if delta["wasted_work_steps"] < 0:
        conclusions.append(f"Ветвь А экономит {abs(delta['wasted_work_steps'])} шагов энергии, потраченных впустую на незавершенные задания.")
    elif delta["wasted_work_steps"] > 0:
        conclusions.append(f"Ветвь B экономит {delta['wasted_work_steps']} шагов энергии, потраченных впустую.")

    if not conclusions:
        conclusions.append("Результаты обеих ветвей сопоставимы по ключевым показателям.")
        
    return {
        "fork_step": fork_step,
        "branch_a": {
            "session_id": branch_a.session_id,
            "goal": req.branch_a_goal,
            "algorithm": req.branch_a_algorithm,
            "summary": sum_a
        },
        "branch_b": {
            "session_id": branch_b.session_id,
            "goal": req.branch_b_goal,
            "algorithm": req.branch_b_algorithm,
            "summary": sum_b
        },
        "delta": delta,
        "conclusions": conclusions
    }
