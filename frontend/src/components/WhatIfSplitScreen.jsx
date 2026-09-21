import React, { useState } from 'react';
import { 
  X, GitFork, ArrowRight, DollarSign, Shield, Cpu, CheckCircle2, 
  TrendingUp, TrendingDown, ArrowUpRight, Scale 
} from 'lucide-react';
import { compareBranches } from '../api/client';

export default function WhatIfSplitScreen({ 
  sessionId, 
  currentStep, 
  onClose, 
  onSwitchSession,
  isInline = false
}) {
  const [branchAGoal, setBranchAGoal] = useState('priority');
  const [branchAAlgo, setBranchAAlgo] = useState('vector_smart');
  const [branchBGoal, setBranchBGoal] = useState('revenue');
  const [branchBAlgo, setBranchBAlgo] = useState('baseline');
  
  const [comparison, setComparison] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleRunComparison = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await compareBranches({
        base_session_id: sessionId,
        fork_step: currentStep,
        branch_a_goal: branchAGoal,
        branch_a_algorithm: branchAAlgo,
        branch_b_goal: branchBGoal,
        branch_b_algorithm: branchBAlgo
      });
      setComparison(res);
    } catch (err) {
      setError(`Не удалось сравнить ветви: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={isInline ? 'compare-inline h-full min-h-0' : 'app-modal-layer fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4'}>
      <div className={`app-modal-card app-modal-card--wide compare-modal bg-space-900 border border-subtle w-full rounded shadow-2xl overflow-hidden flex flex-col ${isInline ? 'h-full min-h-0 max-w-none' : 'max-w-5xl max-h-[92vh]'}`}>
        
        {/* Header */}
        <div className="p-4 border-b border-subtle flex items-center justify-between bg-space-950/80">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-orbit-cyan/15 border border-orbit-cyan/40 flex items-center justify-center text-orbit-cyan">
              <GitFork className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-white text-base font-mono tracking-wider">
                  WHAT-IF РАЗВИЛКА // СРАВНЕНИЕ СТРАТЕГИЙ
                </h3>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-orbit-cyan/20 text-orbit-cyan font-mono">
                  SPLIT SCREEN
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono">
                Разветвление из фактического состояния на шаге {currentStep} с идентичной историей
              </p>
            </div>
          </div>

          {!isInline && <button onClick={onClose} className="p-1 rounded text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>}
        </div>

        {/* Setup Toolbar */}
        <div className="compare-setup p-4 border-b border-subtle bg-space-950/40 grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* Branch A Config */}
          <div className="compare-branch-config p-3 bg-space-850 border border-subtle rounded flex items-center justify-between">
            <div className="text-xs font-mono">
              <span className="font-bold text-orbit-emerald block mb-1">ВЕТВЬ А (Слева)</span>
              <div className="compare-selects flex gap-2 text-slate-300">
                <select
                  value={branchAGoal}
                  onChange={(e) => setBranchAGoal(e.target.value)}
                  className="bg-space-800 border border-subtle px-2 py-1 rounded text-xs"
                >
                  <option value="priority">Цель: Приоритет P3</option>
                  <option value="revenue">Цель: Выручка USD</option>
                </select>
                <select
                  value={branchAAlgo}
                  onChange={(e) => setBranchAAlgo(e.target.value)}
                  className="bg-space-800 border border-subtle px-2 py-1 rounded text-xs"
                >
                  <option value="vector_smart">Вектор-Орбита (Smart)</option>
                  <option value="baseline">Жадный EDF (Baseline)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Branch B Config */}
          <div className="compare-branch-config p-3 bg-space-850 border border-subtle rounded flex items-center justify-between">
            <div className="text-xs font-mono">
              <span className="font-bold text-orbit-amber block mb-1">ВЕТВЬ B (Справа)</span>
              <div className="compare-selects flex gap-2 text-slate-300">
                <select
                  value={branchBGoal}
                  onChange={(e) => setBranchBGoal(e.target.value)}
                  className="bg-space-800 border border-subtle px-2 py-1 rounded text-xs"
                >
                  <option value="revenue">Цель: Выручка USD</option>
                  <option value="priority">Цель: Приоритет P3</option>
                </select>
                <select
                  value={branchBAlgo}
                  onChange={(e) => setBranchBAlgo(e.target.value)}
                  className="bg-space-800 border border-subtle px-2 py-1 rounded text-xs"
                >
                  <option value="vector_smart">Вектор-Орбита (Smart)</option>
                  <option value="baseline">Жадный EDF (Baseline)</option>
                </select>
              </div>
            </div>
          </div>

        </div>

        {/* Action Button */}
        <div className="compare-action px-4 py-3 bg-space-950 flex items-center justify-between border-b border-subtle">
          <span className="text-xs font-mono text-slate-400">
            Шаг развилки: #{currentStep}. Обе ветви получат идентичное состояние КА.
          </span>
          <button
            onClick={handleRunComparison}
            disabled={loading}
            className="py-1.5 px-5 rounded bg-orbit-cyan hover:bg-orbit-cyan/90 text-black font-mono font-bold text-xs flex items-center gap-1.5 transition-all shadow-md shadow-orbit-cyan/10"
          >
            <Scale className="w-4 h-4" />
            <span>{loading ? 'Расчет сравнения...' : 'Запустить параллельное сравнение'}</span>
          </button>
        </div>
        {error && <div className="compare-error">{error}</div>}

        {/* Comparison Split Results */}
        <div className="flex-1 overflow-y-auto p-5">
          {comparison ? (
            <div className="space-y-6">
              <div className="compare-verdict">
                <div><span>КОНТРОЛЬНАЯ ТОЧКА</span><strong>Шаг {comparison.fork_step ?? currentStep}</strong></div>
                <div className="compare-verdict__statement">
                  <span>РЕКОМЕНДАЦИЯ</span>
                  <strong>{comparison.delta.critical_p3_jobs > 0 || comparison.delta.revenue_usd > 0 ? 'Ветвь А эффективнее' : comparison.delta.critical_p3_jobs < 0 || comparison.delta.revenue_usd < 0 ? 'Ветвь B эффективнее' : 'Результаты сопоставимы'}</strong>
                </div>
                <div><span>ГОРИЗОНТ</span><strong>До конца смены</strong></div>
              </div>
              
              {/* Delta Banner */}
              <div className="p-4 bg-space-850 border border-subtle rounded space-y-2 font-mono">
                <div className="flex items-center gap-2 text-xs font-bold text-white">
                  <TrendingUp className="w-4 h-4 text-orbit-cyan" />
                  <span>РЕЗУЛЬТАТ ДЕЛЬТА-АНАЛИЗА (ВЕТВЬ А vs ВЕТВЬ B):</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2 text-xs">
                  <div className="p-2.5 rounded bg-space-900 border border-subtle">
                    <span className="text-slate-400 block text-[10px]">Δ Выручка</span>
                    <span className={`text-base font-bold ${comparison.delta.revenue_usd >= 0 ? 'text-orbit-emerald' : 'text-orbit-ruby'}`}>
                      {comparison.delta.revenue_usd >= 0 ? '+' : ''}${comparison.delta.revenue_usd.toLocaleString()}
                    </span>
                  </div>
                  <div className="p-2.5 rounded bg-space-900 border border-subtle">
                    <span className="text-slate-400 block text-[10px]">Δ Задачи P3</span>
                    <span className={`text-base font-bold ${comparison.delta.critical_p3_jobs >= 0 ? 'text-orbit-emerald' : 'text-orbit-ruby'}`}>
                      {comparison.delta.critical_p3_jobs >= 0 ? '+' : ''}{comparison.delta.critical_p3_jobs} шт.
                    </span>
                  </div>
                  <div className="p-2.5 rounded bg-space-900 border border-subtle">
                    <span className="text-slate-400 block text-[10px]">Δ Потерянные шаги</span>
                    <span className={`text-base font-bold ${comparison.delta.wasted_work_steps <= 0 ? 'text-orbit-emerald' : 'text-orbit-ruby'}`}>
                      {comparison.delta.wasted_work_steps} шагов
                    </span>
                  </div>
                  <div className="p-2.5 rounded bg-space-900 border border-subtle">
                    <span className="text-slate-400 block text-[10px]">Δ Мин. заряд</span>
                    <span className="text-base font-bold text-white">
                      {comparison.delta.min_soc_pct >= 0 ? '+' : ''}{comparison.delta.min_soc_pct}%
                    </span>
                  </div>
                </div>

                {/* Verbal conclusions */}
                <div className="pt-2 text-xs text-slate-300 space-y-1">
                  {comparison.conclusions.map((c, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-orbit-cyan" />
                      <span>{c}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Side-by-Side Split Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono">
                
                {/* Branch A Card */}
                <div className="p-4 bg-space-850 border border-orbit-emerald/30 rounded space-y-3">
                  <div className="flex items-center justify-between border-b border-subtle pb-2">
                    <span className="text-xs font-bold text-orbit-emerald">ВЕТВЬ А // {comparison.branch_a.goal.toUpperCase()} · {(comparison.branch_a.algorithm || branchAAlgo).replace('vector_smart', 'SMART').replace('baseline', 'BASELINE')}</span>
                    <button
                      onClick={() => onSwitchSession(comparison.branch_a.session_id)}
                      className="text-[11px] text-orbit-emerald hover:underline flex items-center gap-1"
                    >
                      Переключить ЦУП на эту ветвь <ArrowUpRight className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between py-1 border-b border-subtle/40">
                      <span className="text-slate-400">Выручка:</span>
                      <span className="text-white font-bold">${comparison.branch_a.summary.revenue_usd.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-subtle/40">
                      <span className="text-slate-400">Задачи P3 в срок:</span>
                      <span className="text-orbit-emerald font-bold">{comparison.branch_a.summary.critical_jobs_completed_on_time} / {comparison.branch_a.summary.critical_jobs_due}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-subtle/40">
                      <span className="text-slate-400">Всего выполнено:</span>
                      <span className="text-slate-200">{comparison.branch_a.summary.jobs_completed} / {comparison.branch_a.summary.jobs_total}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-subtle/40">
                      <span className="text-slate-400">Мин. заряд SOC:</span>
                      <span className="text-orbit-amber">{comparison.branch_a.summary.minimum_soc_pct}%</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-slate-400">Потерянные шаги в сорванных задачах:</span>
                      <span className="text-slate-200">{comparison.branch_a.summary.work_steps_in_missed_jobs}</span>
                    </div>
                  </div>
                </div>

                {/* Branch B Card */}
                <div className="p-4 bg-space-850 border border-orbit-amber/30 rounded space-y-3">
                  <div className="flex items-center justify-between border-b border-subtle pb-2">
                    <span className="text-xs font-bold text-orbit-amber">ВЕТВЬ B // {comparison.branch_b.goal.toUpperCase()} · {(comparison.branch_b.algorithm || branchBAlgo).replace('vector_smart', 'SMART').replace('baseline', 'BASELINE')}</span>
                    <button
                      onClick={() => onSwitchSession(comparison.branch_b.session_id)}
                      className="text-[11px] text-orbit-amber hover:underline flex items-center gap-1"
                    >
                      Переключить ЦУП на эту ветвь <ArrowUpRight className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between py-1 border-b border-subtle/40">
                      <span className="text-slate-400">Выручка:</span>
                      <span className="text-white font-bold">${comparison.branch_b.summary.revenue_usd.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-subtle/40">
                      <span className="text-slate-400">Задачи P3 в срок:</span>
                      <span className="text-orbit-amber font-bold">{comparison.branch_b.summary.critical_jobs_completed_on_time} / {comparison.branch_b.summary.critical_jobs_due}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-subtle/40">
                      <span className="text-slate-400">Всего выполнено:</span>
                      <span className="text-slate-200">{comparison.branch_b.summary.jobs_completed} / {comparison.branch_b.summary.jobs_total}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-subtle/40">
                      <span className="text-slate-400">Мин. заряд SOC:</span>
                      <span className="text-orbit-amber">{comparison.branch_b.summary.minimum_soc_pct}%</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-slate-400">Потерянные шаги в сорванных задачах:</span>
                      <span className="text-slate-200">{comparison.branch_b.summary.work_steps_in_missed_jobs}</span>
                    </div>
                  </div>
                </div>

              </div>

            </div>
          ) : (
            <div className="py-16 text-center text-slate-500 font-mono text-xs">
              Нажмите «Запустить параллельное сравнение», чтобы рассчитать обе ветви из текущего состояния.
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
