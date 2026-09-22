import React, { useState, useEffect } from 'react';
import { 
  X, Battery, Thermometer, Gauge, Sun, Zap, AlertTriangle, 
  Cpu, Radio, ArrowUpRight, ArrowDownRight, Minus, Wrench, Shield
} from 'lucide-react';
import { getSatelliteTelemetry } from '../api/client';
import AnimatedNumber from './AnimatedNumber';

export default function SatelliteInspector({ 
  sessionId, 
  satelliteId, 
  onClose,
  satState 
}) {
  const [telemetry, setTelemetry] = useState(null);

  useEffect(() => {
    if (!sessionId || !satelliteId) return;
    getSatelliteTelemetry(sessionId, satelliteId)
      .then(data => setTelemetry(data))
      .catch(err => console.error(err));
  }, [sessionId, satelliteId]);

  if (!satelliteId) return null;

  const history = telemetry?.history || [];
  const reserveSoc = telemetry?.reserve_soc_pct || 30.0;
  const criticalSoc = telemetry?.critical_soc_pct || 20.0;
  const capacityWh = telemetry?.capacity_wh || satState?.capacity_wh || 120.0;

  const currentSoc = Number(satState?.soc_pct || 0);
  const currentTemp = Number(satState?.temp_c || 0);
  const currentEnergy = Number(satState?.energy_wh || 0);
  const currentCalAge = satState?.calibration_age_steps || 0;
  const isAvailable = satState?.available ?? true;
  const currentAction = satState?.current_action || 'idle';
  const activeJobId = satState?.active_job_id;

  // Power flow values
  const solarW = Number(satState?.solar_w || 0);
  const loadW = Number(satState?.load_w || 18.0);
  const netDeltaW = Number((solarW - loadW).toFixed(1));
  const isCharging = netDeltaW > 0.05;
  const isDischarging = netDeltaW < -0.05;

  // Action title & badge color
  const getActionBadge = () => {
    if (!isAvailable) {
      return {
        title: 'АВАРИЙНЫЙ СБОЙ (OUTAGE)',
        badge: 'bg-orbit-ruby/20 text-orbit-ruby border-orbit-ruby/40',
        note: 'Аппарат временно выведен из строя'
      };
    }
    if (currentAction.includes('downlink')) {
      return {
        title: 'СБРОС ДАННЫХ (DOWNLINK)',
        badge: 'bg-orbit-cyan/20 text-orbit-cyan border-orbit-cyan/40',
        note: 'Передача пакетов в ЦУП «Восточный» (-90 Вт)'
      };
    }
    if (currentAction.includes('relay')) {
      return {
        title: 'РЕТРАНСЛЯЦИЯ (RELAY)',
        badge: 'bg-orbit-purple/20 text-orbit-purple border-orbit-purple/40',
        note: 'Межспутниковый лазерный канал (-65 Вт)'
      };
    }
    if (currentAction.includes('calibrate')) {
      return {
        title: 'КАЛИБРОВКА (CALIBRATE)',
        badge: 'bg-orbit-amber/20 text-orbit-amber border-orbit-amber/40',
        note: 'Юстировка датчиков полезной нагрузки (-20 Вт)'
      };
    }
    if (currentAction.includes('job')) {
      return {
        title: `СЪЕМКА [${activeJobId || currentAction}]`,
        badge: 'bg-orbit-emerald/20 text-orbit-emerald border-orbit-emerald/40',
        note: 'Выполнение оптической съемки земной поверхности'
      };
    }
    return {
      title: 'ОЖИДАНИЕ (IDLE)',
      badge: 'bg-white/10 text-slate-300 border-white/20',
      note: solarW > 0 ? 'Зарядка на солнечной стороне орбиты' : 'Экономный полет в тени Земли'
    };
  };

  const actionInfo = getActionBadge();

  return (
    <div 
      className="satellite-inspector fixed top-16 right-4 bg-space-900/95 border border-slate-700/80 rounded-xl shadow-2xl z-40 backdrop-blur-xl flex flex-col font-mono text-xs overflow-hidden animate-in fade-in slide-in-from-right duration-200"
      style={{ touchAction: 'pan-y' }}
    >
      {/* Mobile handle indicator */}
      <div className="w-10 h-1 rounded-full bg-slate-600/50 mx-auto my-1.5 md:hidden" aria-hidden="true" />

      {/* 1. Header Ribbon */}
      <div className="p-3 border-b border-subtle bg-space-850/90 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-orbit-emerald/15 border border-orbit-emerald/40 flex items-center justify-center text-orbit-emerald">
            <Cpu className="w-3.5 h-3.5" />
          </div>
          <span className="font-bold text-white text-sm tracking-wide">
            КА // {satelliteId}
          </span>
          <span className={`text-[10px] px-2 py-0.5 rounded border font-bold ${
            isAvailable ? 'bg-orbit-emerald/15 text-orbit-emerald border-orbit-emerald/30' : 'bg-orbit-ruby/15 text-orbit-ruby border-orbit-ruby/30'
          }`}>
            {isAvailable ? 'ШТАТНО' : 'ОТКАЗ'}
          </span>
        </div>

        <button
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
          title="Закрыть инспектор"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* 2. Main Body */}
      <div 
        className="satellite-inspector__body flex-1 min-h-0 p-3.5 space-y-3 max-h-[calc(100vh-120px)] overflow-y-auto"
        style={{ touchAction: 'pan-y', WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain' }}
      >
        
        {/* Current Operation */}
        <div className={`p-2.5 rounded-lg border flex flex-col gap-1 ${actionInfo.badge}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 font-bold text-xs tracking-wide">
              <Radio className="w-3.5 h-3.5 animate-pulse" />
              <span>{actionInfo.title}</span>
            </div>
          </div>
          <div className="text-[11px] text-slate-300 font-sans leading-tight">
            {actionInfo.note}
          </div>
        </div>

        {/* 3. TACTICAL POWER BALANCE (Clear Net Energy Flow) */}
        <div className="bg-space-850 border border-slate-700/60 p-3 rounded-lg space-y-2">
          <div className="flex items-center justify-between text-[11px] text-slate-300">
            <span className="font-bold uppercase tracking-wider text-slate-400">
              Баланс мощности
            </span>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 border ${
              isCharging 
                ? 'bg-orbit-emerald/20 text-orbit-emerald border-orbit-emerald/40' 
                : (isDischarging ? 'bg-orbit-amber/20 text-orbit-amber border-orbit-amber/40' : 'bg-white/10 text-slate-300 border-white/20')
            }`}>
              {isCharging && <ArrowUpRight className="w-3 h-3 text-orbit-emerald" />}
              {isDischarging && <ArrowDownRight className="w-3 h-3 text-orbit-amber" />}
              {!isCharging && !isDischarging && <Minus className="w-3 h-3 text-slate-400" />}
              {isCharging ? 'ЗАРЯДКА' : (isDischarging ? 'РАЗРЯД' : 'БАЛАНС')}
            </span>
          </div>

          {/* Grid Power Flow */}
          <div className="space-y-1.5 pt-1 text-[11px]">
            <div className="flex items-center justify-between text-slate-300">
              <span className="flex items-center gap-1.5 text-slate-400">
                <Sun className="w-3.5 h-3.5 text-orbit-amber" />
                Солнечные батареи:
              </span>
              <span className={solarW > 0 ? 'text-orbit-emerald font-bold' : 'text-slate-500'}>
                +{solarW.toFixed(1)} Вт {solarW === 0 ? '(тень)' : ''}
              </span>
            </div>

            <div className="flex items-center justify-between text-slate-300">
              <span className="flex items-center gap-1.5 text-slate-400">
                <Zap className="w-3.5 h-3.5 text-orbit-cyan" />
                Потребление систем:
              </span>
              <span className="text-orbit-ruby font-bold">
                -{loadW.toFixed(1)} Вт
              </span>
            </div>

            <div className="h-px bg-slate-700/60 my-1" />

            <div className="flex items-center justify-between font-bold text-xs">
              <span className="text-slate-300">Результирующий баланс:</span>
              <span className={isCharging ? 'text-orbit-emerald' : (isDischarging ? 'text-orbit-amber' : 'text-white')}>
                {netDeltaW > 0 ? `+${netDeltaW.toFixed(1)}` : netDeltaW.toFixed(1)} Вт
              </span>
            </div>
          </div>
        </div>

        {/* 4. Three Mini Telemetry Tiles */}
        <div className="grid grid-cols-3 gap-2">
          
          {/* SoC */}
          <div className="p-2.5 bg-space-850 border border-slate-700/60 rounded-lg">
            <div className="flex items-center gap-1 text-[10px] text-slate-400 mb-0.5">
              <Battery className="w-3 h-3 text-orbit-emerald" />
              <span>Заряд (SoC)</span>
            </div>
            <div className={`text-lg font-bold ${
              currentSoc < reserveSoc ? 'text-orbit-ruby' : (currentSoc < 40 ? 'text-orbit-amber' : 'text-orbit-emerald')
            }`}>
              <AnimatedNumber value={currentSoc} decimals={1} suffix="%" duration={350} />
            </div>
            <div className="text-[9px] text-slate-400 mt-0.5 truncate">
              {currentEnergy.toFixed(1)}/{capacityWh} Вт·ч
            </div>
          </div>

          {/* Temperature */}
          <div className="p-2.5 bg-space-850 border border-slate-700/60 rounded-lg">
            <div className="flex items-center gap-1 text-[10px] text-slate-400 mb-0.5">
              <Thermometer className="w-3 h-3 text-orbit-terracotta" />
              <span>Темп-ра</span>
            </div>
            <div className="text-lg font-bold text-white">
              <AnimatedNumber value={currentTemp} decimals={1} suffix="°C" duration={350} />
            </div>
            <div className="text-[9px] text-slate-400 mt-0.5">
              [5..45°C]
            </div>
          </div>

          {/* Calibration */}
          <div className="p-2.5 bg-space-850 border border-slate-700/60 rounded-lg">
            <div className="flex items-center gap-1 text-[10px] text-slate-400 mb-0.5">
              <Gauge className="w-3 h-3 text-orbit-amber" />
              <span>Калибр.</span>
            </div>
            <div className={`text-lg font-bold ${currentCalAge >= 45 ? 'text-orbit-ruby' : 'text-orbit-amber'}`}>
              <AnimatedNumber value={currentCalAge} duration={300} />/48
            </div>
            <div className="text-[9px] text-slate-400 mt-0.5 truncate">
              {currentCalAge >= 48 ? 'БЛОКИРОВАН' : `Осталось ${48 - currentCalAge} ш.`}
            </div>
          </div>

        </div>

        {/* 5. Mini Telemetry History (Last 5 steps) */}
        {history.length > 0 && (
          <div className="bg-space-850 border border-slate-700/60 p-2.5 rounded-lg space-y-1.5">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Последние шаги телеметрии
            </div>
            <table className="w-full text-left font-mono text-[10px]">
              <thead className="text-slate-500 border-b border-slate-700/60">
                <tr>
                  <th className="py-0.5">Шаг</th>
                  <th>Действие</th>
                  <th>Солнце</th>
                  <th>Нагр.</th>
                  <th className="text-right">SoC</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-300">
                {history.slice(-5).reverse().map((h, i) => (
                  <tr key={i} className="hover:bg-white/5">
                    <td className="py-1 text-slate-400">#{h.step}</td>
                    <td>
                      <span className={`px-1 py-0.2 rounded text-[9px] ${
                        h.action === 'calibrate' ? 'text-orbit-amber' :
                        (h.action === 'downlink' ? 'text-orbit-cyan' : 
                        (h.action === 'relay' ? 'text-orbit-purple' : 'text-slate-400'))
                      }`}>
                        {h.action}
                      </span>
                    </td>
                    <td className="text-orbit-emerald">+{Number(h.solar_w || 0).toFixed(0)}W</td>
                    <td className="text-orbit-ruby">-{Number(h.load_w || 18).toFixed(0)}W</td>
                    <td className={`text-right font-bold ${h.soc_pct < 30 ? 'text-orbit-ruby' : 'text-slate-200'}`}>
                      {Number(h.soc_pct).toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      </div>

      {/* 3. Footer */}
      <div className="p-2.5 border-t border-subtle bg-space-850/80 flex items-center justify-between text-[11px] text-slate-400">
        <span>Резерв АКБ: {reserveSoc}%</span>
        <button
          onClick={onClose}
          className="px-3 py-1 rounded bg-orbit-terracotta hover:bg-orbit-terracotta/90 text-white font-sans text-xs font-semibold transition-colors"
        >
          Скрыть
        </button>
      </div>

    </div>
  );
}
