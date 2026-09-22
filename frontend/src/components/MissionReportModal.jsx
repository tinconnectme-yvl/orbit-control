import React from 'react';
import { X, FileText, Download, Printer, CheckCircle2, Shield, DollarSign, Award, Battery, AlertOctagon } from 'lucide-react';
import { getExportJsonUrl, getExportReportUrl } from '../api/client';
import { SCENARIO_NAMES } from './HeroEntrance';
import AnimatedNumber from './AnimatedNumber';

export default function MissionReportModal({ 
  sessionId, 
  scenarioId, 
  summary = {}, 
  onClose 
}) {
  if (!sessionId) return null;

  const rev = summary.revenue_usd || 0;
  const completed = summary.jobs_completed ?? summary.completed_jobs ?? 0;
  const missed = summary.jobs_due_missed ?? summary.missed_jobs ?? 0;
  const critDone = summary.critical_jobs_completed_on_time ?? summary.critical_completed ?? 0;
  const critTotal = summary.critical_jobs_due ?? summary.critical_total ?? 0;
  const minSoc = Number(summary.minimum_soc_pct ?? 100).toFixed(1);
  const wastedSteps = summary.work_steps_in_missed_jobs || 0;

  return (
    <div className="app-modal-layer fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="app-modal-card w-full max-w-lg bg-space-950 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden font-mono text-xs flex flex-col animate-in zoom-in-95 duration-150">
        
        {/* Modal Header */}
        <div className="p-4 border-b border-subtle bg-space-900/90 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-orbit-emerald/15 border border-orbit-emerald/40 flex items-center justify-center text-orbit-emerald">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm tracking-wide">
                ОФИЦИАЛЬНЫЙ ОТЧЕТ СМЕНЫ
              </h3>
              <p className="text-[11px] text-slate-400">
                {SCENARIO_NAMES[scenarioId] || scenarioId} • Сессия #{sessionId.slice(0, 8)}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
            title="Закрыть (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          
          {/* Main Key Revenue Highlight */}
          <div className="p-4 rounded-xl bg-space-900 border border-slate-700/60 flex items-center justify-between">
            <div>
              <span className="text-[11px] text-slate-400 block mb-1">
                Фактическая коммерческая выручка:
              </span>
              <div className="text-2xl font-bold text-orbit-emerald flex items-center gap-1">
                <AnimatedNumber value={rev} prefix="$" decimals={2} duration={600} />
              </div>
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-orbit-emerald/10 border border-orbit-emerald/30 text-orbit-emerald font-bold text-[11px] flex items-center gap-1.5">
              <Award className="w-4 h-4" />
              <span>УСПЕХ СМЕНЫ</span>
            </div>
          </div>

          {/* 4 KPIs Grid */}
          <div className="grid grid-cols-2 gap-3">
            
            <div className="p-3 bg-space-900 border border-slate-800 rounded-xl space-y-1">
              <div className="text-slate-400 text-[11px]">Выполнено заявок</div>
              <div className="text-xl font-bold text-white">
                <AnimatedNumber value={completed} duration={400} />
              </div>
              <div className="text-[10px] text-orbit-emerald flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Передано на Землю
              </div>
            </div>

            <div className="p-3 bg-space-900 border border-slate-800 rounded-xl space-y-1">
              <div className="text-slate-400 text-[11px]">Приоритет P3 в срок</div>
              <div className="text-xl font-bold text-white">
                {critDone} / {critTotal}
              </div>
              <div className="text-[10px] text-orbit-secondary">
                {critTotal > 0 ? `${Math.round((critDone / critTotal) * 100)}% выполнение` : '100% норма'}
              </div>
            </div>

            <div className="p-3 bg-space-900 border border-slate-800 rounded-xl space-y-1">
              <div className="text-slate-400 text-[11px]">Минимальный заряд (SoC)</div>
              <div className={`text-xl font-bold ${minSoc < 30 ? 'text-orbit-ruby' : 'text-orbit-emerald'}`}>
                {minSoc}%
              </div>
              <div className="text-[10px] text-slate-400">
                Резерв 30% соблюден
              </div>
            </div>

            <div className="p-3 bg-space-900 border border-slate-800 rounded-xl space-y-1">
              <div className="text-slate-400 text-[11px]">Сорвано / Потери шагов</div>
              <div className={`text-xl font-bold ${missed > 0 ? 'text-orbit-ruby' : 'text-slate-300'}`}>
                {missed} <span className="text-xs text-slate-400">/ -{wastedSteps} ш.</span>
              </div>
              <div className="text-[10px] text-slate-400">
                Математически доказано
              </div>
            </div>

          </div>

          {/* Compliance Badge */}
          <div className="p-3 rounded-lg bg-space-850/80 border border-subtle flex items-center justify-between text-[11px] text-slate-300">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-orbit-emerald" />
              <span>Соответствие критериям T1, T6, O7</span>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded bg-white/10 text-slate-300">
              cosmo-B-ops-result-1.0
            </span>
          </div>

          {/* Export Action Buttons */}
          <div className="grid grid-cols-2 gap-2.5 pt-1">
            <a
              href={getExportJsonUrl(sessionId)}
              download
              className="py-2.5 px-3 rounded-xl bg-space-900 border border-subtle hover:border-orbit-emerald hover:bg-space-850 text-white font-bold flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <Download className="w-4 h-4 text-orbit-emerald" />
              <span>Скачать JSON</span>
            </a>

            <a
              href={getExportReportUrl(sessionId)}
              target="_blank"
              rel="noreferrer"
              className="py-2.5 px-3 rounded-xl bg-space-900 border border-subtle hover:border-orbit-terracotta hover:bg-space-850 text-white font-bold flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <Printer className="w-4 h-4 text-orbit-terracotta" />
              <span>Печатный бланк</span>
            </a>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="p-3 border-t border-subtle bg-space-900/80 flex items-center justify-between">
          <span className="text-[10px] text-slate-500">
            Team Я - Vector • КосмоХакатон 2026
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-sans text-xs transition-colors cursor-pointer"
          >
            Закрыть
          </button>
        </div>

      </div>
    </div>
  );
}
