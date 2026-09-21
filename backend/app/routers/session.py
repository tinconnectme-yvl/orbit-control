"""
Session management router: create, step, run, and inspect constellation sessions.
"""
import copy
from typing import Dict, Any, Optional
from fastapi import APIRouter, HTTPException

from ..models.schemas import (
    CreateSessionRequest, StepRequest, SessionStateResponse, SatelliteStateTelemetry
)
from ..core.simulator import ConstellationSession
from ..planners.dispatcher import get_planner
from .scenarios import get_scenario_dict

router = APIRouter(prefix="/api/session", tags=["Session"])

# Global session database in memory
SESSIONS: Dict[str, ConstellationSession] = {}
PLANNERS: Dict[str, Any] = {}

def get_session(session_id: str) -> ConstellationSession:
    if session_id not in SESSIONS:
        raise HTTPException(status_code=404, detail=f"Session '{session_id}' not found")
    return SESSIONS[session_id]

@router.post("/create")
def create_session(req: CreateSessionRequest):
    """Create a new constellation simulation session."""
    scenario = get_scenario_dict(req.scenario_id)
    session = ConstellationSession(
        scenario=scenario,
        goal=req.goal,
        algorithm=req.algorithm
    )
    planner = get_planner(
        name=req.algorithm,
        goal=req.goal,
        auto_prune_unfeasible=req.auto_prune_unfeasible
    )
    
    SESSIONS[session.session_id] = session
    PLANNERS[session.session_id] = planner
    
    return {
        "status": "success",
        "session_id": session.session_id,
        "scenario_id": req.scenario_id,
        "goal": req.goal,
        "algorithm": req.algorithm,
        "total_steps": session.total_steps
    }

@router.get("/{session_id}/state")
def get_session_state(session_id: str):
    """Retrieve full operational telemetry and state of the session."""
    session = get_session(session_id)
    obs = session.observation()
    env = session.session.env
    k = env.k
    summary = session.summary()
    
    satellites = []
    for sid in sorted(env.sats.keys()):
        v = env.sats[sid]
        st = obs['state'][sid]
        cap = v['capacity_wh']
        solar = env.s['environment'][sid]['solar_w'][k] if k < session.total_steps else 0.0
        
        # Check current action from recent trace or idle
        recent_act = "idle"
        active_job = None
        if session.grid_history and k > 0:
            last_grid = session.grid_history[-1]
            act_str = last_grid.get(sid, "idle")
            if ":" in act_str:
                recent_act, active_job = act_str.split(":", 1)
            else:
                recent_act = act_str

        heater = v['heater_w'] if st['temp_c'] < env.s['model']['heater_below_c'] else 0.0
        payload_w = (
            v['downlink_w'] if 'downlink' in recent_act
            else (v['relay_w'] if 'relay' in recent_act
            else (v['calibration_w'] if 'calibrate' in recent_act else 0.0))
        )
        total_load_w = v['base_w'] + heater + payload_w
                
        satellites.append(SatelliteStateTelemetry(
            id=sid,
            energy_wh=round(st['energy_wh'], 4),
            capacity_wh=cap,
            soc_pct=round(100.0 * st['energy_wh'] / cap, 2),
            temp_c=round(st['temp_c'], 2),
            calibration_age_steps=st['calibration_age_steps'],
            available=obs['available'][sid],
            current_action=recent_act,
            active_job_id=active_job,
            solar_w=round(solar, 2),
            load_w=round(total_load_w, 2)
        ))
        
    # Active jobs count
    active_jobs = [
        j for j in env.jobs.values()
        if j['release_step'] <= k < j['deadline_step']
        and j['completed_step'] is None
        and j['remaining_steps'] > 0
    ]
    
    completed = [j for j in env.jobs.values() if j['completed_step'] is not None]
    missed = [j for j in env.jobs.values() if j['deadline_step'] <= k and j['completed_step'] is None]
    
    return {
        "session_id": session_id,
        "scenario_id": session.scenario["meta"]["id"],
        "scenario_title": session.scenario["meta"].get("title", ""),
        "step": k,
        "total_steps": session.total_steps,
        "goal": session.goal,
        "algorithm": session.algorithm,
        "is_finished": session.is_finished,
        "summary": summary,
        "satellites": satellites,
        "events_applied": session.session.events,
        "active_jobs_count": len(active_jobs),
        "completed_jobs_count": len(completed),
        "missed_jobs_count": len(missed),
        "recent_trace": env.trace[-len(env.sats):] if env.trace else [],
        "grid_history": session.grid_history
    }

@router.get("/{session_id}/satellite/{satellite_id}/telemetry")
def get_satellite_telemetry(session_id: str, satellite_id: str):
    """Get time-series telemetry curve for a specific satellite."""
    session = get_session(session_id)
    if satellite_id not in session.telemetry_history:
        raise HTTPException(status_code=404, detail=f"Satellite '{satellite_id}' not found")
        
    sat_def = session.session.env.sats[satellite_id]
    model_params = session.session.env.s['model']
    
    return {
        "session_id": session_id,
        "satellite_id": satellite_id,
        "capacity_wh": sat_def['capacity_wh'],
        "reserve_soc_pct": model_params['reserve_soc_pct'],
        "critical_soc_pct": model_params['critical_soc_pct'],
        "payload_min_c": model_params['payload_min_c'],
        "payload_max_c": model_params['payload_max_c'],
        "calibration_valid_steps": model_params['calibration_valid_steps'],
        "history": session.telemetry_history[satellite_id]
    }

@router.post("/{session_id}/step")
def advance_step(session_id: str, req: StepRequest):
    """Advance simulation by 1 or more steps."""
    session = get_session(session_id)
    planner = PLANNERS.get(session_id)
    if not planner:
        planner = get_planner(session.algorithm, session.goal)
        PLANNERS[session_id] = planner
        
    steps_to_run = req.steps_count
    if req.target_step is not None:
        steps_to_run = max(0, req.target_step - session.current_step)
        
    steps_executed = 0
    while not session.is_finished and steps_executed < steps_to_run:
        actions = planner.plan_step(session, session.current_step)
        session.advance(actions)
        steps_executed += 1
        
    return {
        "status": "success",
        "steps_advanced": steps_executed,
        "current_step": session.current_step,
        "total_steps": session.total_steps,
        "is_finished": session.is_finished,
        "summary": session.summary()
    }

@router.post("/{session_id}/run_to_end")
def run_to_end(session_id: str):
    """Run all remaining steps to completion in high-speed mode."""
    session = get_session(session_id)
    planner = PLANNERS.get(session_id)
    if not planner:
        planner = get_planner(session.algorithm, session.goal)
        PLANNERS[session_id] = planner
        
    start_step = session.current_step
    while not session.is_finished:
        actions = planner.plan_step(session, session.current_step)
        session.advance(actions)
        
    return {
        "status": "success",
        "steps_advanced": session.current_step - start_step,
        "current_step": session.current_step,
        "is_finished": True,
        "summary": session.summary()
    }

@router.post("/{session_id}/reset")
def reset_session(session_id: str):
    """Reset session back to step 0 with same scenario and settings."""
    old = get_session(session_id)
    new_session = ConstellationSession(
        scenario=old.scenario,
        goal=old.goal,
        algorithm=old.algorithm,
        session_id=session_id
    )
    SESSIONS[session_id] = new_session
    PLANNERS[session_id] = get_planner(old.algorithm, old.goal)
    return {
        "status": "success",
        "session_id": session_id,
        "current_step": 0,
        "summary": new_session.summary()
    }

@router.get("/{session_id}/timeline")
def get_session_timeline(session_id: str):
    """
    Generate complete 288-step timeline with sub-step data.
    Enables client-side continuous 60 FPS interpolation without network latency.
    """
    base = get_session(session_id)
    sim = ConstellationSession(
        scenario=base.scenario,
        goal=base.goal,
        algorithm=base.algorithm
    )
    for ev in base.session.events:
        sim.apply_event(ev)
        
    planner = get_planner(base.algorithm, base.goal)
    total_steps = sim.total_steps
    step_s = sim.session.env.s['time']['step_s']
    
    steps_data = []
    env = sim.session.env
    
    def capture_step(k, grid=None):
        sum_data = sim.summary()
        sat_list = []
        for sid in sorted(env.sats.keys()):
            v = env.sats[sid]
            st = env.state[sid]
            cap = v['capacity_wh']
            solar = env.s['environment'][sid]['solar_w'][k] if k < total_steps else 0.0
            act_str = grid.get(sid, "idle") if grid else "idle"
            act_type = act_str.split(":", 1)[0] if ":" in act_str else act_str
            job_id = act_str.split(":", 1)[1] if ":" in act_str else None
            
            heater = v['heater_w'] if st['temp_c'] < env.s['model']['heater_below_c'] else 0.0
            payload_w = (
                v['downlink_w'] if 'downlink' in act_type
                else (v['relay_w'] if 'relay' in act_type
                else (v['calibration_w'] if 'calibrate' in act_type else 0.0))
            )
            total_load_w = v['base_w'] + heater + payload_w
            
            sat_list.append({
                "id": sid,
                "soc_pct": round(100.0 * st['energy_wh'] / cap, 2),
                "temp_c": round(st['temp_c'], 2),
                "energy_wh": round(st['energy_wh'], 2),
                "solar_w": round(solar, 2),
                "load_w": round(total_load_w, 2),
                "available": env.available(sid),
                "current_action": act_type,
                "active_job_id": job_id
            })
        return {
            "step": k,
            "time_s": k * step_s,
            "summary": {
                "revenue_usd": round(sum_data.get('revenue_usd', 0.0), 2),
                "completed_jobs": sum_data.get('jobs_completed', 0),
                "jobs_completed": sum_data.get('jobs_completed', 0),
                "missed_jobs": sum_data.get('jobs_due_missed', 0),
                "jobs_due_missed": sum_data.get('jobs_due_missed', 0),
                "work_steps_in_missed_jobs": sum_data.get('work_steps_in_missed_jobs', 0),
                "energy_violations": sum_data.get('below_reserve_satellite_steps', 0),
                "below_reserve_satellite_steps": sum_data.get('below_reserve_satellite_steps', 0),
                "thermal_violations": 0,
                "critical_completed": sum_data.get('critical_jobs_completed_on_time', 0),
                "critical_jobs_completed_on_time": sum_data.get('critical_jobs_completed_on_time', 0),
                "critical_total": sum_data.get('critical_jobs_due', 0),
                "critical_jobs_due": sum_data.get('critical_jobs_due', 0),
                "minimum_soc_pct": min((st['energy_wh'] / env.sats[sid]['capacity_wh'] * 100.0) for sid, st in env.state.items()),
            },
            "satellites": sat_list
        }
        
    steps_data.append(capture_step(0))
    
    while not sim.is_finished:
        k = sim.current_step
        actions = planner.plan_step(sim, k)
        sim.advance(actions)
        last_grid = sim.grid_history[-1] if sim.grid_history else {}
        steps_data.append(capture_step(sim.current_step, last_grid))
        
    return {
        "session_id": session_id,
        "scenario_id": base.scenario["meta"]["id"],
        "total_steps": total_steps,
        "step_s": step_s,
        "horizon_s": total_steps * step_s,
        "steps": steps_data
    }
