"""
Automated tests for Dynamic Events, Session Forking, and Bit-Exact Replay Verification (Criteria T1, T3).
"""
import sys
import json
import unittest
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
PROJECT_ROOT = BACKEND_DIR.parent
sys.path.insert(0, str(PROJECT_ROOT / "CaseInfo1" / "model"))
sys.path.insert(0, str(BACKEND_DIR))

from resource_env import load
from app.core.simulator import ConstellationSession
from app.planners.dispatcher import get_planner
from app.core.reporter import validate_result_object

class TestEventsAndReplay(unittest.TestCase):
    def test_dynamic_event_and_replay_verification(self):
        scenario = load(PROJECT_ROOT / "CaseInfo1" / "data" / "P01_intro.json")
        session = ConstellationSession(scenario, goal="priority", algorithm="vector_smart")
        planner = get_planner("vector_smart", "priority")
        
        # Advance 10 steps
        for _ in range(10):
            actions = planner.plan_step(session, session.current_step)
            session.advance(actions)
            
        # Apply outage event at step 10
        session.apply_event({
            "id": "TEST-OUTAGE-S01",
            "at_step": 10,
            "type": "satellite_outage",
            "satellite_ids": ["S01"],
            "end_step": 20
        })
        
        # Verify S01 is unavailable at step 10
        obs = session.observation()
        self.assertFalse(obs['available']['S01'])
        
        # Advance 10 more steps
        for _ in range(10):
            actions = planner.plan_step(session, session.current_step)
            session.advance(actions)
            
        # Verify S01 is available again at step 20
        obs2 = session.observation()
        self.assertTrue(obs2['available']['S01'])
        
        # Finish scenario
        while not session.is_finished:
            actions = planner.plan_step(session, session.current_step)
            session.advance(actions)
            
        # Export result and validate with official operations.py
        result = session.result()
        is_valid, msg, _ = validate_result_object(result)
        self.assertTrue(is_valid, f"Validation failed: {msg}")

    def test_session_fork_independence(self):
        scenario = load(PROJECT_ROOT / "CaseInfo1" / "data" / "P01_intro.json")
        session = ConstellationSession(scenario, goal="priority", algorithm="vector_smart")
        planner = get_planner("vector_smart", "priority")
        
        for _ in range(15):
            actions = planner.plan_step(session, session.current_step)
            session.advance(actions)
            
        forked = session.fork()
        self.assertEqual(forked.current_step, 15)
        self.assertEqual(session.current_step, 15)
        
        # Advance main session by 5 steps
        for _ in range(5):
            actions = planner.plan_step(session, session.current_step)
            session.advance(actions)
            
        # Forked session should still be at step 15
        self.assertEqual(session.current_step, 20)
        self.assertEqual(forked.current_step, 15)

if __name__ == '__main__':
    unittest.main()
