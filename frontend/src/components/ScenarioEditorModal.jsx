import React, { useState } from 'react';
import { 
  X, Sliders, Battery, Sun, Star, AlertTriangle, Plus, CheckCircle2 
} from 'lucide-react';
import { createCustomScenario } from '../api/client';

export default function ScenarioEditorModal({ baseScenarioId, onClose, onCreated }) {
  const [newTitle, setNewTitle] = useState('');
  const [solarMultiplier, setSolarMultiplier] = useState(1.0);
  const [satId, setSatId] = useState('S01');
  const [satSoc, setSatSoc] = useState(38);
  const [socAdjustments, setSocAdjustments] = useState({});
  const [loading, setLoading] = useState(false);

  const handleAddSocAdjustment = () => {
    setSocAdjustments(prev => ({
      ...prev,
      [satId]: parseFloat(satSoc)
    }));
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const res = await createCustomScenario({
        base_scenario_id: baseScenarioId,
        new_title: newTitle || undefined,
        solar_multiplier: parseFloat(solarMultiplier),
        initial_soc_adjustments: Object.keys(socAdjustments).length ? socAdjustments : undefined
      });
      alert(`Новый сценарий создан: ${res.scenario_id}`);
      if (onCreated) onCreated(res.scenario_id);
      onClose();
    } catch (err) {
      alert(`Ошибка создания сценария: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-modal-layer fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
      <div className="app-modal-card bg-space-900 border border-subtle w-full max-w-xl rounded shadow-2xl overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="p-4 border-b border-subtle flex items-center justify-between bg-space-950/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded bg-orbit-cyan/15 border border-orbit-cyan/40 flex items-center justify-center text-orbit-cyan">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm font-mono tracking-wider">
                ПАРАМЕТРЫ ЭКСПЕРИМЕНТА // МОДИФИКАЦИЯ СЦЕНАРИЯ
              </h3>
              <p className="text-xs text-slate-400 font-mono">
                Базовый сценарий: {baseScenarioId}
              </p>
            </div>
          </div>

          <button onClick={onClose} className="p-1 rounded text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-5 space-y-4 font-mono text-xs">
          
          <div>
            <label className="text-slate-400 block mb-1">Название сценария / эксперимента:</label>
            <input
              type="text"
              placeholder="Например: Дефицит энергии (солнце 40%)"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="w-full bg-space-850 border border-subtle rounded px-3 py-2 text-slate-200"
            />
          </div>

          {/* Solar Multiplier */}
          <div className="p-3 bg-space-850 border border-subtle rounded space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-white flex items-center gap-1.5">
                <Sun className="w-4 h-4 text-orbit-amber" />
                Коэффициент солнечной мощности (solar_w)
              </span>
              <span className="text-orbit-amber font-bold">{Math.round(solarMultiplier * 100)}%</span>
            </div>
            <input
              type="range"
              min="0.1"
              max="2.0"
              step="0.1"
              value={solarMultiplier}
              onChange={(e) => setSolarMultiplier(parseFloat(e.target.value))}
              className="w-full accent-orbit-amber cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500">
              <span>10% (Глубокий дефицит)</span>
              <span>100% (Штатно)</span>
              <span>200% (Избыток)</span>
            </div>
          </div>

          {/* Initial SOC Adjustment */}
          <div className="p-3 bg-space-850 border border-subtle rounded space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-white flex items-center gap-1.5">
                <Battery className="w-4 h-4 text-orbit-emerald" />
                Начальный заряд батареи выбранных КА
              </span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="ID (напр. S01)"
                value={satId}
                onChange={(e) => setSatId(e.target.value.toUpperCase())}
                className="w-28 bg-space-800 border border-subtle rounded px-2 py-1.5 text-slate-200"
              />
              <input
                type="number"
                min="0"
                max="100"
                value={satSoc}
                onChange={(e) => setSatSoc(e.target.value)}
                className="w-24 bg-space-800 border border-subtle rounded px-2 py-1.5 text-slate-200"
              />
              <span className="text-slate-400">%</span>
              <button
                type="button"
                onClick={handleAddSocAdjustment}
                className="px-3 py-1.5 rounded bg-white/10 hover:bg-white/20 text-white flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Добавить
              </button>
            </div>

            {/* Added adjustments list */}
            {Object.keys(socAdjustments).length > 0 && (
              <div className="pt-2 flex flex-wrap gap-1.5">
                {Object.entries(socAdjustments).map(([id, soc]) => (
                  <span key={id} className="px-2 py-0.5 rounded bg-orbit-emerald/15 text-orbit-emerald border border-orbit-emerald/30 text-[10px]">
                    {id}: {soc}%
                  </span>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-subtle bg-space-950/80 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded bg-white/10 hover:bg-white/20 text-white font-mono text-xs transition-colors"
          >
            Отмена
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="px-5 py-1.5 rounded bg-orbit-cyan hover:bg-orbit-cyan/90 text-black font-mono font-bold text-xs transition-colors"
          >
            {loading ? 'Создание...' : 'Сохранить новый сценарий'}
          </button>
        </div>

      </div>
    </div>
  );
}
