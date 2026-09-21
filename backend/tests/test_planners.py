"""
Automated tests for Vector Smart Planner vs Baseline Planner (Criteria T2, T4).
"""
import sys
import unittest
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
PROJECT_ROOT = BACKEND_DIR.parent
sys.path.insert(0, str(PROJECT_ROOT / "CaseInfo1" / "model"))
sys.path.insert(0, str(BACKEND_DIR))

from resource_env import load
from app.core.simulator import ConstellationSession
from app.planners.dispatcher import get_planner

class TestPlanners(unittest.TestCase):
    def test_p01_smart_planner_zero_wasted_steps(self):
        scenario = load(PROJECT_ROOT / "CaseInfo1" / "data" / "P01_intro.json")
        session = ConstellationSession(scenario, goal="priority", algorithm="vector_smart")
        planner = get_planner("vector_smart", "priority", auto_prune_unfeasible=True)
        
        while not session.is_finished:
            actions = planner.plan_step(session, session.current_step)
            session.advance(actions)
            
        summary = session.summary()
        self.assertEqual(summary['steps_executed'], 48)
        self.assertEqual(summary['jobs_completed'], 11) # All feasible jobs in P01!
        self.assertEqual(summary['blocked_command_count'], 0)
        self.assertEqual(summary['below_reserve_satellite_steps'], 0)
        self.assertEqual(summary['brownout_satellite_steps'], 0)
        self.assertEqual(summary['work_steps_in_missed_jobs'], 0) # 0 wasted steps!

    def test_smart_beats_baseline_on_missed_work_and_safety(self):
        scenario = load(PROJECT_ROOT / "CaseInfo1" / "data" / "P01_intro.json")
        
        # Run Baseline
        session_base = ConstellationSession(scenario, goal="priority", algorithm="baseline")
        planner_base = get_planner("baseline", "priority")
        while not session_base.is_finished:
            actions = planner_base.plan_step(session_base, session_base.current_step)
            session_base.advance(actions)
        sum_base = session_base.summary()
        
        # Run Smart
        session_smart = ConstellationSession(scenario, goal="priority", algorithm="vector_smart")
        planner_smart = get_planner("vector_smart", "priority")
        while not session_smart.is_finished:
            actions = planner_smart.plan_step(session_smart, session_smart.current_step)
            session_smart.advance(actions)
        sum_smart = session_smart.summary()
        
        # Baseline wastes work steps on unfeasible jobs
        self.assertGreater(sum_base['work_steps_in_missed_jobs'], 0)
        # Smart wastes 0 work steps
        self.assertEqual(sum_smart['work_steps_in_missed_jobs'], 0)
        # Smart maintains a higher minimum battery SOC
        self.assertGreater(sum_smart['minimum_soc_pct'], sum_base['minimum_soc_pct'])

if __name__ == '__main__':
    unittest.main()
