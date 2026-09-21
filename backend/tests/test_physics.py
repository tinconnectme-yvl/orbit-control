"""
Automated tests for simulator physics and constraints compliance (Criterion T1).
"""
import sys
import unittest
from pathlib import Path

# Add app and model to path
BACKEND_DIR = Path(__file__).resolve().parent.parent
PROJECT_ROOT = BACKEND_DIR.parent
sys.path.insert(0, str(PROJECT_ROOT / "CaseInfo1" / "model"))
sys.path.insert(0, str(BACKEND_DIR))

from resource_env import load
from operations import Session

class TestSimulatorPhysics(unittest.TestCase):
    def setUp(self):
        self.scenario = load(PROJECT_ROOT / "CaseInfo1" / "data" / "P01_intro.json")
        self.session = Session(self.scenario)

    def test_initial_state(self):
        obs = self.session.observation()
        self.assertEqual(obs['step'], 0)
        self.assertEqual(len(obs['state']), 16)
        for sid, st in obs['state'].items():
            self.assertGreater(st['energy_wh'], 0)
            self.assertGreater(st['temp_c'], 0)

    def test_cannot_execute_with_low_soc(self):
        # Force satellite S01 energy below 30% reserve
        sid = "S01"
        sat_cap = self.session.env.sats[sid]['capacity_wh']
        self.session.env.state[sid]['energy_wh'] = sat_cap * 0.25 # 25% < 30%
        
        ok, reason, _ = self.session.env.can_execute(sid, {'action': 'calibrate'})
        self.assertFalse(ok)
        self.assertEqual(reason, 'energy_reserve')

    def test_downlink_concurrency_limit(self):
        # Step with 3 downlinks requested simultaneously
        # Library must allow only at most 2, rejecting the 3rd
        k = self.session.env.k
        downlink_jobs = [j for j in self.session.env.jobs.values() if j['kind'] == 'downlink']
        
        actions = {}
        count = 0
        for j in downlink_jobs:
            sid = j['eligible_satellites'][0]
            ok, _, _ = self.session.env.can_execute(sid, {'action': 'job', 'job_id': j['id']})
            if ok:
                actions[sid] = {'action': 'job', 'job_id': j['id']}
                count += 1
                if count >= 3:
                    break
                    
        rows = self.session.advance(actions)
        executed_downlinks = sum(
            1 for r in rows if r['executed'] == 'job' and self.session.env.jobs[r['requested']['job_id']]['kind'] == 'downlink'
        )
        self.assertLessEqual(executed_downlinks, 2)

    def test_calibration_resets_age(self):
        sid = "S04"
        self.session.env.state[sid]['calibration_age_steps'] = 30
        ok, _, _ = self.session.env.can_execute(sid, {'action': 'calibrate'})
        self.assertTrue(ok)
        
        self.session.advance({sid: {'action': 'calibrate'}})
        self.assertEqual(self.session.env.state[sid]['calibration_age_steps'], 0)

if __name__ == '__main__':
    unittest.main()
