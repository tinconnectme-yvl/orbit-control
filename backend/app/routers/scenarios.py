"""
Scenarios router: list, view, and customize initial operating scenarios.
"""
import json
import copy
from typing import List, Dict, Any
from pathlib import Path
from fastapi import APIRouter, HTTPException

from ..config import DATA_DIR
from ..models.schemas import ScenarioSummary, CustomScenarioRequest

router = APIRouter(prefix="/api/scenarios", tags=["Scenarios"])

# Cache for custom/modified scenarios in memory
CUSTOM_SCENARIOS: Dict[str, Dict[str, Any]] = {}

def get_scenario_dict(scenario_id: str) -> Dict[str, Any]:
    if scenario_id in CUSTOM_SCENARIOS:
        return copy.deepcopy(CUSTOM_SCENARIOS[scenario_id])
    
    file_path = DATA_DIR / f"{scenario_id}.json"
    if not file_path.exists():
        # Try matching without extension or case-insensitive
        matches = list(DATA_DIR.glob(f"{scenario_id}*.json"))
        if matches:
            file_path = matches[0]
        else:
            raise HTTPException(status_code=404, detail=f"Scenario '{scenario_id}' not found")
            
    try:
        return json.loads(file_path.read_text(encoding="utf-8"))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read scenario: {str(e)}")

@router.get("", response_model=List[ScenarioSummary])
def list_scenarios():
    """List all available predefined and custom scenarios."""
    scenarios = []
    
    # Predefined files
    for file in sorted(DATA_DIR.glob("*.json")):
        try:
            data = json.loads(file.read_text(encoding="utf-8"))
            meta = data.get("meta", {})
            time_sec = data.get("time", {})
            steps = time_sec.get("steps", 0)
            jobs = data.get("jobs", [])
            p3_count = sum(1 for j in jobs if j.get("priority") == 3)
            total_val = sum(j.get("value_usd", 0) for j in jobs)
            
            scenarios.append(ScenarioSummary(
                id=file.stem,
                title=meta.get("title", file.stem),
                steps=steps,
                duration_hours=round(steps * 300 / 3600, 1),
                satellite_count=len(data.get("satellites", [])),
                job_count=len(jobs),
                critical_job_count=p3_count,
                total_value_usd=round(total_val, 2),
                failure_count=len(data.get("failures", []))
            ))
        except Exception:
            continue
            
    # Add custom scenarios
    for sid, data in CUSTOM_SCENARIOS.items():
        meta = data.get("meta", {})
        steps = data.get("time", {}).get("steps", 0)
        jobs = data.get("jobs", [])
        scenarios.append(ScenarioSummary(
            id=sid,
            title=meta.get("title", sid),
            steps=steps,
            duration_hours=round(steps * 300 / 3600, 1),
            satellite_count=len(data.get("satellites", [])),
            job_count=len(jobs),
            critical_job_count=sum(1 for j in jobs if j.get("priority") == 3),
            total_value_usd=round(sum(j.get("value_usd", 0) for j in jobs), 2),
            failure_count=len(data.get("failures", []))
        ))
        
    return scenarios

@router.get("/{scenario_id}")
def get_scenario_details(scenario_id: str):
    """Get full scenario details for inspector or preview."""
    data = get_scenario_dict(scenario_id)
    # Return compact summary and structures
    return {
        "meta": data.get("meta"),
        "time": data.get("time"),
        "satellites": data.get("satellites"),
        "model": data.get("model"),
        "jobs_summary": {
            "total": len(data.get("jobs", [])),
            "priority_3": sum(1 for j in data.get("jobs", []) if j.get("priority") == 3),
            "priority_2": sum(1 for j in data.get("jobs", []) if j.get("priority") == 2),
            "priority_1": sum(1 for j in data.get("jobs", []) if j.get("priority") == 1),
            "downlink": sum(1 for j in data.get("jobs", []) if j.get("kind") == "downlink"),
            "relay": sum(1 for j in data.get("jobs", []) if j.get("kind") == "relay"),
            "total_value_usd": round(sum(j.get("value_usd", 0) for j in data.get("jobs", [])), 2)
        },
        "failures": data.get("failures")
    }

@router.post("/custom")
def create_custom_scenario(req: CustomScenarioRequest):
    """Create a customized scenario variant with adjusted parameters."""
    base = get_scenario_dict(req.base_scenario_id)
    new_scenario = copy.deepcopy(base)
    
    new_id = f"{req.base_scenario_id}_mod_{len(CUSTOM_SCENARIOS) + 1}"
    new_scenario["meta"]["id"] = new_id
    new_scenario["meta"]["title"] = req.new_title or f"{base['meta'].get('title')} (Кастом)"
    
    # Adjust initial SOC
    if req.initial_soc_adjustments:
        for sat in new_scenario["satellites"]:
            if sat["id"] in req.initial_soc_adjustments:
                sat["initial_soc_pct"] = max(0.0, min(100.0, req.initial_soc_adjustments[sat["id"]]))
                
    # Adjust solar multiplier
    if req.solar_multiplier and req.solar_multiplier != 1.0:
        mult = max(0.0, req.solar_multiplier)
        for sid, env in new_scenario["environment"].items():
            env["solar_w"] = [round(w * mult, 4) for w in env.get("solar_w", [])]
            
    # Adjust job priorities
    if req.job_priority_adjustments:
        for j in new_scenario["jobs"]:
            if j["id"] in req.job_priority_adjustments:
                j["priority"] = int(req.job_priority_adjustments[j["id"]])
                
    # Custom failures
    if req.custom_failures:
        new_scenario["failures"].extend(req.custom_failures)
        
    CUSTOM_SCENARIOS[new_id] = new_scenario
    return {
        "status": "success",
        "scenario_id": new_id,
        "title": new_scenario["meta"]["title"],
        "message": "Custom scenario created successfully"
    }
