"""
Baseline Greedy Earliest Deadline First (EDF) constellation planner.
Provides a clear, simple reference rule for reproducible benchmarking (Criterion T4, O1).
"""
from typing import Dict, Any, Set
from .base import BasePlanner

class BaselineEDFPlanner(BasePlanner):
    """
    Standard naive greedy scheduler:
    - Sorts active jobs by deadline_step ascending (or priority if tied).
    - Assigns jobs to first feasible satellite.
    - Calibrates reactively only when calibration age >= 47.
    - Does not prune unfeasible jobs or optimize solar charging windows.
    """
    
    def plan_step(self, session, step: int) -> Dict[str, Dict[str, Any]]:
        env = session.session.env
        obs = session.observation()
        actions = {}
        assigned_jobs: Set[str] = set()
        downlink_count = 0
        
        # 1. Reactive calibration only at age >= 47
        for sid, st in obs['state'].items():
            if not obs['available'][sid]:
                continue
            if st['calibration_age_steps'] >= 47:
                ok, _, _ = env.can_execute(sid, {'action': 'calibrate'})
                if ok:
                    actions[sid] = {'action': 'calibrate'}
                    
        # 2. Collect candidate jobs
        active_jobs = [
            j for j in obs['jobs'].values()
            if j['release_step'] <= step < j['deadline_step']
            and j['completed_step'] is None
            and j['remaining_steps'] > 0
        ]
        
        if self.goal == "priority":
            # Priority first, then deadline
            active_jobs.sort(key=lambda j: (-j['priority'], j['deadline_step'], -j['value_usd']))
        else:
            # Deadline first, then value
            active_jobs.sort(key=lambda j: (j['deadline_step'], -j['value_usd'], -j['priority']))
            
        # 3. Naive greedy matching
        for j in active_jobs:
            if j['id'] in assigned_jobs:
                continue
            if j['kind'] == 'downlink' and downlink_count >= env.s['model']['downlink_parallel_limit']:
                continue
                
            for sid in j['eligible_satellites']:
                if sid in actions:
                    continue
                ok, _, _ = env.can_execute(sid, {'action': 'job', 'job_id': j['id']})
                if ok:
                    actions[sid] = {'action': 'job', 'job_id': j['id']}
                    assigned_jobs.add(j['id'])
                    if j['kind'] == 'downlink':
                        downlink_count += 1
                    break
                    
        return actions
