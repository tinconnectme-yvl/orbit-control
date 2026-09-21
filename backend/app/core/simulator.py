"""
Simulator integration wrapping official model/operations.py and model/resource_env.py.
Provides complete encapsulation of Constellation sessions, state histories,
and bit-exact validation.
"""
import sys
import copy
import uuid
from typing import Dict, Any, List, Optional
from pathlib import Path

from ..config import MODEL_DIR

# Ensure CaseInfo1/model is in sys.path
if str(MODEL_DIR) not in sys.path:
    sys.path.insert(0, str(MODEL_DIR))

try:
    from operations import Session, replay_episode, RESULT_SCHEMA
    from resource_env import load, validate
except ImportError as e:
    raise ImportError(f"Could not load official models from {MODEL_DIR}: {e}")

class ConstellationSession:
    """High-level wrapper around the official Session with enhanced telemetry tracking."""
    
    def __init__(self, scenario: Dict[str, Any], goal: str = "priority", 
                 algorithm: str = "vector_smart", session_id: Optional[str] = None):
        self.session_id = session_id or str(uuid.uuid4())[:8]
        self.goal = goal
        self.algorithm = algorithm
        self.scenario = copy.deepcopy(scenario)
        
        self.metadata = {
            "session_id": self.session_id,
            "goal": self.goal,
            "algorithm": self.algorithm,
            "version": "1.0",
            "team": "Team Я - Vector"
        }
        
        self.session = Session(self.scenario, run_metadata=self.metadata)
        self.grid_history: List[Dict[str, str]] = [] # step -> {sid: action_string}
        self.telemetry_history: Dict[str, List[Dict[str, Any]]] = {
            sid: [] for sid in self.session.env.sats
        }
        
        # Record step 0 initial telemetry
        self._record_initial_telemetry()
        
    def _record_initial_telemetry(self):
        obs = self.session.observation()
        k = obs['step']
        for sid, st in obs['state'].items():
            cap = self.session.env.sats[sid]['capacity_wh']
            self.telemetry_history[sid].append({
                "step": k,
                "energy_wh": round(st['energy_wh'], 4),
                "soc_pct": round(100.0 * st['energy_wh'] / cap, 2),
                "temp_c": round(st['temp_c'], 2),
                "calibration_age": st['calibration_age_steps'],
                "action": "init",
                "solar_w": self.session.env.s['environment'][sid]['solar_w'][k] if k < self.session.env.s['time']['steps'] else 0.0
            })
            
    @property
    def current_step(self) -> int:
        return self.session.env.k
        
    @property
    def total_steps(self) -> int:
        return self.session.env.s['time']['steps']
        
    @property
    def is_finished(self) -> bool:
        return self.session.env.k >= self.total_steps

    def observation(self) -> Dict[str, Any]:
        return self.session.observation()

    def advance(self, actions: Dict[str, Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Advance by one step with actions dictionary and record telemetry."""
        k = self.session.env.k
        rows = self.session.advance(actions)
        
        # Record grid history
        step_grid = {}
        for r in rows:
            sid = r['satellite_id']
            act = r['executed']
            if act == 'job':
                # find job kind
                req = r['requested']
                jid = req.get('job_id', '')
                job = self.session.env.jobs.get(jid)
                kind = job['kind'] if job else 'job'
                step_grid[sid] = f"{kind}:{jid}"
            else:
                step_grid[sid] = act
                
            cap = self.session.env.sats[sid]['capacity_wh']
            self.telemetry_history[sid].append({
                "step": k + 1,
                "energy_wh": round(r['energy_after_wh'], 4),
                "soc_pct": round(100.0 * r['energy_after_wh'] / cap, 2),
                "temp_c": round(r['temp_after_c'], 2),
                "calibration_age": r['calibration_age_steps'],
                "action": r['executed'],
                "solar_w": r['solar_w'],
                "load_w": r['load_w'],
                "completed_job": r['completed_job']
            })
            
        self.grid_history.append(step_grid)
        return rows

    def apply_event(self, event: Dict[str, Any]) -> None:
        """Inject a dynamic event at the current step."""
        self.session.apply_event(event)

    def summary(self) -> Dict[str, Any]:
        return self.session.summary()

    def result(self) -> Dict[str, Any]:
        return self.session.result()

    def fork(self, new_session_id: Optional[str] = None) -> "ConstellationSession":
        """Create an independent copy for What-If branching."""
        forked = ConstellationSession.__new__(ConstellationSession)
        forked.session_id = new_session_id or f"{self.session_id}_fork"
        forked.goal = self.goal
        forked.algorithm = self.algorithm
        forked.scenario = copy.deepcopy(self.scenario)
        forked.metadata = copy.deepcopy(self.metadata)
        forked.metadata["session_id"] = forked.session_id
        forked.metadata["forked_from"] = self.session_id
        forked.metadata["fork_step"] = self.current_step
        
        forked.session = self.session.fork()
        forked.session.run_metadata = forked.metadata
        forked.grid_history = copy.deepcopy(self.grid_history)
        forked.telemetry_history = copy.deepcopy(self.telemetry_history)
        return forked
