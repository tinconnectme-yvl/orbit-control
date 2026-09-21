import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  ZoomIn, ZoomOut, Search, Radio, Info, Layers, Satellite, Filter
} from 'lucide-react';

export default function ConstellationGantt({ 
  sessionState, 
  timelineData,
  currentStep = 0,
  simTime = 0,
  onSelectSatellite, 
  selectedSatelliteId 
}) {
  const [zoomLevel, setZoomLevel] = useState(1); // 1 = fit, 2 = 1x, 3 = 2x
  const [searchQuery, setSearchQuery] = useState('');
  const [filterAction, setFilterAction] = useState('all'); // all, downlink, relay, calibrate, outage
  
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [hoveredCell, setHoveredCell] = useState(null);

  const satellites = sessionState?.satellites || timelineData?.steps?.[0]?.satellites || [];
  const totalSteps = timelineData?.total_steps || sessionState?.total_steps || 48;
  const step_s = timelineData?.step_s || 300;

  // Filter satellites
  const filteredSatellites = useMemo(() => {
    return satellites.filter(s => {
      const matchesSearch = s.id.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;
      if (filterAction === 'all') return true;
      if (filterAction === 'outage') return !s.available;
      if (filterAction === 'downlink') return (s.current_action || '').includes('downlink');
      if (filterAction === 'relay') return (s.current_action || '').includes('relay');
      if (filterAction === 'calibrate') return (s.current_action || '').includes('calibrate');
      return true;
    });
  }, [satellites, searchQuery, filterAction]);

  // Width of each step block in pixels
  const colWidth = useMemo(() => {
    if (zoomLevel === 1) return totalSteps <= 48 ? 16 : 5;
    if (zoomLevel === 2) return totalSteps <= 48 ? 26 : 10;
    return totalSteps <= 48 ? 42 : 18;
  }, [zoomLevel, totalSteps]);

  const rowHeight = 22;
  const headerHeight = 26;
  const labelWidth = 56;

  // Fast color palette for action types
  const getActionColor = (act = '', isAvailable = true) => {
    if (!isAvailable) return '#EF4444'; // Outage red
    if (act.includes('downlink')) return '#00E5FF'; // Downlink cyan
    if (act.includes('relay')) return '#A855F7';    // Relay purple
    if (act.includes('calibrate')) return '#F59E0B';// Calibration amber
    if (act.includes('job')) return '#10B981';      // Work job emerald
    return '#0B0F19';                               // Idle / background
  };

  // High performance Canvas Matrix Renderer
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const satCount = filteredSatellites.length;
    const totalW = labelWidth + totalSteps * colWidth;
    const totalH = headerHeight + satCount * rowHeight;

    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(totalW * dpr);
    canvas.height = Math.round(totalH * dpr);
    canvas.style.width = `${totalW}px`;
    canvas.style.height = `${totalH}px`;

    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, totalW, totalH);

    // 1. Draw Step Header
    ctx.fillStyle = '#060911';
    ctx.fillRect(0, 0, totalW, headerHeight);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, headerHeight);
    ctx.lineTo(totalW, headerHeight);
    ctx.stroke();

    ctx.font = '10px JetBrains Mono, monospace';
    ctx.fillStyle = '#64748B';
    ctx.fillText('КА \\ ШАГ', 6, 17);

    const labelInterval = totalSteps <= 48 ? 6 : (colWidth >= 10 ? 12 : 24);
    for (let k = 0; k < totalSteps; k++) {
      const x = labelWidth + k * colWidth;
      if (k % labelInterval === 0) {
        ctx.fillStyle = '#94A3B8';
        ctx.fillText(String(k), x + 2, 17);
      }
    }

    // 2. Pre-index steps data from timelineData
    const stepsData = timelineData?.steps || [];

    // 3. Draw Satellite Matrix Rows
    filteredSatellites.forEach((sat, rowIdx) => {
      const y = headerHeight + rowIdx * rowHeight;
      const isSelected = sat.id === selectedSatelliteId;

      // Row background
      ctx.fillStyle = isSelected ? 'rgba(0, 255, 136, 0.12)' : (rowIdx % 2 === 0 ? '#080C14' : '#05080E');
      ctx.fillRect(0, y, totalW, rowHeight);

      // Row separator
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
      ctx.beginPath();
      ctx.moveTo(0, y + rowHeight);
      ctx.lineTo(totalW, y + rowHeight);
      ctx.stroke();

      // Satellite ID label
      ctx.fillStyle = isSelected ? '#00FF88' : '#CBD5E1';
      ctx.font = isSelected ? 'bold 10px JetBrains Mono, monospace' : '10px JetBrains Mono, monospace';
      ctx.fillText(sat.id, 10, y + 15);

      // Cells across timeline
      for (let k = 0; k < totalSteps; k++) {
        const x = labelWidth + k * colWidth;
        const stepSnapshot = stepsData[k];
        const satAtStep = stepSnapshot?.satellites?.find(s => s.id === sat.id);
        const act = satAtStep ? satAtStep.current_action : (k === 0 ? sat.current_action : 'idle');
        const isAvail = satAtStep ? satAtStep.available : sat.available;

        const isPast = k <= currentStep;
        const color = getActionColor(act, isAvail);

        if (color !== '#0B0F19') {
          ctx.fillStyle = color;
          ctx.globalAlpha = isPast ? 0.95 : 0.45;
          ctx.fillRect(x + 0.5, y + 1.5, colWidth - 1, rowHeight - 3);
          ctx.globalAlpha = 1.0;
        } else {
          // Idle subtle border
          ctx.fillStyle = isPast ? '#0D1321' : '#080C14';
          ctx.fillRect(x + 0.5, y + 1.5, colWidth - 1, rowHeight - 3);
        }
      }
    });

    // 4. Current Step Time Cursor Bar
    const cursorX = labelWidth + currentStep * colWidth;
    ctx.save();
    ctx.strokeStyle = '#00FF88';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#00FF88';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(cursorX, 0);
    ctx.lineTo(cursorX, totalH);
    ctx.stroke();
    ctx.restore();

  }, [filteredSatellites, timelineData, currentStep, zoomLevel, totalSteps, colWidth, selectedSatelliteId]);

  // Handle canvas mouse clicks to select satellite
  const handleCanvasClick = (e) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const clickY = e.clientY - rect.top;
    if (clickY < headerHeight) return;

    const rowIdx = Math.floor((clickY - headerHeight) / rowHeight);
    if (rowIdx >= 0 && rowIdx < filteredSatellites.length) {
      onSelectSatellite?.(filteredSatellites[rowIdx].id);
    }
  };

  // Handle mouse hover tooltip
  const handleCanvasMouseMove = (e) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (x < labelWidth || y < headerHeight) {
      setHoveredCell(null);
      return;
    }

    const colIdx = Math.floor((x - labelWidth) / colWidth);
    const rowIdx = Math.floor((y - headerHeight) / rowHeight);

    if (colIdx >= 0 && colIdx < totalSteps && rowIdx >= 0 && rowIdx < filteredSatellites.length) {
      const sat = filteredSatellites[rowIdx];
      const stepSnapshot = timelineData?.steps?.[colIdx];
      const satAtStep = stepSnapshot?.satellites?.find(s => s.id === sat.id);
      const act = satAtStep?.current_action || 'idle';
      const timeSec = colIdx * step_s;
      const h = Math.floor(timeSec / 3600);
      const m = Math.floor((timeSec % 3600) / 60);

      setHoveredCell({
        x: e.clientX,
        y: e.clientY,
        satId: sat.id,
        step: colIdx,
        time: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`,
        action: act,
        soc: satAtStep?.soc_pct
      });
    } else {
      setHoveredCell(null);
    }
  };

  return (
    <div className="gantt-shell flex flex-col h-full bg-space-900 border border-subtle rounded-xl overflow-hidden font-mono select-none">
      
      {/* Top Toolbar */}
      <div className="gantt-toolbar px-4 py-2.5 border-b border-subtle flex flex-wrap items-center justify-between gap-3 bg-space-950/90 flex-shrink-0">
        
        {/* Title & Step Indicator */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs font-bold text-white">
            <Radio className="w-4 h-4 text-orbit-emerald animate-pulse" />
            <span className="uppercase tracking-wider">МАТРИЦА ГАНТА (СУТОЧНЫЙ ПЛАН)</span>
          </div>
          <span className="text-[11px] px-2 py-0.5 rounded bg-space-850 text-orbit-cyan border border-subtle">
            Текущий шаг: {currentStep + 1} / {totalSteps}
          </span>
        </div>

        {/* Legend */}
        <div className="gantt-legend flex items-center gap-3 text-[10px]">
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-[#00E5FF]" />
            <span className="text-slate-300">Downlink</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-[#A855F7]" />
            <span className="text-slate-300">Relay</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-[#F59E0B]" />
            <span className="text-slate-300">Калибровка</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-[#10B981]" />
            <span className="text-slate-300">Съемка</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-[#EF4444]" />
            <span className="text-slate-300">Авария</span>
          </div>
        </div>

        {/* Controls: Search, Filter, Zoom */}
        <div className="gantt-controls flex items-center gap-2">
          
          <div className="relative">
            <Search className="w-3 h-3 text-slate-400 absolute left-2 top-1.5" />
            <input
              type="text"
              placeholder="Поиск КА..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-space-850 border border-subtle pl-6 pr-2 py-1 text-xs rounded text-slate-200 placeholder:text-slate-500 w-24 focus:outline-none focus:border-orbit-emerald"
            />
          </div>

          <div className="flex items-center border border-subtle rounded overflow-hidden bg-space-850 text-[10px]">
            <button
              onClick={() => setZoomLevel(1)}
              className={`px-2 py-1 ${zoomLevel === 1 ? 'bg-white/20 text-white font-bold' : 'text-slate-400 hover:text-white'}`}
            >
              Компактно
            </button>
            <button
              onClick={() => setZoomLevel(2)}
              className={`px-2 py-1 ${zoomLevel === 2 ? 'bg-white/20 text-white font-bold' : 'text-slate-400 hover:text-white'}`}
            >
              1x
            </button>
            <button
              onClick={() => setZoomLevel(3)}
              className={`px-2 py-1 ${zoomLevel === 3 ? 'bg-white/20 text-white font-bold' : 'text-slate-400 hover:text-white'}`}
            >
              2x
            </button>
          </div>

        </div>

      </div>

      {/* Main Canvas Container with smooth GPU-accelerated scrolling */}
      <div 
        ref={containerRef}
        className="flex-1 overflow-auto relative bg-space-950"
      >
        <canvas
          ref={canvasRef}
          onClick={handleCanvasClick}
          onMouseMove={handleCanvasMouseMove}
          onMouseLeave={() => setHoveredCell(null)}
          className="block cursor-pointer"
        />
      </div>

      {/* Floating Hover Tooltip */}
      {hoveredCell && (
        <div 
          className="fixed pointer-events-none z-50 px-2.5 py-1.5 rounded-lg bg-space-900/95 border border-slate-700 shadow-xl backdrop-blur-md text-[10px] text-slate-200 font-mono flex flex-col gap-0.5"
          style={{ left: `${hoveredCell.x + 12}px`, top: `${hoveredCell.y + 12}px` }}
        >
          <div className="font-bold text-white flex items-center gap-1.5">
            <span className="text-orbit-emerald">{hoveredCell.satId}</span>
            <span className="text-slate-400">•</span>
            <span>Шаг {hoveredCell.step + 1} ({hoveredCell.time})</span>
          </div>
          <div className="text-slate-300">
            Действие: <b className="text-cyan-400">{hoveredCell.action}</b>
          </div>
          {hoveredCell.soc !== undefined && (
            <div className="text-slate-400">
              Заряд АКБ: <span className="text-white">{Number(hoveredCell.soc).toFixed(1)}%</span>
            </div>
          )}
        </div>
      )}

      {/* Footer Instructions */}
      <div className="gantt-footer px-4 py-2 border-t border-subtle bg-space-950/80 flex items-center justify-between text-[11px] text-slate-400 flex-shrink-0">
        <span>Кликните на спутник в строке слева для открытия детального инспектора питания.</span>
        <span className="text-orbit-emerald font-bold">
          Зеленый курсор синхронизирован с главным таймлайном 60 FPS
        </span>
      </div>

    </div>
  );
}
