"""
End-to-End API and Simulator Verification Script
"""
import sys
import os

# Set UTF-8 output encoding for Windows consoles
if sys.platform.startswith("win"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

from pathlib import Path

# Add backend and CaseInfo1 to sys.path
TEST_DIR = Path(__file__).resolve().parent
BACKEND_DIR = TEST_DIR.parent
REPO_ROOT = BACKEND_DIR.parent
sys.path.insert(0, str(BACKEND_DIR))
sys.path.insert(0, str(REPO_ROOT / "CaseInfo1" / "model"))

from fastapi.testclient import TestClient
from app.main import app

def test_full_pipeline():
    client = TestClient(app)
    
    print("1. Health check:")
    r = client.get("/api/health")
    assert r.status_code == 200, f"Health check failed: {r.text}"
    print("   [OK] Health check passed:", r.json())
    
    print("2. Scenarios list:")
    r = client.get("/api/scenarios")
    assert r.status_code == 200
    scenarios = r.json()
    assert len(scenarios) >= 4
    print(f"   [OK] Scenarios found ({len(scenarios)}): {[s['id'] for s in scenarios]}")
    
    print("3. Create session with P01_intro:")
    r = client.post("/api/session/create", json={
        "scenario_id": "P01_intro",
        "goal": "priority",
        "algorithm": "vector_smart",
        "auto_prune_unfeasible": True
    })
    assert r.status_code == 200
    res = r.json()
    session_id = res["session_id"]
    print(f"   [OK] Session created: {session_id}")
    
    print("4. Advance 10 steps:")
    r = client.post(f"/api/session/{session_id}/step", json={"steps_count": 10})
    assert r.status_code == 200
    print(f"   [OK] Advanced to step {r.json()['current_step']}")
    
    print("5. Trigger Chaos Monkey (satellite outage on S02):")
    r = client.post(f"/api/events/session/{session_id}/chaos_monkey?fault_type=outage")
    assert r.status_code == 200
    print(f"   [OK] Chaos Monkey applied: {r.json()['message']}")
    
    print("6. Run to end:")
    r = client.post(f"/api/session/{session_id}/run_to_end")
    assert r.status_code == 200
    sum_data = r.json()["summary"]
    print(f"   [OK] Run to end completed: {sum_data['jobs_completed']} jobs, ${sum_data['revenue_usd']} revenue")
    
    print("7. What-If Comparison from this session:")
    r = client.post("/api/compare/branches", json={
        "base_session_id": session_id,
        "branch_a_goal": "priority",
        "branch_a_algorithm": "vector_smart",
        "branch_b_goal": "revenue",
        "branch_b_algorithm": "baseline"
    })
    assert r.status_code == 200
    comp = r.json()
    print(f"   [OK] What-If comparison delta: {comp['delta']}")
    print(f"   [OK] Conclusions: {comp['conclusions']}")
    
    print("8. Explainable AI Diagnostics:")
    r = client.get(f"/api/diagnostics/session/{session_id}")
    assert r.status_code == 200
    diag = r.json()
    print(f"   [OK] Diagnostics counts: {diag['counts']}")
    assert diag['counts']['unfeasible'] == 7, "Must correctly identify all 7 inherently unfeasible jobs in P01!"
    print("   [OK] 7 inherently unfeasible jobs proven mathematically!")
    
    print("9. Export cosmo-B-ops-result-1.0 JSON & HTML:")
    r_json = client.get(f"/api/export/session/{session_id}/json")
    assert r_json.status_code == 200
    exported_data = r_json.json()
    assert exported_data["schema_version"] == "cosmo-B-ops-result-1.0"
    print("   [OK] JSON export schema valid: cosmo-B-ops-result-1.0")
    
    r_report = client.get(f"/api/export/session/{session_id}/report")
    assert r_report.status_code == 200
    assert "ОРБИТА-КОНТРОЛ" in r_report.text
    print("   [OK] HTML printable report generated successfully")
    
    print("10. Official operations.py replay verification:")
    from app.core.reporter import validate_result_object
    is_valid, msg, _ = validate_result_object(exported_data)
    assert is_valid, f"Replay failed: {msg}"
    print(f"   [OK] {msg}")
    
    print("11. Frontend static SPA serving check:")
    r_fe = client.get("/")
    assert r_fe.status_code == 200
    assert "ОРБИТА-КОНТРОЛ" in r_fe.text
    print("   [OK] Frontend SPA index.html served at root '/' successfully")
    
    print("\nALL 11 END-TO-END VERIFICATION CHECKS PASSED WITH 100% SUCCESS!")

if __name__ == "__main__":
    test_full_pipeline()
