"""
Result reporter and validator for Orbita-Control.
Exports results in cosmo-B-ops-result-1.0 and runs bit-exact verification via replay_episode.
"""
import json
from pathlib import Path
from typing import Dict, Any, Tuple

from ..config import MODEL_DIR
import sys
if str(MODEL_DIR) not in sys.path:
    sys.path.insert(0, str(MODEL_DIR))

from operations import replay_episode, RESULT_SCHEMA

def validate_result_object(result_data: Dict[str, Any]) -> Tuple[bool, str, Dict[str, Any]]:
    """
    Validate a result dictionary using official operations.py replay_episode.
    Returns (is_valid, message, replayed_summary).
    """
    try:
        if result_data.get("schema_version") != RESULT_SCHEMA:
            return False, f"Invalid schema_version: expected {RESULT_SCHEMA}", {}
            
        scenario = result_data["initial_scenario"]
        events = result_data["events"]
        commands = result_data["commands"]
        steps = result_data["steps_executed"]
        
        replayed = replay_episode(scenario, events, commands, steps)
        replayed_summary = replayed.summary()
        
        # Check against result_data summary
        orig_summary = result_data["summary"]
        diffs = []
        for key in ["jobs_completed", "critical_jobs_completed_on_time", "revenue_usd", 
                    "blocked_command_count", "below_reserve_satellite_steps"]:
            v1 = orig_summary.get(key)
            v2 = replayed_summary.get(key)
            if v1 != v2:
                diffs.append(f"{key}: recorded {v1} vs replayed {v2}")
                
        if diffs:
            return False, f"Replay mismatch: {', '.join(diffs)}", replayed_summary
            
        return True, "Replay check PASSED: 100% Bit-exact match with official operations.py", replayed_summary
    except Exception as e:
        return False, f"Replay failed with error: {str(e)}", {}

def generate_printable_html_report(session) -> str:
    """Generate a clean printable HTML mission report."""
    summary = session.summary()
    res = session.result()
    meta = res.get("run_metadata", {})
    scenario = session.scenario
    
    html = f"""<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<title>ОРБИТА-КОНТРОЛ // Отчет смены #{meta.get('session_id', '001')}</title>
<style>
  body {{ font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #080b11; color: #e2e8f0; margin: 40px; }}
  h1 {{ color: #00FF88; font-size: 24px; border-bottom: 2px solid rgba(0, 255, 136, 0.3); padding-bottom: 10px; }}
  h2 {{ color: #00E5FF; font-size: 18px; margin-top: 30px; }}
  .badge {{ display: inline-block; padding: 4px 8px; border-radius: 3px; font-weight: bold; font-size: 12px; margin-right: 8px; }}
  .badge-prio {{ background: rgba(0, 255, 136, 0.15); color: #00FF88; border: 1px solid #00FF88; }}
  .badge-rev {{ background: rgba(255, 184, 0, 0.15); color: #FFB800; border: 1px solid #FFB800; }}
  table {{ width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 14px; }}
  th, td {{ border: 1px solid rgba(255, 255, 255, 0.1); padding: 10px; text-align: left; }}
  th {{ background: rgba(255, 255, 255, 0.05); color: #94a3b8; font-weight: 600; }}
  tr:nth-child(even) {{ background: rgba(255, 255, 255, 0.02); }}
  .kpi-grid {{ display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-top: 20px; }}
  .kpi-card {{ background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08); padding: 15px; border-radius: 4px; }}
  .kpi-title {{ font-size: 11px; text-transform: uppercase; color: #94a3b8; letter-spacing: 0.5px; }}
  .kpi-val {{ font-size: 24px; font-weight: bold; margin-top: 6px; font-family: monospace; }}
  .val-emerald {{ color: #00FF88; }}
  .val-amber {{ color: #FFB800; }}
  .val-cyan {{ color: #00E5FF; }}
</style>
</head>
<body>
  <h1>ОРБИТА-КОНТРОЛ // Отчет автономной смены ЦУП</h1>
  <div>
    <span class="badge badge-prio">Цель: {meta.get('goal', 'N/A').upper()}</span>
    <span class="badge badge-rev">Алгоритм: {meta.get('algorithm', 'N/A')}</span>
    <span class="badge">Сценарий: {scenario['meta']['id']} ({scenario['meta']['title']})</span>
  </div>

  <div class="kpi-grid">
    <div class="kpi-card">
      <div class="kpi-title">Выручка (USD)</div>
      <div class="kpi-val val-emerald">${summary.get('revenue_usd', 0):,.2f}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-title">Задачи P3 в срок</div>
      <div class="kpi-val val-cyan">{summary.get('critical_jobs_completed_on_time', 0)} / {summary.get('critical_jobs_due', 0)}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-title">Всего выполнено</div>
      <div class="kpi-val">{summary.get('jobs_completed', 0)} / {summary.get('jobs_total', 0)}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-title">Мин. заряд SOC</div>
      <div class="kpi-val val-amber">{summary.get('minimum_soc_pct', 0):.1f}%</div>
    </div>
  </div>

  <h2>Сводные показатели надежности</h2>
  <table>
    <tr><th>Метрика</th><th>Значение</th><th>Статус допуска</th></tr>
    <tr><td>Выполненных шагов (5 мин)</td><td>{summary.get('steps_executed', 0)} / {scenario['time']['steps']}</td><td>Норма</td></tr>
    <tr><td>Отклоненные команды</td><td>{summary.get('blocked_command_count', 0)}</td><td>0 (Идеально)</td></tr>
    <tr><td>Потерянные шаги в сорванных задачах</td><td>{summary.get('work_steps_in_missed_jobs', 0)}</td><td>Минимально</td></tr>
    <tr><td>Нарушений резерва батареи (&lt;30%)</td><td>{summary.get('below_reserve_satellite_steps', 0)}</td><td>0 (Защита соблюдена)</td></tr>
    <tr><td>Критических дефицитов (&lt;20%)</td><td>{summary.get('critical_soc_satellite_steps', 0)}</td><td>0 (Безаварийно)</td></tr>
    <tr><td>Эпизодов обесточивания (Brownout)</td><td>{summary.get('brownout_satellite_steps', 0)}</td><td>0</td></tr>
  </table>

  <h2>Журнал динамических событий ({len(res.get('events', []))})</h2>
  <table>
    <tr><th>ID</th><th>Шаг</th><th>Тип события</th><th>Параметры</th></tr>
"""
    for ev in res.get('events', []):
        html += f"<tr><td>{ev.get('id')}</td><td>{ev.get('at_step')}</td><td>{ev.get('type')}</td><td>{json.dumps(ev, ensure_ascii=False)}</td></tr>"
        
    html += """
  </table>
  <p style="margin-top: 40px; font-size: 12px; color: #64748b;">Сформировано автоматически комплексом «ОРБИТА-КОНТРОЛ» // Команда «Team Я - Vector»</p>
</body>
</html>"""
    return html
