"""
Pydantic data schemas for Orbita-Control API.
"""
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field

class SatelliteInfo(BaseModel):
    id: str
    capacity_wh: float
    initial_soc_pct: float
    initial_temp_c: float
    base_w: float
    heater_w: float
    calibration_w: float
    downlink_w: float
    relay_w: float
    initial_calibration_age_steps: int

class ScenarioSummary(BaseModel):
    id: str
    title: str
    steps: int
    duration_hours: float
    satellite_count: int
    job_count: int
    critical_job_count: int
    total_value_usd: float
    failure_count: int

class CustomScenarioRequest(BaseModel):
    base_scenario_id: str
    new_title: Optional[str] = None
    initial_soc_adjustments: Optional[Dict[str, float]] = None # {sid: new_soc_pct}
    solar_multiplier: Optional[float] = 1.0
    job_priority_adjustments: Optional[Dict[str, int]] = None # {job_id: new_prio}
    custom_failures: Optional[List[Dict[str, Any]]] = None

class CreateSessionRequest(BaseModel):
    scenario_id: str
    goal: str = Field(default="priority", description="'priority' or 'revenue'")
    algorithm: str = Field(default="vector_smart", description="'vector_smart' or 'baseline'")
    auto_prune_unfeasible: bool = True

class StepRequest(BaseModel):
    steps_count: int = Field(default=1, description="Number of steps to advance (1..288)")
    target_step: Optional[int] = Field(default=None, description="Run until target step")

class DynamicEventRequest(BaseModel):
    id: Optional[str] = None
    type: str # 'add_jobs', 'satellite_outage', 'close_downlink'
    satellite_ids: Optional[List[str]] = None
    end_step: Optional[int] = None
    jobs: Optional[List[Dict[str, Any]]] = None

class ActionCommand(BaseModel):
    action: str # 'idle', 'calibrate', 'job'
    job_id: Optional[str] = None

class SatelliteStateTelemetry(BaseModel):
    id: str
    energy_wh: float
    capacity_wh: float
    soc_pct: float
    temp_c: float
    calibration_age_steps: int
    available: bool
    current_action: str
    active_job_id: Optional[str] = None
    solar_w: float
    load_w: float

class SessionStateResponse(BaseModel):
    session_id: str
    scenario_id: str
    step: int
    total_steps: int
    goal: str
    algorithm: str
    summary: Dict[str, Any]
    satellites: List[SatelliteStateTelemetry]
    recent_trace: List[Dict[str, Any]]
    events_applied: List[Dict[str, Any]]
    active_jobs_count: int
    completed_jobs_count: int
    missed_jobs_count: int

class CompareBranchesRequest(BaseModel):
    base_session_id: str
    fork_step: Optional[int] = None
    branch_a_goal: str = "priority"
    branch_a_algorithm: str = "vector_smart"
    branch_b_goal: str = "revenue"
    branch_b_algorithm: str = "vector_smart"

class JobDiagnostic(BaseModel):
    job_id: str
    kind: str
    priority: int
    value_usd: float
    work_steps: int
    release_step: int
    deadline_step: int
    completed_step: Optional[int]
    status: str # 'completed', 'missed', 'in_progress', 'pending', 'unfeasible'
    root_cause: Optional[str] = None
    details: Optional[str] = None
    executed_steps: int = 0
