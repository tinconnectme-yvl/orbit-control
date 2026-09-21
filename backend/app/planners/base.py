"""
Base abstract class for constellation planners.
"""
from abc import ABC, abstractmethod
from typing import Dict, Any

class BasePlanner(ABC):
    def __init__(self, goal: str = "priority", auto_prune_unfeasible: bool = True):
        self.goal = goal # "priority" or "revenue"
        self.auto_prune_unfeasible = auto_prune_unfeasible
        
    @abstractmethod
    def plan_step(self, session, step: int) -> Dict[str, Dict[str, Any]]:
        """
        Decide actions for all satellites at given step.
        Returns mapping: {satellite_id: {"action": "idle"|"calibrate"|"job", "job_id": ...}}
        """
        pass
