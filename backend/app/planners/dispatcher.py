"""
Planner dispatcher factory.
"""
from typing import Dict, Any
from .base import BasePlanner
from .baseline import BaselineEDFPlanner
from .vector_smart import VectorSmartPlanner

def get_planner(name: str = "vector_smart", goal: str = "priority", 
                auto_prune_unfeasible: bool = True) -> BasePlanner:
    if name == "baseline":
        return BaselineEDFPlanner(goal=goal, auto_prune_unfeasible=False)
    else:
        return VectorSmartPlanner(goal=goal, auto_prune_unfeasible=auto_prune_unfeasible)
