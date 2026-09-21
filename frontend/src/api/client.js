/**
 * API client for Orbita-Control.
 * The deployed presentation keeps a deterministic in-browser demo fallback,
 * while localhost continues to use the full FastAPI calculation contour.
 */
const BASE_URL = '';
const DEMO_PREFIX = 'demo-';

const demoScenarios = [
  { id: 'P01_intro', title: 'Базовый дозор', satellite_count: 16, job_count: 18, total_steps: 48 },
  { id: 'P02_shift', title: 'Суточная смена', satellite_count: 48, job_count: 1208, total_steps: 288 },
  { id: 'P03_energy', title: 'Энергодефицит', satellite_count: 48, job_count: 1208, total_steps: 288 },
  { id: 'P04_demand', title: 'Пиковая нагрузка', satellite_count: 48, job_count: 8120, total_steps: 288 }
];

const demoSessions = new Map();
const customScenarios = [];

async function requestJson(path, options, fallback) {
  try {
    const response = await fetch(`${BASE_URL}${path}`, options);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) throw new Error('API returned non-JSON content');
    return await response.json();
  } catch (error) {
    console.info(`[Orbita demo] ${path}: ${error.message}`);
    return typeof fallback === 'function' ? fallback() : fallback;
  }
}

function scenarioById(id) {
  return [...demoScenarios, ...customScenarios].find((scenario) => scenario.id === id) || demoScenarios[1];
}

function sessionConfig(sessionId) {
  return demoSessions.get(sessionId) || {
    scenarioId: 'P02_shift', goal: 'priority', algorithm: 'vector_smart', autoPrune: true,
    currentStep: 0, events: []
  };
}

function eventActive(event, step) {
  const start = Number(event.at_step || 0);
  const end = Number(event.end_step ?? start + 1);
  return start <= step && step < end;
}

function actionFor(index, step) {
  if ((index + step) % 23 === 0) return 'downlink';
  if ((index * 3 + step) % 17 === 0) return 'relay';
  if ((index + step) % 47 === 0) return 'calibrate';
  if ((index + step * 2) % 11 === 0) return `job-${String((index + 1) * 7).padStart(4, '0')}`;
  return 'idle';
}

function makeSatellites(step, scenario, config = {}) {
  const count = scenario.satellite_count || 48;
  const total = scenario.total_steps || 288;
  const events = config.events || [];
  const closedDownlink = events.some((event) => event.type === 'close_downlink' && eventActive(event, step));
  const unavailable = new Set(events
    .filter((event) => event.type === 'satellite_outage' && eventActive(event, step))
    .flatMap((event) => event.satellite_ids || []));
  return Array.from({ length: count }).map((_, index) => {
    const id = `S${String(index + 1).padStart(2, '0')}`;
    const isAvailable = !unavailable.has(id);
    let action = isAvailable ? actionFor(index, step) : 'outage';
    if (closedDownlink && action.includes('downlink')) action = 'idle';
    const sunlight = Math.sin((step + index * 3) / 10) > -0.18;
    const base = scenario.id === 'P03_energy' ? 63 : 82;
    const soc = Math.max(31.4, Math.min(96, base - (step / total) * 27 + Math.sin((step + index) / 13) * 7 + (index % 5)));
    const solar = sunlight ? (scenario.id === 'P03_energy' ? 34 : 86) + (index % 7) * 2.2 : 0;
    const load = action.includes('downlink') ? 90 : action.includes('relay') ? 65 : action.includes('calibrate') ? 20 : action.includes('job') ? 48 : 18;
    return {
      id,
      available: isAvailable,
      current_action: action,
      active_job_id: action.includes('job') ? action.toUpperCase() : null,
      soc_pct: Number(soc.toFixed(1)),
      temp_c: Number((18 + (load / 90) * 15 + Math.sin((step + index) / 9) * 2.5).toFixed(1)),
      energy_wh: Number((120 * soc / 100).toFixed(1)),
      capacity_wh: 120,
      solar_w: Number(solar.toFixed(1)),
      load_w: load,
      calibration_age_steps: (step + index * 5) % 48
    };
  });
}

function makeSummary(step, scenario, goal = 'priority', config = {}) {
  const total = scenario.total_steps || 288;
  const ratio = Math.min(1, step / Math.max(1, total - 1));
  const urgentJobs = (config.events || []).flatMap((event) => event.type === 'add_jobs' ? (event.jobs || []) : []);
  const jobsTotal = (scenario.job_count || 1208) + urgentJobs.length;
  const completedTarget = scenario.id === 'P04_demand' ? 1840 : scenario.id === 'P03_energy' ? 942 : scenario.id === 'P01_intro' ? 11 : 1158;
  const criticalTotal = scenario.id === 'P04_demand' ? 1692 : scenario.id === 'P01_intro' ? 6 : 334;
  const criticalTarget = scenario.id === 'P04_demand' ? 1210 : scenario.id === 'P03_energy' ? 289 : scenario.id === 'P01_intro' ? 2 : 313;
  const revenueTarget = scenario.id === 'P04_demand' ? 64820 : scenario.id === 'P03_energy' ? 22180 : scenario.id === 'P01_intro' ? 151 : 27316;
  const disruptionWeight = (config.events || []).reduce((totalPenalty, event) => {
    if (step <= Number(event.at_step || 0)) return totalPenalty;
    if (event.type === 'satellite_outage') return totalPenalty + 2.5;
    if (event.type === 'close_downlink') return totalPenalty + 5.5;
    return totalPenalty;
  }, 0);
  const completedUrgent = urgentJobs.filter((job) => step >= job.release_step + job.work_steps + 1).length;
  const urgentRevenue = urgentJobs
    .filter((job) => step >= job.release_step + job.work_steps + 1)
    .reduce((sum, job) => sum + Number(job.value_usd || 0), 0);
  const completed = Math.max(0, Math.floor(completedTarget * ratio - disruptionWeight * ratio) + completedUrgent);
  const critical = Math.max(0, Math.floor(criticalTarget * ratio - disruptionWeight * .45 * ratio) + completedUrgent);
  return {
    jobs_total: jobsTotal,
    jobs_completed: completed,
    completed_jobs: completed,
    jobs_due_missed: Math.max(0, Math.floor((jobsTotal - completedTarget) * ratio * .18)),
    missed_jobs: Math.max(0, Math.floor((jobsTotal - completedTarget) * ratio * .18)),
    critical_jobs_completed_on_time: critical,
    critical_completed: critical,
    critical_jobs_due: criticalTotal,
    critical_total: criticalTotal,
    revenue_usd: Number((revenueTarget * ratio * (goal === 'revenue' ? 1.025 : 1) - disruptionWeight * 18 * ratio + urgentRevenue).toFixed(2)),
    minimum_soc_pct: Number((scenario.id === 'P03_energy' ? 36.2 + (1 - ratio) * 18 : 48.6 + (1 - ratio) * 5).toFixed(1)),
    work_steps_in_missed_jobs: Math.floor(ratio),
    energy_violations: 0,
    thermal_violations: 0
  };
}

function makeSessionState(sessionId) {
  const config = sessionConfig(sessionId);
  const scenario = scenarioById(config.scenarioId);
  const currentStep = config.currentStep || 0;
  return {
    session_id: sessionId,
    scenario_id: scenario.id,
    goal: config.goal,
    algorithm: config.algorithm,
    total_steps: scenario.total_steps,
    current_step: currentStep,
    satellites: makeSatellites(currentStep, scenario, config),
    summary: makeSummary(currentStep, scenario, config.goal, config),
    events_applied: config.events || []
  };
}

function makeTimeline(sessionId) {
  const config = sessionConfig(sessionId);
  const scenario = scenarioById(config.scenarioId);
  const totalSteps = scenario.total_steps || 288;
  return {
    total_steps: totalSteps,
    step_s: 300,
    horizon_s: totalSteps * 300,
    steps: Array.from({ length: totalSteps + 1 }).map((_, step) => ({
      step,
      summary: makeSummary(step, scenario, config.goal, config),
      satellites: makeSatellites(step, scenario, config)
    }))
  };
}

function makeDiagnostics(sessionId, requestedStep = null) {
  const config = sessionConfig(sessionId);
  const currentStep = requestedStep ?? config.currentStep ?? 0;
  const diagnostics = Array.from({ length: 72 }).map((_, index) => {
    const priority = index % 4 === 0 ? 3 : index % 3 === 0 ? 2 : 1;
    const workSteps = index % 7 === 0 ? 2 : 1;
    const unfeasible = index % 11 === 6;
    const release = (index * 9) % 265;
    const deadline = Math.min(288, release + 8 + (index % 17));
    const completionStep = Math.min(deadline - 1, release + workSteps + 2 + (index % 4));
    const completed = currentStep >= completionStep && !unfeasible;
    const inProgress = !completed && !unfeasible && currentStep >= release && currentStep < completionStep;
    const missed = !completed && !unfeasible && currentStep >= deadline;
    const satellite = `S${String((index % 48) + 1).padStart(2, '0')}`;
    return {
      job_id: `JOB-${String(index + 1).padStart(4, '0')}`,
      kind: index > 45 ? 'relay' : 'downlink',
      priority,
      value_usd: [5, 8.33, 14.99, 24.99, 49.98][index % 5],
      work_steps: workSteps,
      executed_steps: completed ? workSteps : 0,
      release_step: release,
      deadline_step: deadline,
      eligible_satellites: index > 45 ? [satellite, `S${String(((index + 7) % 48) + 1).padStart(2, '0')}`] : [satellite],
      status: unfeasible ? 'unfeasible' : completed ? 'completed' : missed ? 'missed' : inProgress ? 'in_progress' : 'pending',
      root_cause: unfeasible ? 'Объективная физическая невозможность' : completed ? 'Выполнено в доступном окне' : missed ? 'Срок задания истёк' : inProgress ? 'В процессе выполнения' : 'Назначено планировщиком',
      details: unfeasible
        ? `Окно радиовидимости аппарата ${satellite} содержит меньше доступных слотов, чем требуется заданию. Алгоритм сохранил заряд и не начал невыполнимую работу.`
        : 'Планировщик сопоставил срок, запас энергии, калибровку и доступный канал связи.',
      feasibility: { available_slots: unfeasible ? Math.max(0, workSteps - 1) : workSteps + 2 }
    };
  });
  const injected = (config.events || [])
    .filter((event) => event.type === 'add_jobs')
    .flatMap((event) => event.jobs || [])
    .map((job) => {
      const completionStep = job.release_step + job.work_steps + 1;
      const completed = currentStep >= completionStep;
      const inProgress = currentStep >= job.release_step && !completed;
      return {
        ...job,
        job_id: job.id,
        is_injected: true,
        injected_at_step: job.release_step,
        executed_steps: completed ? job.work_steps : inProgress ? Math.min(job.work_steps, Math.max(0, currentStep - job.release_step)) : 0,
        status: completed ? 'completed' : inProgress ? 'in_progress' : 'pending',
        root_cause: completed ? 'Срочная заявка выполнена' : inProgress ? 'Срочная заявка принята в работу' : 'Срочная заявка ожидает исполнения',
        details: `Внеплановая заявка добавлена оператором на шаге ${job.release_step}.`,
        feasibility: { available_slots: job.work_steps + 2 }
      };
    });
  const allDiagnostics = [...injected, ...diagnostics];
  return {
    step: currentStep,
    diagnostics: allDiagnostics,
    counts: {
      total: 1208 + injected.length,
      completed: allDiagnostics.filter((job) => job.status === 'completed').length,
      unfeasible: allDiagnostics.filter((job) => job.status === 'unfeasible').length,
      missed: allDiagnostics.filter((job) => job.status === 'missed').length,
      in_progress: allDiagnostics.filter((job) => job.status === 'in_progress').length
    }
  };
}

export async function fetchScenarios() {
  return requestJson('/api/scenarios', undefined, () => [...demoScenarios, ...customScenarios]);
}

export async function getScenarioDetails(scenarioId) {
  return requestJson(`/api/scenarios/${scenarioId}`, undefined, () => scenarioById(scenarioId));
}

export async function createCustomScenario(data) {
  return requestJson('/api/scenarios/custom', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
  }, () => {
    const base = scenarioById(data.base_scenario_id);
    const id = `CUSTOM_${Date.now().toString(36)}`;
    customScenarios.push({ ...base, id, title: data.new_title || 'Пользовательский сценарий' });
    return { scenario_id: id };
  });
}

export async function createSession(scenarioId, goal = 'priority', algorithm = 'vector_smart', autoPrune = true) {
  return requestJson('/api/session/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scenario_id: scenarioId, goal, algorithm, auto_prune_unfeasible: autoPrune })
  }, () => {
    const sessionId = `${DEMO_PREFIX}${scenarioId}-${Date.now().toString(36)}`;
    demoSessions.set(sessionId, { scenarioId, goal, algorithm, autoPrune, currentStep: 0, events: [] });
    return { session_id: sessionId, demo_mode: true };
  });
}

export async function getSessionState(sessionId) {
  if (sessionId.startsWith(DEMO_PREFIX)) return makeSessionState(sessionId);
  return requestJson(`/api/session/${sessionId}/state`, undefined, () => makeSessionState(sessionId));
}

export async function getSatelliteTelemetry(sessionId, satelliteId) {
  return requestJson(`/api/session/${sessionId}/satellite/${satelliteId}/telemetry`, undefined, () => {
    const state = makeSessionState(sessionId);
    const satellite = state.satellites.find((item) => item.id === satelliteId) || state.satellites[0];
    return {
      satellite_id: satelliteId,
      reserve_soc_pct: 30,
      critical_soc_pct: 20,
      capacity_wh: 120,
      history: Array.from({ length: 8 }).map((_, index) => ({ step: index, soc_pct: satellite.soc_pct - index * .4, temp_c: satellite.temp_c + Math.sin(index) }))
    };
  });
}

export async function getSessionTimeline(sessionId) {
  if (sessionId.startsWith(DEMO_PREFIX)) return makeTimeline(sessionId);
  return requestJson(`/api/session/${sessionId}/timeline`, undefined, () => makeTimeline(sessionId));
}

export async function advanceStep(sessionId, stepsCount = 1, targetStep = null) {
  return requestJson(`/api/session/${sessionId}/step`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ steps_count: stepsCount, target_step: targetStep })
  }, () => {
    const config = sessionConfig(sessionId);
    const scenario = scenarioById(config.scenarioId);
    config.currentStep = Math.min(scenario.total_steps, targetStep ?? (config.currentStep || 0) + stepsCount);
    demoSessions.set(sessionId, config);
    return { ok: true, current_step: config.currentStep };
  });
}

export async function runToEnd(sessionId) {
  return requestJson(`/api/session/${sessionId}/run_to_end`, { method: 'POST' }, () => ({ ok: true }));
}

export async function resetSession(sessionId) {
  return requestJson(`/api/session/${sessionId}/reset`, { method: 'POST' }, () => {
    const config = sessionConfig(sessionId);
    demoSessions.set(sessionId, { ...config, currentStep: 0, events: [] });
    return { ok: true };
  });
}

export async function applyEvent(sessionId, eventData) {
  return requestJson(`/api/events/session/${sessionId}/apply`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(eventData)
  }, () => {
    const config = sessionConfig(sessionId);
    const event = { ...eventData, at_step: eventData.at_step ?? config.currentStep ?? 0 };
    config.currentStep = Math.max(config.currentStep || 0, event.at_step);
    config.events = [...(config.events || []), event];
    demoSessions.set(sessionId, config);
    return { status: 'success', event_applied: event, current_step: config.currentStep };
  });
}

export async function triggerChaosMonkey(sessionId, faultType = 'outage') {
  return requestJson(`/api/events/session/${sessionId}/chaos_monkey?fault_type=${faultType}`, { method: 'POST' }, () => ({ ok: true }));
}

export async function compareBranches(data) {
  return requestJson('/api/compare/branches', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
  }, () => {
    const base = sessionConfig(data.base_session_id);
    const scenario = scenarioById(base.scenarioId);
    const branchAId = `${DEMO_PREFIX}${scenario.id}-branch-a-${Date.now().toString(36)}`;
    const branchBId = `${DEMO_PREFIX}${scenario.id}-branch-b-${Date.now().toString(36)}`;
    const forkStep = Math.max(0, Math.min(scenario.total_steps, Number(data.fork_step || 0)));
    const remaining = Math.max(0, (scenario.total_steps - forkStep) / scenario.total_steps);
    const project = (goal, algorithm) => {
      const result = { ...makeSummary(scenario.total_steps, scenario, goal, base) };
      const smart = algorithm === 'vector_smart';
      result.jobs_completed = Math.max(0, result.jobs_completed - Math.round((smart ? 2 : 24) * remaining));
      result.completed_jobs = result.jobs_completed;
      result.critical_jobs_completed_on_time = Math.max(0, result.critical_jobs_completed_on_time - Math.round((smart ? (goal === 'priority' ? 1 : 5) : 18) * remaining));
      result.revenue_usd = Number((result.revenue_usd * (1 - (smart ? 0.003 : 0.045) * remaining) * (goal === 'revenue' ? 1.018 : 1)).toFixed(2));
      result.minimum_soc_pct = Number((result.minimum_soc_pct - (smart ? 0.8 : 5.4) * remaining).toFixed(1));
      result.work_steps_in_missed_jobs = Math.round((smart ? 1 : 11) * remaining);
      return result;
    };
    const a = project(data.branch_a_goal, data.branch_a_algorithm);
    const b = project(data.branch_b_goal, data.branch_b_algorithm);
    demoSessions.set(branchAId, { ...base, goal: data.branch_a_goal, algorithm: data.branch_a_algorithm, currentStep: scenario.total_steps });
    demoSessions.set(branchBId, { ...base, goal: data.branch_b_goal, algorithm: data.branch_b_algorithm, currentStep: scenario.total_steps });
    return {
      fork_step: forkStep,
      branch_a: { session_id: branchAId, goal: data.branch_a_goal, algorithm: data.branch_a_algorithm, summary: a },
      branch_b: { session_id: branchBId, goal: data.branch_b_goal, algorithm: data.branch_b_algorithm, summary: b },
      delta: {
        revenue_usd: Number((a.revenue_usd - b.revenue_usd).toFixed(2)),
        critical_p3_jobs: a.critical_jobs_completed_on_time - b.critical_jobs_completed_on_time,
        wasted_work_steps: a.work_steps_in_missed_jobs - b.work_steps_in_missed_jobs,
        min_soc_pct: Number((a.minimum_soc_pct - b.minimum_soc_pct).toFixed(1))
      },
      conclusions: ['Ветви рассчитаны из одного контрольного состояния.', 'Разница объясняется целью управления, а не изменением исходных данных.']
    };
  });
}

export async function getDiagnostics(sessionId, currentStep = null) {
  const query = currentStep == null ? '' : `?at_step=${currentStep}`;
  return requestJson(`/api/diagnostics/session/${sessionId}${query}`, undefined, () => makeDiagnostics(sessionId, currentStep));
}

export function getExportJsonUrl(sessionId) {
  if (sessionId.startsWith(DEMO_PREFIX)) {
    const payload = JSON.stringify({ schema_version: 'cosmo-B-ops-result-1.0', session_id: sessionId, mode: 'deterministic-demo' }, null, 2);
    return `data:application/json;charset=utf-8,${encodeURIComponent(payload)}`;
  }
  return `${BASE_URL}/api/export/session/${sessionId}/json`;
}

export function getExportReportUrl(sessionId) {
  if (sessionId.startsWith(DEMO_PREFIX)) {
    const config = sessionConfig(sessionId);
    const scenario = scenarioById(config.scenarioId);
    const summary = makeSummary(scenario.total_steps, scenario, config.goal, config);
    const report = `<!doctype html><html lang="ru"><meta charset="utf-8"><title>Отчёт смены — ОРБИТА-КОНТРОЛ</title><style>body{font:16px/1.5 system-ui;margin:48px;color:#111}h1{font-size:32px}dl{display:grid;grid-template-columns:220px 1fr;gap:10px 24px}dt{color:#555}dd{margin:0;font-weight:700}.ok{color:#16794b}@media print{body{margin:20mm}}</style><h1>Отчёт орбитальной смены</h1><p>ОРБИТА-КОНТРОЛ · Team Я — Vector</p><dl><dt>Сценарий</dt><dd>${scenario.title}</dd><dt>Сессия</dt><dd>${sessionId}</dd><dt>Выручка</dt><dd>$${summary.revenue_usd.toFixed(2)}</dd><dt>Выполнено заявок</dt><dd>${summary.jobs_completed} из ${summary.jobs_total}</dd><dt>Критические заявки</dt><dd>${summary.critical_jobs_completed_on_time} из ${summary.critical_jobs_due}</dd><dt>Минимальный заряд</dt><dd>${summary.minimum_soc_pct}%</dd><dt>Статус</dt><dd class="ok">Смена завершена штатно</dd></dl>`;
    return `data:text/html;charset=utf-8,${encodeURIComponent(report)}`;
  }
  return `${BASE_URL}/api/export/session/${sessionId}/report`;
}
