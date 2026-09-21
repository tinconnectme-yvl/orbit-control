"""
Dynamic events and Chaos Monkey fault injection router.
Fulfills Hackathon Criteria O2, O7, T3.
"""
import json
import uuid
from typing import Dict, Any, Optional
from fastapi import APIRouter, HTTPException

from ..config import EXAMPLES_DIR
from ..models.schemas import DynamicEventRequest
from .session import get_session

router = APIRouter(prefix="/api/events", tags=["Events & Chaos Monkey"])

@router.get("/demo_list")
def get_demo_events():
    """Retrieve official demo events from examples/events_demo.json."""
    demo_file = EXAMPLES_DIR / "events_demo.json"
    if not demo_file.exists():
        raise HTTPException(status_code=404, detail="Demo events file not found")
    return json.loads(demo_file.read_text(encoding="utf-8"))

@router.post("/session/{session_id}/apply")
def apply_event(session_id: str, req: DynamicEventRequest):
    """
    Apply a dynamic event at the current step of the session.
    Supported types: 'add_jobs', 'satellite_outage', 'close_downlink'.
    """
    session = get_session(session_id)
    k = session.current_step
    
    event_id = req.id or f"EV-{uuid.uuid4().hex[:6].upper()}"
    event_dict: Dict[str, Any] = {
        "id": event_id,
        "at_step": k,
        "type": req.type
    }
    
    if req.type == "add_jobs":
        if not req.jobs:
            raise HTTPException(status_code=400, detail="'add_jobs' requires non-empty jobs list")
        # Ensure release_step >= k
        for j in req.jobs:
            if j.get("release_step", k) < k:
                j["release_step"] = k
        event_dict["jobs"] = req.jobs
    elif req.type in ("satellite_outage", "close_downlink"):
        if not req.satellite_ids:
            raise HTTPException(status_code=400, detail=f"'{req.type}' requires satellite_ids list")
        end = req.end_step or min(session.total_steps, k + 12)
        if end <= k:
            raise HTTPException(status_code=400, detail=f"end_step ({end}) must be > current step ({k})")
        event_dict["satellite_ids"] = req.satellite_ids
        event_dict["end_step"] = end
    else:
        raise HTTPException(status_code=400, detail=f"Unsupported event type: {req.type}")
        
    try:
        session.apply_event(event_dict)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to apply event: {str(e)}")
        
    return {
        "status": "success",
        "event_applied": event_dict,
        "current_step": session.current_step,
        "message": f"Событие {event_id} успешно применено на шаге {k}."
    }

@router.post("/session/{session_id}/chaos_monkey")
def trigger_chaos_monkey(session_id: str, fault_type: str = "outage"):
    """
    One-click Chaos Monkey fault injector for Live Demo!
    - 'outage': randomly disables an active satellite for 16 steps (80 mins)
    - 'close_downlink': temporarily closes ground station for top satellites for 12 steps (60 mins)
    - 'emergency_jobs': injects 3 high-value priority 3 urgent jobs
    """
    session = get_session(session_id)
    k = session.current_step
    env = session.session.env
    total_steps = session.total_steps
    
    if k >= total_steps - 5:
        raise HTTPException(status_code=400, detail="Cannot trigger Chaos Monkey at end of scenario")
        
    if fault_type == "outage":
        # Pick first available satellite
        avail = [sid for sid in env.sats if env.available(sid)]
        target = avail[0] if avail else "S01"
        end_step = min(total_steps, k + 16)
        ev = {
            "id": f"CHAOS-FAIL-{target}",
            "at_step": k,
            "type": "satellite_outage",
            "satellite_ids": [target],
            "end_step": end_step
        }
        session.apply_event(ev)
        return {
            "status": "success",
            "fault": "satellite_outage",
            "message": f"🚨 CHAOS MONKEY: Спутник {target} выведен из строя с шага {k} по {end_step} (на {end_step-k} шагов)!",
            "event": ev
        }
        
    elif fault_type == "close_downlink":
        all_sats = list(env.sats.keys())
        end_step = min(total_steps, k + 12)
        ev = {
            "id": f"CHAOS-DOWNLINK-CLOSE",
            "at_step": k,
            "type": "close_downlink",
            "satellite_ids": all_sats,
            "end_step": end_step
        }
        session.apply_event(ev)
        return {
            "status": "success",
            "fault": "close_downlink",
            "message": f"📡 CHAOS MONKEY: Пункт приема данных на Землю закрыт для всей группировки с шага {k} по {end_step}!",
            "event": ev
        }
        
    elif fault_type == "emergency_jobs":
        sats = list(env.sats.keys())[:3]
        jobs = [
            {
                "id": f"EMERG-P3-{k}-1",
                "kind": "relay",
                "release_step": k,
                "deadline_step": min(total_steps, k + 10),
                "work_steps": 2,
                "eligible_satellites": sats,
                "priority": 3,
                "value_usd": 150.0
            },
            {
                "id": f"EMERG-P3-{k}-2",
                "kind": "downlink",
                "release_step": k,
                "deadline_step": min(total_steps, k + 14),
                "work_steps": 1,
                "eligible_satellites": [sats[0]],
                "priority": 3,
                "value_usd": 200.0
            }
        ]
        ev = {
            "id": f"CHAOS-EMERG-JOBS-{k}",
            "at_step": k,
            "type": "add_jobs",
            "jobs": jobs
        }
        session.apply_event(ev)
        return {
            "status": "success",
            "fault": "add_jobs",
            "message": f"⚡ CHAOS MONKEY: Поступили 2 экстренные заявки наивысшего приоритета P3 ($350 USD)!",
            "event": ev
        }
    else:
        raise HTTPException(status_code=400, detail=f"Unknown fault type: {fault_type}")
