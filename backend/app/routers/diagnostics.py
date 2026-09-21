"""
Explainable AI diagnostics router.
Exposes root-cause explanations for dropped, delayed, and unserved jobs.
Fulfills Hackathon Criterion O3.
"""
from typing import List, Dict, Any
from fastapi import APIRouter, HTTPException

from .session import get_session
from ..core.diagnostics import diagnose_all_jobs
from ..models.schemas import JobDiagnostic

router = APIRouter(prefix="/api/diagnostics", tags=["Explainable AI Diagnostics"])

@router.get("/session/{session_id}")
def get_diagnostics(session_id: str):
    """
    Get detailed root-cause diagnoses for all jobs in the given session.
    """
    session = get_session(session_id)
    diagnostics = diagnose_all_jobs(session)
    
    # Summary stats
    unfeasible_count = sum(1 for d in diagnostics if d['status'] == 'unfeasible')
    completed_count = sum(1 for d in diagnostics if d['status'] == 'completed')
    missed_count = sum(1 for d in diagnostics if d['status'] == 'missed')
    in_progress_count = sum(1 for d in diagnostics if d['status'] == 'in_progress')
    
    return {
        "session_id": session_id,
        "step": session.current_step,
        "counts": {
            "total": len(diagnostics),
            "completed": completed_count,
            "missed": missed_count,
            "unfeasible": unfeasible_count,
            "in_progress": in_progress_count
        },
        "diagnostics": diagnostics
    }
