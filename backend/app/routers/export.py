"""
Export and Verification router.
Handles cosmo-B-ops-result-1.0 generation, HTML printable reports,
and bit-exact validation via operations.py.
Fulfills Hackathon Criteria T1, T6, O7.
"""
import json
from typing import Dict, Any
from fastapi import APIRouter, HTTPException, Response, Body
from fastapi.responses import HTMLResponse

from .session import get_session
from ..core.reporter import validate_result_object, generate_printable_html_report

router = APIRouter(prefix="/api/export", tags=["Export & Verification"])

@router.get("/session/{session_id}/json")
def export_session_json(session_id: str):
    """
    Export execution history in strict cosmo-B-ops-result-1.0 schema format.
    Can be verified directly with `python model/operations.py --result <file>`.
    """
    session = get_session(session_id)
    result = session.result()
    content = json.dumps(result, ensure_ascii=False, indent=2)
    return Response(
        content=content,
        media_type="application/json",
        headers={
            "Content-Disposition": f"attachment; filename=result_{session.scenario['meta']['id']}_{session_id}.json"
        }
    )

@router.get("/session/{session_id}/report", response_class=HTMLResponse)
def export_printable_report(session_id: str):
    """Generate printable HTML summary report for shift briefing."""
    session = get_session(session_id)
    html = generate_printable_html_report(session)
    return HTMLResponse(content=html)

@router.post("/verify")
def verify_result_json(result_data: Dict[str, Any] = Body(...)):
    """
    Verify any cosmo-B-ops-result-1.0 JSON payload using official operations.py replay verification.
    """
    try:
        is_valid, msg, summary = validate_result_object(result_data)
        return {
            "is_valid": is_valid,
            "message": msg,
            "summary": summary
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid payload: {str(e)}")
