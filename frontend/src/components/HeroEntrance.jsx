import React, { useMemo, useState } from 'react';
import {
  ArrowRight, Check, ChevronDown, Gauge, Settings, ShieldCheck,
  Sparkles, X
} from 'lucide-react';
import Earth3DViewer from './Earth3DViewer';

export const SCENARIO_NAMES = {
  P01_intro: 'Базовый дозор',
  P02_shift: 'Суточная смена',
  P03_energy: 'Энергодефицит',
  P04_demand: 'Пиковая нагрузка'
};

const SCENARIO_META = {
  P01_intro: '16 КА · 4 часа',
  P02_shift: '48 КА · 24 часа',
  P03_energy: '48 КА · 40% солнца',
  P04_demand: '48 КА · 8 120 задач'
};

export default function HeroEntrance({ scenarios, onLaunch, onOpenEditor }) {
  const defaultScenario = scenarios.find((scenario) => scenario.id === 'P02_shift') || scenarios[0];
  const [selectedScenarioId, setSelectedScenarioId] = useState(defaultScenario?.id || 'P02_shift');
  const [goal, setGoal] = useState('priority');
  const [algorithm, setAlgorithm] = useState('vector_smart');
  const [autoPrune, setAutoPrune] = useState(true);
  const [showSettingsDrawer, setShowSettingsDrawer] = useState(false);
  const [isWarping, setIsWarping] = useState(false);

  const selectedScenario = scenarios.find((scenario) => scenario.id === selectedScenarioId) || defaultScenario;
  const dummySatellites = useMemo(
    () => Array.from({ length: selectedScenario?.satellite_count || 48 }).map((_, index) => ({
      id: `S${String(index + 1).padStart(2, '0')}`,
      available: true,
      current_action: index % 8 === 0 ? 'downlink' : index % 5 === 0 ? 'relay' : index % 12 === 0 ? 'calibrate' : 'idle',
      soc_pct: 75
    })),
    [selectedScenario?.satellite_count]
  );

  const handleLaunchClick = () => {
    if (isWarping) return;
    setIsWarping(true);
    window.setTimeout(() => {
      onLaunch({ scenarioId: selectedScenarioId, goal, algorithm, autoPrune });
    }, 420);
  };

  return (
    <div className={`hero-shell ${isWarping ? 'hero-shell--leaving' : ''}`}>
      <div className="hero-ambient" aria-hidden="true" />

      <header className="hero-header">
        <div className="brand-lockup">
          <span className="brand-mark" aria-hidden="true">V</span>
          <div>
            <div className="brand-name">ОРБИТА-КОНТРОЛ</div>
            <div className="brand-caption">TEAM Я — VECTOR</div>
          </div>
        </div>

        <div className="system-state" aria-label="Система готова к расчёту">
          <span className="system-state__dot" />
          <span>Контур готов</span>
          <span className="system-state__divider" />
          <span className="system-state__muted">cosmo-B-ops 1.0</span>
        </div>
      </header>

      <main className="hero-main">
        <section className="hero-copy">
          <div className="hero-eyebrow">
            <Sparkles size={14} aria-hidden="true" />
            Автономный ЦУП · 48 аппаратов
          </div>

          <h1>Орбита.<br /><span>Под контролем.</span></h1>
          <p className="hero-lead">
            Система строит смену, перестраивает её после отказов и показывает оператору,
            какие обязательства сохранены — до запуска следующей команды.
          </p>

          <div className="hero-proof" aria-label="Ключевые возможности">
            <div><strong>288</strong><span>шагов прогноза</span></div>
            <div><strong>2</strong><span>канала связи</span></div>
            <div><strong>100%</strong><span>воспроизводимость</span></div>
          </div>

          <div className="launch-panel">
            <div className="launch-panel__row">
              <label htmlFor="scenario-select">Сценарий смены</label>
              <button
                type="button"
                className="launch-panel__settings"
                onClick={() => setShowSettingsDrawer(true)}
                aria-label="Настроить цель и алгоритм"
              >
                <Settings size={16} />
                <span>Параметры</span>
              </button>
            </div>

            <div className="scenario-select-wrap">
              <select
                id="scenario-select"
                value={selectedScenarioId}
                onChange={(event) => setSelectedScenarioId(event.target.value)}
              >
                {scenarios.map((scenario) => (
                  <option key={scenario.id} value={scenario.id}>
                    {SCENARIO_NAMES[scenario.id] || scenario.title || scenario.id} · {scenario.job_count} задач
                  </option>
                ))}
              </select>
              <ChevronDown size={18} aria-hidden="true" />
            </div>

            <div className="launch-panel__meta">
              <span>{SCENARIO_META[selectedScenarioId] || `${selectedScenario?.satellite_count || 0} КА`}</span>
              <span>{goal === 'priority' ? 'Цель: обязательства P3' : 'Цель: выручка'}</span>
            </div>

            <button
              type="button"
              onClick={handleLaunchClick}
              disabled={isWarping || !selectedScenarioId}
              className="launch-button"
            >
              <span>Открыть ситуационный центр</span>
              <ArrowRight size={20} aria-hidden="true" />
            </button>
          </div>
        </section>

        <section className="hero-orbit" aria-label="Интерактивная модель группировки">
          <Earth3DViewer
            satellites={dummySatellites}
            simTime={3600}
            isPlaying
            autoRotate
            interactive
            className="hero-orbit__viewer"
          />
          <div className="hero-orbit__caption">
            <span className="hero-orbit__live"><span /> LIVE</span>
            <div>
              <strong>{selectedScenario?.satellite_count || 48} аппаратов</strong>
              <span>Телеметрия и орбитальная обстановка</span>
            </div>
          </div>
        </section>
      </main>

      <footer className="hero-footer">
        <span>КосмоХакатон 2026 · Кейс №1</span>
        <span>Планирование без внешних API</span>
      </footer>

      {showSettingsDrawer && (
        <div className="settings-layer" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setShowSettingsDrawer(false);
        }}>
          <section className="settings-sheet" role="dialog" aria-modal="true" aria-labelledby="launch-settings-title">
            <header className="settings-sheet__header">
              <div>
                <span>Параметры расчёта</span>
                <h2 id="launch-settings-title">Как система примет решение</h2>
              </div>
              <button type="button" onClick={() => setShowSettingsDrawer(false)} aria-label="Закрыть настройки">
                <X size={20} />
              </button>
            </header>

            <div className="settings-sheet__body">
              <fieldset>
                <legend>Цель управления</legend>
                <button type="button" className={`choice-row ${goal === 'priority' ? 'choice-row--active' : ''}`} onClick={() => setGoal('priority')}>
                  <span className="choice-row__icon"><ShieldCheck size={18} /></span>
                  <span><strong>Сохранить обязательства</strong><small>Максимум заданий высшего приоритета в срок</small></span>
                  {goal === 'priority' && <Check size={18} />}
                </button>
                <button type="button" className={`choice-row ${goal === 'revenue' ? 'choice-row--active' : ''}`} onClick={() => setGoal('revenue')}>
                  <span className="choice-row__icon"><Gauge size={18} /></span>
                  <span><strong>Максимизировать отдачу</strong><small>Наибольшая выручка при сохранении ограничений</small></span>
                  {goal === 'revenue' && <Check size={18} />}
                </button>
              </fieldset>

              <label className="settings-field">
                <span>Алгоритм планирования</span>
                <select value={algorithm} onChange={(event) => setAlgorithm(event.target.value)}>
                  <option value="vector_smart">Вектор-Орбита · рекомендуемый</option>
                  <option value="baseline">EDF · контрольный baseline</option>
                </select>
              </label>

              <label className="switch-row">
                <span><strong>XAI-отсечение</strong><small>Не расходовать заряд на заведомо невыполнимые задачи</small></span>
                <input type="checkbox" checked={autoPrune} onChange={(event) => setAutoPrune(event.target.checked)} />
                <span className="switch-row__control" aria-hidden="true" />
              </label>

              <button type="button" className="secondary-action" onClick={() => {
                setShowSettingsDrawer(false);
                onOpenEditor();
              }}>
                Изменить исходные условия сценария
                <ArrowRight size={17} />
              </button>
            </div>

            <footer className="settings-sheet__footer">
              <button type="button" onClick={() => setShowSettingsDrawer(false)}>Готово</button>
            </footer>
          </section>
        </div>
      )}
    </div>
  );
}
