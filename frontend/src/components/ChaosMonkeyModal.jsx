import React, { useState } from 'react';
import { 
  X, AlertOctagon, Radio, Zap, AlertTriangle, ShieldAlert, 
  Send, Flame, CheckCircle2 
} from 'lucide-react';
import { triggerChaosMonkey, applyEvent } from '../api/client';

export default function ChaosMonkeyModal({ 
  sessionId, 
  currentStep, 
  totalSteps, 
  satellites, 
  onClose, 
  onEventApplied 
}) {
  const [selectedSat, setSelectedSat] = useState(satellites[0]?.id || 'S01');
  const [outageDuration, setOutageDuration] = useState(16);
  const [downlinkDuration, setDownlinkDuration] = useState(12);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [activeTab, setActiveTab] = useState('quick'); // 'quick' or 'json'
  const [rawJson, setRawJson] = useState(`{
  "id": "MANUAL-EV-01",
  "type": "satellite_outage",
  "satellite_ids": ["${satellites[0]?.id || 'S01'}"],
  "end_step": ${Math.min(totalSteps, currentStep + 16)}
}`);

  const handleQuickOutage = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await applyEvent(sessionId, {
        id: `OUTAGE-${selectedSat}-${currentStep}`,
        type: 'satellite_outage',
        satellite_ids: [selectedSat],
        end_step: Math.min(totalSteps, currentStep + parseInt(outageDuration))
      });
      setMessage({ type: 'success', text: `🚨 Спутник ${selectedSat} отключен на ${outageDuration} шагов (до шага ${currentStep + parseInt(outageDuration)}).` });
      if (onEventApplied) onEventApplied();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleCloseDownlink = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const allSats = satellites.map(s => s.id);
      const res = await applyEvent(sessionId, {
        id: `CLOSE-DL-${currentStep}`,
        type: 'close_downlink',
        satellite_ids: allSats,
        end_step: Math.min(totalSteps, currentStep + parseInt(downlinkDuration))
      });
      setMessage({ type: 'success', text: `📡 Наземная станция закрыта для всех КА на ${downlinkDuration} шагов.` });
      if (onEventApplied) onEventApplied();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleEmergencyJobs = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const targetSats = satellites.slice(0, 3).map(s => s.id);
      const res = await applyEvent(sessionId, {
        id: `URG-JOBS-${currentStep}`,
        type: 'add_jobs',
        jobs: [
          {
            id: `URG-RELAY-${currentStep}`,
            kind: 'relay',
            release_step: currentStep,
            deadline_step: Math.min(totalSteps, currentStep + 10),
            work_steps: 2,
            eligible_satellites: targetSats,
            priority: 3,
            value_usd: 120.0
          },
          {
            id: `URG-DOWNLINK-${currentStep}`,
            kind: 'downlink',
            release_step: currentStep,
            deadline_step: Math.min(totalSteps, currentStep + 12),
            work_steps: 1,
            eligible_satellites: [targetSats[0]],
            priority: 3,
            value_usd: 180.0
          }
        ]
      });
      setMessage({ type: 'success', text: `⚡ Добавлено 2 экстренных задания высшего приоритета P3 ($300 USD)!` });
      if (onEventApplied) onEventApplied();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleApplyJson = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const parsed = JSON.parse(rawJson);
      await applyEvent(sessionId, parsed);
      setMessage({ type: 'success', text: `Событие из JSON успешно применено на шаге ${currentStep}!` });
      if (onEventApplied) onEventApplied();
    } catch (err) {
      setMessage({ type: 'error', text: `Ошибка: ${err.message}` });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-modal-layer fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="app-modal-card bg-space-900 border border-subtle w-full max-w-xl rounded shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="p-4 border-b border-subtle flex items-center justify-between bg-space-950/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded bg-orbit-ruby/15 border border-orbit-ruby/40 flex items-center justify-center text-orbit-ruby">
              <Flame className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-white text-sm font-mono tracking-wider">
                  CHAOS MONKEY // ИНЖЕКТОР СБОЕВ
                </h3>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-orbit-ruby/20 text-orbit-ruby font-mono">
                  LIVE INJECTION
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono">
                Внедрение аномалий на текущем шаге {currentStep} / {totalSteps}
              </p>
            </div>
          </div>

          <button onClick={onClose} className="p-1 rounded text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex border-b border-subtle bg-space-950/40 text-xs font-mono">
          <button
            onClick={() => setActiveTab('quick')}
            className={`flex-1 py-2.5 border-b-2 text-center transition-colors ${
              activeTab === 'quick' ? 'border-orbit-ruby text-white font-bold bg-white/5' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Быстрые шаблоны сбоев
          </button>
          <button
            onClick={() => setActiveTab('json')}
            className={`flex-1 py-2.5 border-b-2 text-center transition-colors ${
              activeTab === 'json' ? 'border-orbit-ruby text-white font-bold bg-white/5' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Ручной ввод JSON (cosmo-B-events)
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          
          {message && (
            <div className={`p-3 rounded text-xs font-mono border flex items-center gap-2 ${
              message.type === 'success' 
                ? 'bg-orbit-emerald/10 border-orbit-emerald/30 text-orbit-emerald' 
                : 'bg-orbit-ruby/10 border-orbit-ruby/30 text-orbit-ruby'
            }`}>
              {message.type === 'success' ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> : <AlertTriangle className="w-4 h-4 flex-shrink-0" />}
              <span>{message.text}</span>
            </div>
          )}

          {activeTab === 'quick' ? (
            <div className="space-y-4">
              
              {/* Fault 1: Satellite Outage */}
              <div className="p-3.5 bg-space-850 border border-subtle rounded space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-xs text-white flex items-center gap-1.5 font-mono">
                    <AlertOctagon className="w-4 h-4 text-orbit-ruby" />
                    Отказ космического аппарата (satellite_outage)
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">Шаг [{currentStep}..{currentStep + parseInt(outageDuration)})</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Выбрать КА:</label>
                    <select
                      value={selectedSat}
                      onChange={(e) => setSelectedSat(e.target.value)}
                      className="w-full bg-space-800 border border-subtle rounded px-2 py-1 text-slate-200"
                    >
                      {satellites.map(s => (
                        <option key={s.id} value={s.id}>{s.id} (Заряд {s.soc_pct}%)</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Длительность (шагов):</label>
                    <input
                      type="number"
                      min="1"
                      max="48"
                      value={outageDuration}
                      onChange={(e) => setOutageDuration(e.target.value)}
                      className="w-full bg-space-800 border border-subtle rounded px-2 py-1 text-slate-200"
                    />
                  </div>
                </div>
                <button
                  onClick={handleQuickOutage}
                  disabled={loading}
                  className="w-full py-1.5 px-3 rounded bg-orbit-ruby/20 hover:bg-orbit-ruby/30 text-orbit-ruby border border-orbit-ruby/40 text-xs font-mono font-bold transition-colors"
                >
                  Сломать {selectedSat}
                </button>
              </div>

              {/* Fault 2: Close Downlink Station */}
              <div className="p-3.5 bg-space-850 border border-subtle rounded space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-xs text-white flex items-center gap-1.5 font-mono">
                    <Radio className="w-4 h-4 text-orbit-amber" />
                    Закрытие пункта Downlink (close_downlink)
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">Шаг [{currentStep}..{currentStep + parseInt(downlinkDuration)})</span>
                </div>
                <p className="text-xs text-slate-400">
                  Все наземные сеансы сброса данных на Землю блокируются на указанный период.
                </p>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min="1"
                    max="24"
                    value={downlinkDuration}
                    onChange={(e) => setDownlinkDuration(e.target.value)}
                    className="w-24 bg-space-800 border border-subtle rounded px-2 py-1 text-xs text-slate-200 font-mono"
                  />
                  <span className="text-xs text-slate-400 font-mono">шагов ({downlinkDuration * 5} минут)</span>
                  <button
                    onClick={handleCloseDownlink}
                    disabled={loading}
                    className="flex-1 py-1.5 px-3 rounded bg-orbit-amber/20 hover:bg-orbit-amber/30 text-orbit-amber border border-orbit-amber/40 text-xs font-mono font-bold transition-colors"
                  >
                    Закрыть Downlink
                  </button>
                </div>
              </div>

              {/* Fault 3: Emergency P3 Jobs */}
              <div className="p-3.5 bg-space-850 border border-subtle rounded space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-xs text-white flex items-center gap-1.5 font-mono">
                    <Zap className="w-4 h-4 text-orbit-emerald" />
                    Срочные заявки высшего приоритета P3 (add_jobs)
                  </span>
                  <span className="text-[10px] font-mono text-orbit-emerald font-bold">+ $300 USD</span>
                </div>
                <p className="text-xs text-slate-400">
                  Внезапный приток 2 критических заданий с жестким дедлайном. Проверяет способность системы перераспределить ресурсы.
                </p>
                <button
                  onClick={handleEmergencyJobs}
                  disabled={loading}
                  className="w-full py-1.5 px-3 rounded bg-orbit-emerald/20 hover:bg-orbit-emerald/30 text-orbit-emerald border border-orbit-emerald/40 text-xs font-mono font-bold transition-colors"
                >
                  Вбросить срочные заявки
                </button>
              </div>

            </div>
          ) : (
            <div className="space-y-3">
              <label className="text-xs text-slate-400 font-mono block">
                Формат: cosmo-B-events (один объект события)
              </label>
              <textarea
                rows={8}
                value={rawJson}
                onChange={(e) => setRawJson(e.target.value)}
                className="w-full bg-space-850 border border-subtle rounded p-3 text-xs font-mono text-slate-200 focus:outline-none focus:border-orbit-emerald"
              />
              <button
                onClick={handleApplyJson}
                disabled={loading}
                className="w-full py-2 px-4 rounded bg-orbit-emerald text-black font-mono font-bold text-xs hover:bg-orbit-emerald/90 transition-colors"
              >
                Применить событие
              </button>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-subtle bg-space-950/80 flex items-center justify-between text-xs font-mono text-slate-400">
          <span>События не изменяют прошлую историю (шаги 0..{currentStep - 1})</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            Закрыть
          </button>
        </div>

      </div>
    </div>
  );
}
