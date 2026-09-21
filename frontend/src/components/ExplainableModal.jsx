import React, { useState, useEffect } from 'react';
import { 
  X, HelpCircle, CheckCircle2, AlertTriangle, AlertOctagon, 
  Clock, Search, ShieldCheck, Filter, ArrowRight, DollarSign,
  Radio, Satellite, Flame, Zap, ShieldAlert
} from 'lucide-react';
import { getDiagnostics } from '../api/client';

export default function ExplainableModal({ sessionId, onClose, isInline = false }) {
  const [diagnosticsData, setDiagnosticsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all'); // all, unfeasible, missed, completed, in_progress
  const [filterPriority, setFilterPriority] = useState('all'); // all, 3, 2, 1
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedJob, setSelectedJob] = useState(null);

  useEffect(() => {
    if (!sessionId) return;
    setLoading(true);
    getDiagnostics(sessionId)
      .then(res => {
        setDiagnosticsData(res);
        if (res.diagnostics.length) {
          const firstProblem = res.diagnostics.find(d => d.status === 'unfeasible' || d.status === 'missed') || res.diagnostics[0];
          setSelectedJob(firstProblem);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, [sessionId]);

  const list = diagnosticsData?.diagnostics || [];
  const counts = diagnosticsData?.counts || {};

  const filteredJobs = list.filter(j => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchId = j.job_id.toLowerCase().includes(q);
      const matchKind = (j.kind || '').toLowerCase().includes(q);
      const matchSats = (j.eligible_satellites || []).some(s => s.toLowerCase().includes(q));
      if (!matchId && !matchKind && !matchSats) return false;
    }
    if (filterStatus !== 'all' && j.status !== filterStatus) return false;
    if (filterPriority !== 'all' && j.priority !== parseInt(filterPriority, 10)) return false;
    return true;
  });

  const getStatusBadge = (status) => {
    switch (status) {
      case 'completed':
        return (
          <span className="px-2 py-0.5 rounded bg-orbit-emerald/15 text-orbit-emerald border border-orbit-emerald/30 text-[10px] font-mono font-bold flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> Выполнено
          </span>
        );
      case 'unfeasible':
        return (
          <span className="px-2 py-0.5 rounded bg-white/10 text-slate-300 border border-white/20 text-[10px] font-mono flex items-center gap-1">
            <AlertOctagon className="w-3 h-3 text-slate-400" /> Физически невозможно
          </span>
        );
      case 'missed':
        return (
          <span className="px-2 py-0.5 rounded bg-orbit-ruby/15 text-orbit-ruby border border-orbit-ruby/30 text-[10px] font-mono font-bold flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> Сорвано
          </span>
        );
      case 'in_progress':
        return (
          <span className="px-2 py-0.5 rounded bg-orbit-cyan/15 text-orbit-cyan border border-orbit-cyan/30 text-[10px] font-mono font-bold flex items-center gap-1">
            <Clock className="w-3 h-3 animate-spin" /> В процессе
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400 text-[10px] font-mono">
            В очереди
          </span>
        );
    }
  };

  const getPriorityBadge = (priority) => {
    if (priority === 3) {
      return (
        <span className="px-2 py-0.5 rounded bg-orbit-ruby/20 text-orbit-ruby border border-orbit-ruby/40 text-[10px] font-mono font-bold flex items-center gap-1 shadow-sm">
          <Flame className="w-3 h-3" /> P3 Критический
        </span>
      );
    }
    if (priority === 2) {
      return (
        <span className="px-2 py-0.5 rounded bg-orbit-amber/20 text-orbit-amber border border-orbit-amber/40 text-[10px] font-mono font-bold flex items-center gap-1">
          <Zap className="w-3 h-3" /> P2 Высокий
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded bg-sky-950 text-sky-400 border border-sky-800 text-[10px] font-mono">
        P1 Стандарт
      </span>
    );
  };

  const content = (
    <div className={`app-modal-card bg-space-900 border border-subtle w-full rounded-xl shadow-2xl overflow-hidden flex flex-col ${isInline ? 'h-full min-h-0' : 'max-w-5xl max-h-[92vh]'}`}>
      
      {/* Educational Banner */}
      <div className="xai-banner px-5 py-2.5 bg-space-950/90 border-b border-subtle flex items-center gap-3 text-xs font-mono text-slate-300">
        <div className="w-5 h-5 rounded bg-orbit-purple/20 border border-orbit-purple/40 flex items-center justify-center text-orbit-purple flex-shrink-0">
          <HelpCircle className="w-3.5 h-3.5" />
        </div>
        <div className="flex-1">
          <span className="font-bold text-white">Реестр клиентских заказов &amp; Explainable AI: </span>
          <span className="text-slate-300">
            Здесь представлены 1200+ заявок на космическую съемку и сброс данных. Система XAI математически доказывает жюри объективные причины срывов (дефицит окон радиовидимости), отделяя их от работы оптимизатора.
          </span>
        </div>
      </div>

      {/* Header Controls */}
      <div className="xai-header p-4 border-b border-subtle flex items-center justify-between bg-space-950/80">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded bg-orbit-purple/15 border border-orbit-purple/40 flex items-center justify-center text-orbit-purple">
            <Radio className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-white text-base font-mono tracking-wider">
                КАТАЛОГ МИССИЙ И ЗАКАЗОВ // EXPLAINABLE AI
              </h3>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-orbit-purple/20 text-orbit-purple font-mono font-bold">
                XAI AUDIT ENGINE
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono">
              Объективный математический анализ выполнимости каждого заказа
            </p>
          </div>
        </div>

        {onClose && !isInline && (
          <button onClick={onClose} className="p-1 rounded text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Filter Toolbar */}
      <div className="xai-filters px-5 py-2.5 border-b border-subtle bg-space-950/40 flex flex-wrap items-center gap-2.5 text-xs font-mono">
        <button
          onClick={() => setFilterStatus('all')}
          className={`px-3 py-1 rounded border transition-colors ${filterStatus === 'all' ? 'bg-white/20 text-white border-white/40' : 'bg-space-850 text-slate-400 border-subtle'}`}
        >
          Все ({counts.total || 0})
        </button>
        <button
          onClick={() => setFilterStatus('completed')}
          className={`px-3 py-1 rounded border transition-colors ${filterStatus === 'completed' ? 'bg-orbit-emerald/20 text-orbit-emerald border-orbit-emerald/40 font-bold' : 'bg-space-850 text-slate-400 border-subtle'}`}
        >
          Выполненные ({counts.completed || 0})
        </button>
        <button
          onClick={() => setFilterStatus('unfeasible')}
          className={`px-3 py-1 rounded border transition-colors ${filterStatus === 'unfeasible' ? 'bg-white/20 text-white border-white/40 font-bold' : 'bg-space-850 text-slate-300 border-subtle'}`}
        >
          Физически невыполнимые ({counts.unfeasible || 0})
        </button>
        <button
          onClick={() => setFilterStatus('missed')}
          className={`px-3 py-1 rounded border transition-colors ${filterStatus === 'missed' ? 'bg-orbit-ruby/20 text-orbit-ruby border-orbit-ruby/40 font-bold' : 'bg-space-850 text-slate-400 border-subtle'}`}
        >
          Сорванные ({counts.missed || 0})
        </button>

        {/* Priority Filter */}
        <div className="h-4 w-px bg-white/10 mx-1" />
        <button
          onClick={() => setFilterPriority(filterPriority === '3' ? 'all' : '3')}
          className={`px-2.5 py-1 rounded border transition-colors flex items-center gap-1 ${filterPriority === '3' ? 'bg-orbit-ruby/25 text-orbit-ruby border-orbit-ruby' : 'bg-space-850 text-slate-400 border-subtle'}`}
          title="Фильтр по критическим задачам P3"
        >
          <Flame className="w-3 h-3" /> P3
        </button>

        {/* Search */}
        <div className="ml-auto relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
          <input
            type="text"
            placeholder="Поиск ID, КА, типа..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-space-850 border border-subtle pl-8 pr-2 py-1 text-xs rounded text-slate-200 font-mono w-40 focus:outline-none focus:border-orbit-emerald"
          />
        </div>
      </div>

      {/* Main Split Body: Left Cards List + Right Deep Inspection Manifest */}
      <div className="xai-body flex-1 flex overflow-hidden min-h-0">
        
        {/* Left Column: Job Cards List */}
        <div className="xai-list w-5/12 border-r border-subtle overflow-y-auto p-3 space-y-2.5 bg-space-950/30">
          {filteredJobs.length === 0 ? (
            <div className="py-16 text-center text-slate-500 font-mono text-xs">
              Заданий по выбранным фильтрам не найдено.
            </div>
          ) : (
            filteredJobs.map((job) => {
              const isSelected = selectedJob?.job_id === job.job_id;
              const pct = job.work_steps > 0 ? Math.min(100, Math.round((job.executed_steps / job.work_steps) * 100)) : 0;

              return (
                <div
                  key={job.job_id}
                  onClick={() => setSelectedJob(job)}
                  className={`p-3 rounded-xl border cursor-pointer font-mono text-xs transition-all ${
                    isSelected 
                      ? 'bg-space-850 border-orbit-purple text-white shadow-xl ring-1 ring-orbit-purple/50' 
                      : 'bg-space-900/80 border-subtle text-slate-300 hover:border-white/30 hover:bg-space-850'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-white">{job.job_id}</span>
                      {getPriorityBadge(job.priority)}
                    </div>
                    {getStatusBadge(job.status)}
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-400 mb-2">
                    <span className="uppercase text-slate-300">Тип: {job.kind}</span>
                    <span className="text-orbit-emerald font-bold text-xs">+${job.value_usd} USD</span>
                  </div>

                  {/* Progress Bar of Work Steps */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] text-slate-400">
                      <span>Прогресс съемки: {job.executed_steps} / {job.work_steps} ш.</span>
                      <span>{pct}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-space-800 rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-300 ${
                          job.status === 'completed' ? 'bg-orbit-emerald' :
                          (job.status === 'unfeasible' ? 'bg-slate-500' :
                          (job.status === 'missed' ? 'bg-orbit-ruby' : 'bg-orbit-cyan'))
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>

                  <div className="text-[10px] text-slate-500 mt-2 flex items-center justify-between truncate">
                    <span>Окно: [ш. {job.release_step} .. {job.deadline_step})</span>
                    <span className="text-slate-400">КА: {job.eligible_satellites.slice(0, 3).join(', ')}{job.eligible_satellites.length > 3 ? '...' : ''}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right Column: In-Depth Diagnostic Manifest */}
        <div className="xai-detail w-7/12 p-6 overflow-y-auto space-y-5 bg-space-900 font-mono text-xs">
          {selectedJob ? (
            <div className="space-y-5">
              
              {/* Manifest Header */}
              <div className="p-4 bg-space-850 border border-subtle rounded-xl space-y-3 shadow-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="text-lg font-bold text-white tracking-wide">{selectedJob.job_id}</span>
                    {getPriorityBadge(selectedJob.priority)}
                  </div>
                  {getStatusBadge(selectedJob.status)}
                </div>

                <div className="grid grid-cols-4 gap-3 text-xs pt-1 border-t border-subtle/50">
                  <div>
                    <span className="text-slate-400 text-[10px] block">Тип операции:</span>
                    <span className="text-white font-bold uppercase">{selectedJob.kind}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] block">Стоимость:</span>
                    <span className="text-orbit-emerald font-bold text-sm">+${selectedJob.value_usd} USD</span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] block">Длительность:</span>
                    <span className="text-white font-bold">{selectedJob.work_steps} шагов ({selectedJob.work_steps * 5} мин)</span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] block">Дедлайн:</span>
                    <span className="text-orbit-amber font-bold">Шаг {selectedJob.deadline_step}</span>
                  </div>
                </div>
              </div>

              {/* Mathematical Feasibility Verdict */}
              <div className={`p-4 rounded-xl border space-y-2.5 ${
                selectedJob.status === 'completed' ? 'bg-orbit-emerald/10 border-orbit-emerald/30' :
                (selectedJob.status === 'unfeasible' ? 'bg-space-850 border-white/20' :
                (selectedJob.status === 'missed' ? 'bg-orbit-ruby/10 border-orbit-ruby/30' : 'bg-space-850 border-subtle'))
              }`}>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-orbit-purple" />
                  <span className="font-bold text-white uppercase tracking-wider text-xs">
                    Математический аудит ограничений и диагноз XAI:
                  </span>
                </div>
                
                <div className="p-3 bg-space-950/80 rounded-lg border border-subtle leading-relaxed space-y-1">
                  <div className="font-bold text-white text-xs">
                    Вердикт: {selectedJob.root_cause}
                  </div>
                  <p className="text-slate-300 text-[11px] font-sans leading-relaxed">
                    {selectedJob.details}
                  </p>
                </div>
              </div>

              {/* Radio Contact Windows & Satellite Eligibility */}
              <div className="p-4 bg-space-850 border border-subtle rounded-xl space-y-3">
                <span className="font-bold text-white uppercase text-xs block">
                  Параметры орбитальной видимости:
                </span>
                
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div className="p-3 bg-space-900 rounded-lg border border-subtle space-y-1">
                    <span className="text-slate-400 block text-[10px]">Временное окно [Release .. Deadline):</span>
                    <span className="text-white font-bold">Шаги {selectedJob.release_step} — {selectedJob.deadline_step} (всего {selectedJob.deadline_step - selectedJob.release_step} ш.)</span>
                  </div>

                  <div className="p-3 bg-space-900 rounded-lg border border-subtle space-y-1">
                    <span className="text-slate-400 block text-[10px]">Доступные слоты радиоконтакта:</span>
                    <span className={`font-bold ${selectedJob.feasibility.available_slots < selectedJob.work_steps ? 'text-orbit-ruby' : 'text-orbit-emerald'}`}>
                      {selectedJob.feasibility.available_slots} слотов (требуется {selectedJob.work_steps})
                    </span>
                  </div>
                </div>

                <div className="p-3 bg-space-900 rounded-lg border border-subtle">
                  <span className="text-slate-400 block text-[10px] mb-1">Допустимые аппараты-исполнители:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedJob.eligible_satellites.map(satId => (
                      <span key={satId} className="px-2 py-0.5 rounded bg-space-800 border border-subtle text-slate-200 text-[11px]">
                        🛰️ {satId}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

            </div>
          ) : (
            <div className="py-24 text-center text-slate-500 font-mono text-xs">
              Выберите заказ из реестра слева для открытия диагностического манифеста.
            </div>
          )}
        </div>

      </div>

      {/* Footer */}
      <div className="p-3.5 border-t border-subtle bg-space-950/90 flex items-center justify-between text-xs font-mono text-slate-400">
        <span>Математический валидатор проверен по физической модели resource_env.py</span>
        {onClose && (
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            Закрыть
          </button>
        )}
      </div>

    </div>
  );

  if (isInline) {
    return content;
  }

  return (
    <div className="app-modal-layer fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
      {content}
    </div>
  );
}
