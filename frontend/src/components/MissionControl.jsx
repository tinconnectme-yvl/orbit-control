import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity, AlertTriangle, ArrowLeft, BarChart2, Battery, ChevronDown,
  Download, FastForward, FileText, Flame, GitFork, Globe, HelpCircle,
  Pause, Play, RotateCcw, Satellite, Search, SkipForward, X
} from 'lucide-react';
import {
  getExportJsonUrl, getSessionState, getSessionTimeline, resetSession
} from '../api/client';
import AnimatedNumber from './AnimatedNumber';
import ChaosMonkeyModal from './ChaosMonkeyModal';
import ConstellationGantt from './ConstellationGantt';
import Earth3DViewer from './Earth3DViewer';
import ExplainableModal from './ExplainableModal';
import MissionReportModal from './MissionReportModal';
import SatelliteInspector from './SatelliteInspector';
import WhatIfSplitScreen from './WhatIfSplitScreen';
import { SCENARIO_NAMES } from './HeroEntrance';

const ACTION_LABELS = {
  idle: 'Ожидание',
  downlink: 'Передача',
  relay: 'Ретрансляция',
  calibrate: 'Калибровка'
};

function CompactControls({
  isPlaying, onToggle, onStep, onStep10, onEnd, onReset,
  simTime, horizonSec, onSeek, formatTime, currentStep, totalSteps,
  playSpeed, onSpeed, mobile = false
}) {
  return (
    <div className={`playback-cluster ${mobile ? 'is-mobile' : ''}`}>
      <div className="playback-time">
        <span>T+{formatTime(simTime)}</span>
        <small>{String(currentStep + 1).padStart(3, '0')} / {totalSteps}</small>
      </div>
      <input
        className="timeline-range"
        type="range"
        min="0"
        max={horizonSec}
        step="1"
        value={Math.round(simTime)}
        onChange={onSeek}
        aria-label="Положение на временной шкале"
      />
      <div className="playback-actions">
        <button type="button" className="playback-primary" onClick={onToggle} aria-label={isPlaying ? 'Пауза' : 'Запустить расчёт'}>
          {isPlaying ? <Pause size={17} /> : <Play size={17} />}
        </button>
        {!mobile && <>
          <button type="button" onClick={onStep} aria-label="Следующий шаг"><SkipForward size={16} /></button>
          <button type="button" onClick={onStep10} aria-label="Перейти на десять шагов">+10</button>
          <button type="button" onClick={onEnd} aria-label="Перейти в конец"><FastForward size={16} /></button>
          <button type="button" onClick={onReset} aria-label="Сбросить расчёт"><RotateCcw size={15} /></button>
          <div className="speed-toggle" aria-label="Скорость воспроизведения">
            {['0.5x', '1x', '2x'].map((speed) => (
              <button key={speed} type="button" onClick={() => onSpeed(speed)} className={playSpeed === speed ? 'is-active' : ''}>{speed}</button>
            ))}
          </div>
        </>}
      </div>
    </div>
  );
}

function Metric({ label, children, tone = 'default' }) {
  return <div className={`mission-metric mission-metric--${tone}`}><span>{label}</span><strong>{children}</strong></div>;
}

export default function MissionControl({ sessionId, onBackToHero }) {
  const [workingSessionId, setWorkingSessionId] = useState(sessionId);
  const [sessionState, setSessionState] = useState(null);
  const [timelineData, setTimelineData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [playSpeed, setPlaySpeed] = useState('1x');
  const [simTime, setSimTime] = useState(0);
  const [activeNav, setActiveNav] = useState('globe');
  const [selectedSatelliteId, setSelectedSatelliteId] = useState('S01');
  const [showInspector, setShowInspector] = useState(false);
  const [showFleetDrawer, setShowFleetDrawer] = useState(false);
  const [fleetSearchQuery, setFleetSearchQuery] = useState('');
  const [fleetFilter, setFleetFilter] = useState('all');
  const [showChaosMonkey, setShowChaosMonkey] = useState(false);
  const [showWhatIf, setShowWhatIf] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [eventNotice, setEventNotice] = useState(null);

  const simTimeRef = useRef(0);
  const lastTimestampRef = useRef(performance.now());
  const isPlayingRef = useRef(false);
  isPlayingRef.current = isPlaying;

  const speedMultiplier = useMemo(() => {
    if (playSpeed === '0.5x') return 100;
    if (playSpeed === '2x') return 600;
    return 250;
  }, [playSpeed]);

  const loadTimeline = async (id = workingSessionId) => {
    setLoadError('');
    try {
      const state = await getSessionState(id);
      setSessionState(state);
      setLoading(false);
      if (state.satellites?.length && !selectedSatelliteId) setSelectedSatelliteId(state.satellites[0].id);
      const timeline = await getSessionTimeline(id);
      setTimelineData(timeline);
    } catch (error) {
      console.error('Timeline fetch error:', error);
      setLoadError('Не удалось получить расчёт. Проверьте локальный контур и повторите запуск.');
      setLoading(false);
    }
  };

  useEffect(() => {
    setWorkingSessionId(sessionId);
    setLoading(true);
    simTimeRef.current = 0;
    setSimTime(0);
    loadTimeline(sessionId);
  }, [sessionId]);

  useEffect(() => {
    let animationId;
    let accumulated = 0;
    lastTimestampRef.current = performance.now();
    const loop = (now) => {
      const delta = Math.min(0.1, (now - lastTimestampRef.current) / 1000);
      lastTimestampRef.current = now;
      accumulated += delta;
      if (isPlayingRef.current && timelineData) {
        if (accumulated < 1 / 30) {
          animationId = requestAnimationFrame(loop);
          return;
        }
        const horizon = timelineData.horizon_s || timelineData.total_steps * 300;
        const nextTime = simTimeRef.current + accumulated * speedMultiplier;
        accumulated = 0;
        if (nextTime >= horizon) {
          simTimeRef.current = horizon;
          setSimTime(horizon);
          setIsPlaying(false);
        } else {
          simTimeRef.current = nextTime;
          setSimTime(nextTime);
        }
      } else {
        accumulated = 0;
      }
      animationId = requestAnimationFrame(loop);
    };
    animationId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationId);
  }, [speedMultiplier, timelineData]);

  const totalSteps = timelineData?.total_steps || sessionState?.total_steps || 48;
  const stepSeconds = timelineData?.step_s || 300;
  const horizonSec = timelineData?.horizon_s || totalSteps * stepSeconds;
  const stepFloat = Math.min(totalSteps, Math.max(0, simTime / stepSeconds));
  const currentStep = Math.min(totalSteps - 1, Math.floor(stepFloat));
  const nextStep = Math.min(totalSteps, currentStep + 1);
  const fraction = stepFloat - currentStep;

  const formatTime = (seconds) => {
    const value = Math.floor(seconds);
    const hours = Math.floor(value / 3600);
    const minutes = Math.floor((value % 3600) / 60);
    const secs = value % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const { summary, satellites } = useMemo(() => {
    if (!timelineData?.steps?.length) {
      return { summary: sessionState?.summary || {}, satellites: sessionState?.satellites || [] };
    }
    const current = timelineData.steps[currentStep] || timelineData.steps[0];
    const next = timelineData.steps[nextStep] || current;
    const currentSummary = current.summary || {};
    const liveSummary = {
      ...currentSummary,
      revenue_usd: currentSummary.revenue_usd ?? 0,
      completed_jobs: currentSummary.completed_jobs ?? currentSummary.jobs_completed ?? 0,
      jobs_completed: currentSummary.completed_jobs ?? currentSummary.jobs_completed ?? 0,
      missed_jobs: currentSummary.missed_jobs ?? currentSummary.jobs_due_missed ?? 0,
      jobs_due_missed: currentSummary.missed_jobs ?? currentSummary.jobs_due_missed ?? 0,
      critical_jobs_completed_on_time: currentSummary.critical_completed ?? currentSummary.critical_jobs_completed_on_time ?? 0,
      critical_jobs_due: currentSummary.critical_total ?? currentSummary.critical_jobs_due ?? 0,
      minimum_soc_pct: currentSummary.minimum_soc_pct ?? 100
    };
    const nextSatellites = next.satellites || [];
    const liveSatellites = (current.satellites || []).map((satellite, index) => {
      const nextSatellite = nextSatellites[index] || satellite;
      const mix = (key) => Number(((satellite[key] || 0) + ((nextSatellite[key] ?? satellite[key] ?? 0) - (satellite[key] || 0)) * fraction).toFixed(1));
      return {
        ...satellite,
        soc_pct: mix('soc_pct'), temp_c: mix('temp_c'), energy_wh: mix('energy_wh'),
        solar_w: mix('solar_w'), load_w: mix('load_w'),
        current_action: fraction > 0.5 ? nextSatellite.current_action : satellite.current_action,
        active_job_id: fraction > 0.5 ? nextSatellite.active_job_id : satellite.active_job_id,
        available: satellite.available && nextSatellite.available
      };
    });
    return { summary: liveSummary, satellites: liveSatellites };
  }, [timelineData, currentStep, nextStep, fraction, sessionState]);

  const selectedSatellite = satellites.find((satellite) => satellite.id === selectedSatelliteId) || satellites[0];
  const visibleEvents = useMemo(() => (sessionState?.events_applied || []).filter((event) => {
    const start = Number(event.at_step || 0);
    if (event.type === 'add_jobs') return start <= currentStep && currentStep < start + 18;
    return start <= currentStep && currentStep < Number(event.end_step || start + 1);
  }), [sessionState?.events_applied, currentStep]);
  const impactEvents = visibleEvents.length
    ? visibleEvents
    : (eventNotice && Number(eventNotice.at_step || 0) === currentStep ? [eventNotice] : []);
  const filteredSatellites = useMemo(() => satellites.filter((satellite) => {
    const action = satellite.current_action || '';
    if (fleetSearchQuery && !satellite.id.toLowerCase().includes(fleetSearchQuery.toLowerCase())) return false;
    if (fleetFilter === 'downlink') return action.includes('downlink');
    if (fleetFilter === 'warning') return satellite.soc_pct < 30 || !satellite.available || satellite.calibration_age_steps >= 45;
    return true;
  }), [satellites, fleetSearchQuery, fleetFilter]);

  const togglePlay = () => {
    if (simTime >= horizonSec) {
      simTimeRef.current = 0;
      setSimTime(0);
    }
    setIsPlaying((value) => !value);
  };
  const seekTo = (target) => {
    setIsPlaying(false);
    simTimeRef.current = Math.max(0, Math.min(horizonSec, target));
    setSimTime(simTimeRef.current);
  };
  const handleReset = async () => {
    seekTo(0);
    try {
      await resetSession(workingSessionId);
      await loadTimeline(workingSessionId);
    } catch (error) {
      setLoadError('Сброс не выполнен. Повторите попытку.');
    }
  };

  const controlsProps = {
    isPlaying,
    onToggle: togglePlay,
    onStep: () => seekTo((currentStep + 1) * stepSeconds),
    onStep10: () => seekTo((currentStep + 10) * stepSeconds),
    onEnd: () => seekTo(horizonSec),
    onReset: handleReset,
    simTime,
    horizonSec,
    onSeek: (event) => seekTo(Number(event.target.value)),
    formatTime,
    currentStep,
    totalSteps,
    playSpeed,
    onSpeed: setPlaySpeed
  };

  if (loading) {
    return <div className="mission-loading"><span className="mission-loading__mark">V</span><p>Собираем смену и прогноз состояний…</p></div>;
  }

  if (loadError && !sessionState) {
    return (
      <div className="mission-error">
        <AlertTriangle size={26} />
        <h2>Расчёт недоступен</h2>
        <p>{loadError}</p>
        <button type="button" onClick={onBackToHero}>Вернуться к сценарию</button>
      </div>
    );
  }

  const navigation = [
    { id: 'globe', label: 'Орбита', detail: 'Состояние группировки', icon: Globe },
    { id: 'gantt', label: 'Расписание', detail: 'Смена 24 часа', icon: BarChart2 },
    { id: 'tasks', label: 'Решения XAI', detail: 'Причины и потери', icon: HelpCircle }
  ];

  return (
    <div className="mission-shell">
      <header className="mission-topbar">
        <div className="mission-identity">
          <button type="button" className="icon-button" onClick={onBackToHero} aria-label="Вернуться к выбору сценария"><ArrowLeft size={18} /></button>
          <div className="mission-identity__mark">V</div>
          <div>
            <strong>{SCENARIO_NAMES[sessionState?.scenario_id] || sessionState?.scenario_id}</strong>
            <span>{satellites.length} КА · {sessionState?.goal === 'priority' ? 'Обязательства P3' : 'Коммерческая отдача'}</span>
          </div>
        </div>

        <CompactControls {...controlsProps} />

        <div className="mission-topbar__right">
          <div className="mission-metrics">
            <Metric label="Выручка" tone="accent"><AnimatedNumber value={summary.revenue_usd || 0} prefix="$" decimals={0} duration={350} /></Metric>
            <Metric label="P3 в срок"><AnimatedNumber value={summary.critical_jobs_completed_on_time || 0} duration={300} /> / {summary.critical_jobs_due || 0}</Metric>
            <Metric label="Мин. заряд" tone={(summary.minimum_soc_pct || 100) < 40 ? 'warning' : 'default'}><AnimatedNumber value={summary.minimum_soc_pct || 100} decimals={1} suffix="%" duration={350} /></Metric>
          </div>
          <button type="button" className="icon-button" onClick={() => setShowReportModal(true)} aria-label="Открыть отчёт"><FileText size={18} /></button>
        </div>
      </header>

      <header className="mission-mobile-head">
        <div className="mission-mobile-head__title">
          <button type="button" className="icon-button" onClick={onBackToHero} aria-label="Вернуться"><ArrowLeft size={18} /></button>
          <div><strong>{SCENARIO_NAMES[sessionState?.scenario_id] || 'Смена'}</strong><span>{satellites.length} КА · шаг {currentStep + 1}/{totalSteps}</span></div>
          <button type="button" className="icon-button" onClick={() => setShowReportModal(true)} aria-label="Открыть отчёт"><FileText size={18} /></button>
        </div>
        <div className="mission-mobile-metrics">
          <Metric label="Выручка" tone="accent"><AnimatedNumber value={summary.revenue_usd || 0} prefix="$" decimals={0} duration={300} /></Metric>
          <Metric label="P3"><AnimatedNumber value={summary.critical_jobs_completed_on_time || 0} duration={300} />/{summary.critical_jobs_due || 0}</Metric>
          <Metric label="Мин. SoC" tone={(summary.minimum_soc_pct || 100) < 40 ? 'warning' : 'default'}><AnimatedNumber value={summary.minimum_soc_pct || 100} decimals={0} suffix="%" duration={300} /></Metric>
        </div>
      </header>

      <div className="mission-body">
        <aside className="mission-sidebar">
          <div>
            <span className="sidebar-label">Рабочие области</span>
            <nav>
              {navigation.map(({ id, label, detail, icon: Icon }) => (
                <button key={id} type="button" className={activeNav === id ? 'is-active' : ''} onClick={() => setActiveNav(id)}>
                  <Icon size={18} />
                  <span><strong>{label}</strong><small>{detail}</small></span>
                </button>
              ))}
            </nav>
          </div>

          <div className="sidebar-actions">
            <button type="button" onClick={() => setShowChaosMonkey(true)}><Flame size={16} /><span>Ввести отказ</span></button>
            <button type="button" onClick={() => setShowWhatIf(true)}><GitFork size={16} /><span>Сравнить стратегии</span></button>
            <a href={getExportJsonUrl(workingSessionId)} download><Download size={16} /><span>Выгрузить JSON</span></a>
          </div>
        </aside>

        <main className="mission-stage">
          {activeNav === 'globe' && (
            <section className="orbit-workspace">
              <Earth3DViewer
                satellites={satellites}
                simTime={simTime}
                isPlaying={isPlaying}
                onSelectSatellite={(id) => { setSelectedSatelliteId(id); setShowInspector(false); }}
                selectedSatelliteId={selectedSatelliteId}
                className="orbit-workspace__viewer"
              />

              <div className="stage-toolbar">
                <button type="button" onClick={() => setShowFleetDrawer((value) => !value)} className={showFleetDrawer ? 'is-active' : ''}>
                  <Satellite size={16} /><span>Группировка · {satellites.length}</span><ChevronDown size={15} />
                </button>
              </div>

              {impactEvents.length > 0 && (
                <div className="event-impact" role="status">
                  {impactEvents.filter(Boolean).slice(-2).map((event) => {
                    const remaining = event.end_step ? Math.max(0, event.end_step - currentStep) : null;
                    const label = event.type === 'satellite_outage'
                      ? `ОТКАЗ: ${(event.satellite_ids || []).join(', ')} недоступен`
                      : event.type === 'close_downlink'
                        ? 'DOWNLINK ЗАКРЫТ: передача на Землю недоступна'
                        : `СРОЧНЫЙ ВБРОС: ${(event.jobs || []).length} заявки добавлены в очередь`;
                    return <div key={event.id || label} className={`event-impact__item event-impact__item--${event.type}`}><AlertTriangle size={15} /><strong>{label}</strong>{remaining != null && <span>ещё {remaining} шаг.</span>}</div>;
                  })}
                </div>
              )}

              {showFleetDrawer && (
                <aside className="fleet-drawer">
                  <header><div><Satellite size={17} /><strong>Аппараты</strong></div><button type="button" onClick={() => setShowFleetDrawer(false)} aria-label="Закрыть список"><X size={18} /></button></header>
                  <div className="fleet-search">
                    <Search size={15} />
                    <input value={fleetSearchQuery} onChange={(event) => setFleetSearchQuery(event.target.value)} placeholder="Найти аппарат" aria-label="Поиск аппарата" />
                  </div>
                  <div className="fleet-filters">
                    {[['all', 'Все'], ['downlink', 'В эфире'], ['warning', 'Риск']].map(([id, label]) => (
                      <button key={id} type="button" onClick={() => setFleetFilter(id)} className={fleetFilter === id ? 'is-active' : ''}>{label}</button>
                    ))}
                  </div>
                  <div className="fleet-list">
                    {filteredSatellites.map((satellite) => {
                      const action = satellite.current_action || 'idle';
                      return (
                        <button key={satellite.id} type="button" className={`${satellite.id === selectedSatelliteId ? 'is-active' : ''} ${!satellite.available ? 'is-unavailable' : ''}`} onClick={() => { setSelectedSatelliteId(satellite.id); setShowInspector(true); }}>
                          <span className="fleet-list__id"><strong>{satellite.id}</strong><small>{!satellite.available ? 'ОТКАЗ · НЕДОСТУПЕН' : (ACTION_LABELS[action] || action)}</small></span>
                          <span className="fleet-list__metric"><Battery size={13} />{Number(satellite.soc_pct || 0).toFixed(0)}%</span>
                          <span className="fleet-list__metric">{Number(satellite.temp_c || 0).toFixed(0)}°</span>
                        </button>
                      );
                    })}
                  </div>
                </aside>
              )}

              {selectedSatellite && (
                <div className={`satellite-strip ${!selectedSatellite.available ? 'is-unavailable' : ''}`}>
                  <span className="satellite-strip__icon">{selectedSatellite.available ? <Satellite size={19} /> : <AlertTriangle size={19} />}</span>
                  <div><strong>{selectedSatellite.id}</strong><span>{!selectedSatellite.available ? 'ОТКАЗ · аппарат исключён из планирования' : (ACTION_LABELS[selectedSatellite.current_action] || selectedSatellite.current_action || 'Ожидание')}</span></div>
                  <div className="satellite-strip__readings"><span><Battery size={13} />{Number(selectedSatellite.soc_pct || 0).toFixed(1)}%</span><span>{Number(selectedSatellite.temp_c || 0).toFixed(1)}°C</span></div>
                  <button type="button" onClick={() => setShowInspector(true)}>Подробнее</button>
                </div>
              )}

              {showInspector && selectedSatelliteId && (
                <SatelliteInspector sessionId={workingSessionId} satelliteId={selectedSatelliteId} satState={selectedSatellite} onClose={() => setShowInspector(false)} />
              )}
            </section>
          )}

          {activeNav === 'gantt' && (
            <section className="secondary-workspace">
              <ConstellationGantt
                sessionState={sessionState}
                timelineData={timelineData}
                currentStep={currentStep}
                simTime={simTime}
                onSelectSatellite={(id) => { setSelectedSatelliteId(id); setShowInspector(true); }}
                selectedSatelliteId={selectedSatelliteId}
              />
            </section>
          )}

          {activeNav === 'tasks' && (
            <section className="secondary-workspace"><ExplainableModal sessionId={workingSessionId} currentStep={currentStep} isInline onClose={() => setActiveNav('globe')} /></section>
          )}

          {activeNav === 'compare' && (
            <section className="secondary-workspace secondary-workspace--compare">
              <WhatIfSplitScreen
                sessionId={workingSessionId}
                currentStep={currentStep}
                isInline
                onSwitchSession={(id) => { setWorkingSessionId(id); setActiveNav('globe'); seekTo(0); loadTimeline(id); }}
              />
            </section>
          )}
        </main>
      </div>

      <div className="mission-mobile-playback"><CompactControls {...controlsProps} mobile /></div>
      <nav className="mission-mobile-nav" aria-label="Разделы ситуационного центра">
        {navigation.map(({ id, label, icon: Icon }) => (
          <button key={id} type="button" className={activeNav === id ? 'is-active' : ''} onClick={() => setActiveNav(id)}><Icon size={19} /><span>{label}</span></button>
        ))}
        <button type="button" className={activeNav === 'compare' ? 'is-active' : ''} onClick={() => setActiveNav('compare')}><GitFork size={19} /><span>Сравнить</span></button>
      </nav>

      {showChaosMonkey && <ChaosMonkeyModal sessionId={workingSessionId} currentStep={currentStep} totalSteps={totalSteps} satellites={satellites} onClose={() => setShowChaosMonkey(false)} onEventApplied={(event) => { setEventNotice(event); loadTimeline(workingSessionId); }} />}
      {showWhatIf && <WhatIfSplitScreen sessionId={workingSessionId} currentStep={currentStep} onClose={() => setShowWhatIf(false)} onSwitchSession={(id) => { setWorkingSessionId(id); setShowWhatIf(false); seekTo(0); loadTimeline(id); }} />}
      {showReportModal && <MissionReportModal sessionId={workingSessionId} scenarioId={sessionState?.scenario_id} summary={summary} onClose={() => setShowReportModal(false)} />}
    </div>
  );
}
