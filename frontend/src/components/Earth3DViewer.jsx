import React, { useRef, useEffect, useState, useMemo } from 'react';
import { RotateCw, ZoomIn, ZoomOut, Satellite, Radio, Compass } from 'lucide-react';

/**
 * EarthSurface: Offscreen WebGL GPU shader renderer from 2026-09-11_KosmoHack.
 * Renders the photorealistic Earth sphere onto an offscreen canvas and caches it.
 */
class EarthSurface {
  constructor(onReady = () => {}) {
    this.canvas = document.createElement('canvas');
    this.gl = this.canvas.getContext('webgl', { alpha: true, antialias: false, preserveDrawingBuffer: true });
    this.ready = false;
    if (!this.gl) return;
    const g = this.gl;
    const vertex = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
    const fragment = `precision highp float;uniform vec2 size;uniform float radius;uniform vec2 center;uniform sampler2D earth;const float PI=3.14159265359;
    void main(){
      vec2 p=(gl_FragCoord.xy-size*.5)/radius;
      float d=length(p);
      if(d>1.12){gl_FragColor=vec4(0.);return;}
      vec3 blue=vec3(.25,.59,1.);
      if(d>1.){float a=exp(-(d-1.)*55.)*.48;gl_FragColor=vec4(blue*a,a);return;}
      float z=sqrt(max(0.,1.-dot(p,p)));
      float lat=asin(clamp(p.y*cos(center.x)+z*sin(center.x),-1.,1.));
      float lon=center.y+atan(p.x,z*cos(center.x)-p.y*sin(center.x));
      vec2 uv=vec2(fract(lon/(2.*PI)+.5),.5-lat/PI);
      vec3 col=texture2D(earth,uv).rgb;
      vec3 normal=vec3(p,z);
      float light=dot(normal,normalize(vec3(-.75,.45,1.)));
      float daylight=smoothstep(-.12,.55,light);
      col*=.055+daylight*.94;
      float rim=pow(1.-z,3.5);
      col+=blue*rim*.6*max(.25,light);
      col=mix(col,col*vec3(.7,.88,1.16),.22);
      gl_FragColor=vec4(col,1.);
    }`;

    const shader = (type, src) => {
      const s = g.createShader(type);
      g.shaderSource(s, src);
      g.compileShader(s);
      if (!g.getShaderParameter(s, g.COMPILE_STATUS)) return null;
      return s;
    };

    try {
      const vs = shader(g.VERTEX_SHADER, vertex);
      const fs = shader(g.FRAGMENT_SHADER, fragment);
      if (!vs || !fs) return;
      this.program = g.createProgram();
      g.attachShader(this.program, vs);
      g.attachShader(this.program, fs);
      g.linkProgram(this.program);
      if (!g.getProgramParameter(this.program, g.LINK_STATUS)) return;
      g.useProgram(this.program);
      const b = g.createBuffer();
      g.bindBuffer(g.ARRAY_BUFFER, b);
      g.bufferData(g.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]), g.STATIC_DRAW);
      const p = g.getAttribLocation(this.program, 'p');
      g.enableVertexAttribArray(p);
      g.vertexAttribPointer(p, 2, g.FLOAT, false, 0, 0);
      this.uniforms = {};
      for (const n of ['size', 'radius', 'center']) {
        this.uniforms[n] = g.getUniformLocation(this.program, n);
      }

      const img = new Image();
      img.onload = () => {
        const tex = g.createTexture();
        g.bindTexture(g.TEXTURE_2D, tex);
        g.texImage2D(g.TEXTURE_2D, 0, g.RGB, g.RGB, g.UNSIGNED_BYTE, img);
        g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.LINEAR);
        g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.LINEAR);
        g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE);
        g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE);
        this.ready = true;
        onReady();
      };
      img.src = '/assets/earth.jpg';
      this.canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); this.ready = false; });
    } catch (e) {
      console.warn('Earth shader fallback', e);
    }
  }

  draw(ctx, w, h, r, lat, lon) {
    if (!this.ready) return false;
    const key = [w, h, Math.round(r), Math.round(lat * 10), Math.round(lon * 10)].join(':');
    if (key !== this.key) {
      this.key = key;
      this.canvas.width = w;
      this.canvas.height = h;
      const g = this.gl;
      g.viewport(0, 0, w, h);
      g.useProgram(this.program);
      g.uniform2f(this.uniforms.size, w, h);
      g.uniform1f(this.uniforms.radius, r);
      g.uniform2f(this.uniforms.center, (lat * Math.PI) / 180, (lon * Math.PI) / 180);
      g.drawArrays(g.TRIANGLES, 0, 6);
    }
    ctx.drawImage(this.canvas, 0, 0);
    return true;
  }
}

// Physical constants from KosmoHack map_canvas.js
const R_EARTH = 6371.0;
const MU_EARTH = 398600.435507;
const OMEGA_EARTH = (2.0 * Math.PI) / 86164.09054;
const ORBIT_ALT_KM = 600.0;
const R_ORBIT = R_EARTH + ORBIT_ALT_KM;
const N_MEAN_MOTION = Math.sqrt(MU_EARTH / (R_ORBIT ** 3)); // ~0.001083 rad/sec

// Apple Modern palette orbital plane colors: Blue, Silver, Green, Amber
const planeColors = [
  '#007AFF', // Plane 1: Apple Electric Blue
  '#AAAAAA', // Plane 2: Neutral Silver Gray
  '#30D158', // Plane 3: Apple System Green
  '#FF9F0A', // Plane 4: Apple System Amber
];

export default function Earth3DViewer({ 
  satellites = [], 
  simTime = 0,
  isPlaying = false,
  onSelectSatellite, 
  selectedSatelliteId,
  interactive = true,
  autoRotate = false,
  showSatellites = true,
  showLegend = true,
  showControls = true,
  className = ""
}) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const earthRef = useRef(null);

  // Camera angles (center view)
  const [globeCenterLat, setGlobeCenterLat] = useState(30);
  const [globeCenterLon, setGlobeCenterLon] = useState(50);
  const [globeZoom, setGlobeZoom] = useState(1.0);
  const [isRotating, setIsRotating] = useState(autoRotate);

  const pulsePhaseRef = useRef(0);
  const projectedSatsRef = useRef([]);

  // Mouse interaction state
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const hasDraggedRef = useRef(false);
  const lastMouseRef = useRef({ x: 0, y: 0 });
  const activePointerRef = useRef(null);

  // Hover detection state
  const hoveredSatRef = useRef(null);
  const mousePosRef = useRef({ x: -1000, y: -1000 });

  // Ground targets on Earth surface
  const groundTargets = useMemo(() => [
    { id: 'GS_VOSTOK', name: 'ЦУП ВОСТОЧНЫЙ', lat: 51.8, lon: 128.1, type: 'ground_station' },
    { id: 'T_BAIKAL', name: 'Байкал (Эко)', lat: 53.5, lon: 108.2, type: 'target' },
    { id: 'T_VLAD', name: 'Владивосток', lat: 43.1, lon: 131.9, type: 'target' },
    { id: 'T_KAMCH', name: 'Камчатка', lat: 55.0, lon: 160.0, type: 'target' },
    { id: 'T_SAKH', name: 'Сахалин-2', lat: 46.9, lon: 142.7, type: 'target' },
    { id: 'T_MOSCOW', name: 'Москва', lat: 55.7, lon: 37.6, type: 'target' },
    { id: 'T_ARCTIC', name: 'СМП Арктика', lat: 71.0, lon: 73.0, type: 'target' },
  ], []);

  // Initialize EarthSurface WebGL renderer
  useEffect(() => {
    earthRef.current = new EarthSurface(() => {
      // Force repaint when texture loads
    });
  }, []);

  const canRotate = interactive;

  // Main Canvas Render Loop (60 FPS)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId = null;

    // Plane colors matching Apple Modern palette
    const planeColors = {
      0: '#007AFF', // P1: Apple Electric Blue
      1: '#AAAAAA', // P2: Neutral Silver Gray
      2: '#30D158', // P3: Apple System Green
      3: '#FF9F0A'  // P4: Apple System Amber
    };

    /**
     * geoToCanvas: EXACT 1:1 mathematical formula from 2026-09-11_KosmoHack map_canvas.js
     * Honest 3D sphere occlusion: satellites going behind the Earth are physically hidden!
     */
    const geoToCanvas = (lat, lon, altKm, w, h, cx, cy, radius) => {
      while (lon > 180) lon -= 360;
      while (lon < -180) lon += 360;

      const centerLatRad = (globeCenterLat * Math.PI) / 180;
      const centerLonRad = (globeCenterLon * Math.PI) / 180;

      const latRad = (lat * Math.PI) / 180;
      const lonRad = (lon * Math.PI) / 180;
      const dLon = lonRad - centerLonRad;

      const rScale = (R_EARTH + altKm) / R_EARTH;
      const rPx = radius * rScale;

      const cosLat = Math.cos(latRad);
      const sinLat = Math.sin(latRad);
      const cosCLat = Math.cos(centerLatRad);
      const sinCLat = Math.sin(centerLatRad);
      const cosDLon = Math.cos(dLon);
      const sinDLon = Math.sin(dLon);

      const X_view = cosLat * sinDLon;
      const Y_view = sinLat * cosCLat - cosLat * sinCLat * cosDLon;
      const Z_view = sinLat * sinCLat + cosLat * cosCLat * cosDLon;

      const x = cx + X_view * rPx;
      const y = cy - Y_view * rPx;
      const z = Z_view * (R_EARTH + altKm);
      const D_xy = Math.hypot(X_view, Y_view) * rScale;

      // Ground sites: visible on front hemisphere
      if (altKm <= 10) {
        const isNear = Z_view > 0.005;
        return { x, y, visible: isNear, z, d_xy: D_xy, isBehind: !isNear };
      } else {
        // SATELLITES AT 600 KM: Honest 3D occlusion by body of Earth!
        // If behind planet (Z_view < 0) AND within Earth's silhouette disk (D_xy <= 1.001) -> occluded
        const isOccluded = (Z_view < 0 && D_xy <= 1.001);
        return { x, y, visible: !isOccluded, z, d_xy: D_xy, isBehind: Z_view < 0 };
      }
    };

    const render = () => {
      // PULSE PHASE for ground station beacon
      pulsePhaseRef.current = (pulsePhaseRef.current + 0.05) % (Math.PI * 2);

      // Camera auto-rotation (ONLY while playing or if explicitly enabled)
      if (isRotating && isPlaying && !isDraggingRef.current) {
        setGlobeCenterLon(prev => (prev + 0.05) % 360);
      }

      const rect = containerRef.current?.getBoundingClientRect();
      const cssW = Math.floor(rect?.width || 800);
      const cssH = Math.floor(rect?.height || 500);

      const dpr = Math.min(window.devicePixelRatio || 1, 1.2);
      const w = Math.round(cssW * dpr);
      const h = Math.round(cssH * dpr);

      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        canvas.style.width = `${cssW}px`;
        canvas.style.height = `${cssH}px`;
      }

      ctx.clearRect(0, 0, w, h);

      // Starfield background with clean silver & alabaster stars
      let seed = 42;
      for (let i = 0; i < 90; i++) {
        seed = (seed * 16807) % 2147483647;
        const sx = (seed % 10000) / 10000 * w;
        seed = (seed * 16807) % 2147483647;
        const sy = (seed % 10000) / 10000 * h;
        ctx.fillStyle = i % 5 ? 'rgba(170, 170, 170, 0.28)' : 'rgba(245, 245, 247, 0.65)';
        ctx.fillRect(sx, sy, dpr * (i % 5 ? 0.8 : 1.2), dpr * (i % 5 ? 0.8 : 1.2));
      }

      const cx = w / 2;
      const cy = h / 2;
      const radius = Math.min(cx, cy) * 0.82 * globeZoom;

      // 1. Draw GPU WebGL Earth Sphere via EarthSurface
      if (earthRef.current) {
        earthRef.current.draw(ctx, w, h, radius, globeCenterLat, globeCenterLon);
      }

      // 2. Exact physical time for satellites (STRICTLY simTime, zero drift on pause!)
      const t_s = simTime;

      if (showSatellites && satellites.length > 0) {
        // 3. Draw 4 Orbit Tracks with Honest 3D Horizon Occlusion
        const totalSats = Math.max(1, satellites.length);
        const planesCount = totalSats > 16 ? 4 : 2;
        const satsPerPlane = Math.ceil(totalSats / planesCount);
        const incRad = (53.0 * Math.PI) / 180;
        const cosInc = Math.cos(incRad);
        const sinInc = Math.sin(incRad);
        const th = OMEGA_EARTH * t_s;
        const cosTh = Math.cos(th);
        const sinTh = Math.sin(th);

      ctx.save();
      for (let p = 0; p < planesCount; p++) {
        const om = (p * (360.0 / planesCount) * Math.PI) / 180;
        const co = Math.cos(om);
        const so = Math.sin(om);

        ctx.beginPath();
        let open = false;
        const trackSteps = 64;
        for (let s = 0; s <= trackSteps; s++) {
          const u = (s / trackSteps) * Math.PI * 2;
          const cu = Math.cos(u);
          const su = Math.sin(u);

          const x_eci = R_ORBIT * (co * cu - so * su * cosInc);
          const y_eci = R_ORBIT * (so * cu + co * su * cosInc);
          const z_eci = R_ORBIT * (su * sinInc);

          const x_ecef = x_eci * cosTh + y_eci * sinTh;
          const y_ecef = -x_eci * sinTh + y_eci * cosTh;
          const z_ecef = z_eci;

          const normR = Math.hypot(x_ecef, y_ecef, z_ecef);
          const lat = Math.asin(Math.max(-1, Math.min(1, z_ecef / normR))) * (180 / Math.PI);
          const lon = Math.atan2(y_ecef, x_ecef) * (180 / Math.PI);

          const pt = geoToCanvas(lat, lon, ORBIT_ALT_KM, w, h, cx, cy, radius);
          if (!pt.visible) {
            open = false;
            continue;
          }
          if (open) {
            ctx.lineTo(pt.x, pt.y);
          } else {
            ctx.moveTo(pt.x, pt.y);
            open = true;
          }
        }

        ctx.strokeStyle = (planeColors[p] || '#007AFF') + '45';
        ctx.lineWidth = 0.85 * dpr;
        ctx.stroke();
      }
      ctx.restore();

      // 4. Draw Ground Station and Observation Targets
      let gsCanvasPos = null;
      groundTargets.forEach(tgt => {
        const pt = geoToCanvas(tgt.lat, tgt.lon, 0, w, h, cx, cy, radius);
        if (tgt.type === 'ground_station') {
          gsCanvasPos = { ...pt, lat: tgt.lat, lon: tgt.lon };
        }
        if (pt.visible) {
          if (tgt.type === 'ground_station') {
            // Ground Station dish with emerald pulse ring (Apple System Green #30D158)
            const pulseR = (12 + Math.sin(pulsePhaseRef.current) * 2.5) * dpr;
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, pulseR, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(48, 209, 88, 0.45)';
            ctx.lineWidth = 1.5 * dpr;
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(pt.x, pt.y, 5 * dpr, 0, Math.PI * 2);
            ctx.fillStyle = '#30D158';
            ctx.fill();
            ctx.strokeStyle = '#F5F5F7';
            ctx.lineWidth = 1 * dpr;
            ctx.stroke();

            ctx.font = `bold ${10 * dpr}px JetBrains Mono, monospace`;
            ctx.fillStyle = '#30D158';
            ctx.fillText('ЦУП ВОСТОЧНЫЙ', pt.x + 10 * dpr, pt.y + 3 * dpr);
          } else {
            // Target point (Apple System Blue #007AFF)
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, 3 * dpr, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(0, 122, 255, 0.9)';
            ctx.fill();

            ctx.font = `${9 * dpr}px JetBrains Mono, monospace`;
            ctx.fillStyle = '#AAAAAA';
            ctx.fillText(tgt.name, pt.x + 7 * dpr, pt.y + 3 * dpr);
          }
        }
      });

      // 5. Compute Satellite Coordinates at exact physical time t_s
      const projectedSats = [];
      satellites.forEach((sat, idx) => {
        const planeIdx = idx % planesCount;
        const slotIdx = Math.floor(idx / planesCount);
        const om = (planeIdx * (360.0 / planesCount) * Math.PI) / 180;
        const u = ((slotIdx * (360.0 / satsPerPlane)) * Math.PI) / 180 + N_MEAN_MOTION * t_s;

        const cu = Math.cos(u);
        const su = Math.sin(u);
        const co = Math.cos(om);
        const so = Math.sin(om);

        // ECI
        const x_eci = R_ORBIT * (co * cu - so * su * cosInc);
        const y_eci = R_ORBIT * (so * cu + co * su * cosInc);
        const z_eci = R_ORBIT * (su * sinInc);

        // ECEF
        const x_ecef = x_eci * cosTh + y_eci * sinTh;
        const y_ecef = -x_eci * sinTh + y_eci * cosTh;
        const z_ecef = z_eci;

        const normR = Math.hypot(x_ecef, y_ecef, z_ecef);
        const satLat = Math.asin(Math.max(-1, Math.min(1, z_ecef / normR))) * (180 / Math.PI);
        const satLon = Math.atan2(y_ecef, x_ecef) * (180 / Math.PI);

        const pt = geoToCanvas(satLat, satLon, ORBIT_ALT_KM, w, h, cx, cy, radius);
        if (pt.visible) {
          projectedSats.push({
            sat,
            planeIdx,
            x: pt.x,
            y: pt.y,
            z: pt.z,
            lat: satLat,
            lon: satLon,
            isHovered: hoveredSatRef.current?.sat?.id === sat.id,
            isSelected: selectedSatelliteId === sat.id
          });
        }
      });
      projectedSatsRef.current = projectedSats;

      // 6. Hit Detection for Hovered Satellite
      let nearest = null;
      let minD = 15 * dpr;

      projectedSats.forEach(item => {
        const d = Math.hypot(mousePosRef.current.x - item.x, mousePosRef.current.y - item.y);
        if (d < minD) {
          minD = d;
          nearest = item;
        }
      });

      hoveredSatRef.current = nearest;
      if (containerRef.current) {
        containerRef.current.style.cursor = nearest ? 'pointer' : (isDraggingRef.current ? 'grabbing' : 'grab');
      }

      // 7. Depth Sorting from KosmoHack map_canvas.js
      projectedSats.sort((a, b) => {
        if (a.isHovered) return 1;
        if (b.isHovered) return -1;
        return a.z - b.z;
      });

      // 8. Draw downlinks with the exact same 3D occlusion rule as orbit tracks.
      projectedSats.forEach(item => {
        const act = item.sat.current_action || '';
        if (act.includes('downlink') && gsCanvasPos) {
          ctx.save();
          const unitAt = (lat, lon) => {
            const phi = lat * Math.PI / 180;
            const lambda = lon * Math.PI / 180;
            return [Math.cos(phi) * Math.cos(lambda), Math.cos(phi) * Math.sin(lambda), Math.sin(phi)];
          };
          const satUnit = unitAt(item.lat, item.lon);
          const groundUnit = unitAt(gsCanvasPos.lat, gsCanvasPos.lon);
          const dot = Math.max(-1, Math.min(1, satUnit[0] * groundUnit[0] + satUnit[1] * groundUnit[1] + satUnit[2] * groundUnit[2]));
          const omega = Math.acos(dot);
          const sinOmega = Math.sin(omega);
          const directionAt = (t) => {
            const a = sinOmega > 0.0001 ? Math.sin((1 - t) * omega) / sinOmega : 1 - t;
            const b = sinOmega > 0.0001 ? Math.sin(t * omega) / sinOmega : t;
            const x = a * satUnit[0] + b * groundUnit[0];
            const y = a * satUnit[1] + b * groundUnit[1];
            const z = a * satUnit[2] + b * groundUnit[2];
            const length = Math.hypot(x, y, z) || 1;
            return [x / length, y / length, z / length];
          };

          let previous = null;
          const linkSegments = 48;
          for (let segment = 0; segment <= linkSegments; segment++) {
            const t = segment / linkSegments;
            const [x, y, z] = directionAt(t);
            const lat = Math.asin(Math.max(-1, Math.min(1, z))) * 180 / Math.PI;
            const lon = Math.atan2(y, x) * 180 / Math.PI;
            const altitude = ORBIT_ALT_KM * (1 - t) + Math.sin(Math.PI * t) * 120;
            const point = geoToCanvas(lat, lon, altitude, w, h, cx, cy, radius);
            if (!point.visible) {
              previous = null;
              continue;
            }
            if (previous) {
              ctx.beginPath();
              ctx.moveTo(previous.x, previous.y);
              ctx.lineTo(point.x, point.y);
              ctx.strokeStyle = 'rgba(0, 122, 255, 0.95)';
              ctx.lineWidth = 2.35 * dpr;
              ctx.shadowColor = '#007AFF';
              ctx.shadowBlur = 7 * dpr;
              ctx.stroke();
            }
            previous = point;
          }
          ctx.restore();
        }
      });

      // 9. Draw Satellites - EXACT VISUAL IMPLEMENTATION FROM 2026-09-11_KosmoHack map_canvas.js
      for (const item of projectedSats) {
        const { sat, planeIdx, x, y, isHovered, isSelected, z } = item;

        ctx.save();
        ctx.translate(x, y);

        // On 3D globe, satellites peeking out from the back side of planet in space are drawn softly
        const isBehind = (z < 0);
        if (isBehind) {
          ctx.globalAlpha = 0.55;
        }

        if (!sat.available) {
          // Red failure cross (Apple System Red #FF453A)
          ctx.strokeStyle = '#FF453A';
          ctx.lineWidth = 2.5 * dpr;
          const r = 6 * dpr;
          ctx.beginPath();
          ctx.moveTo(-r, -r); ctx.lineTo(r, r);
          ctx.moveTo(r, -r); ctx.lineTo(-r, r);
          ctx.stroke();
        } else {
          // Active satellite in orbital plane color
          const color = planeColors[planeIdx % 4] || '#007AFF';
          ctx.fillStyle = color;
          if (isHovered || isSelected) {
            ctx.shadowColor = isSelected ? '#30D158' : color;
            ctx.shadowBlur = 14 * dpr;
          }

          const satRadius = (isHovered ? 6.5 : (isSelected ? 5.5 : 4.5)) * dpr;
          ctx.beginPath();
          ctx.arc(0, 0, satRadius, 0, Math.PI * 2);
          ctx.fill();

          ctx.strokeStyle = '#F5F5F7';
          ctx.lineWidth = 1 * dpr;
          ctx.stroke();

          if (isSelected) {
            ctx.beginPath();
            ctx.arc(0, 0, satRadius + 4 * dpr, 0, Math.PI * 2);
            ctx.strokeStyle = '#30D158';
            ctx.lineWidth = 1.5 * dpr;
            ctx.stroke();
          }
        }

        // Label
        if (isHovered || isSelected) {
          ctx.font = `bold ${8.5 * dpr}px JetBrains Mono, monospace`;
          ctx.fillStyle = !sat.available ? '#FF453A' : (isSelected ? '#30D158' : '#F5F5F7');
          ctx.fillText(sat.id, 6 * dpr, 3 * dpr);
        }

        ctx.restore();
      }
    } else {
      projectedSatsRef.current = [];
    }
  };

    let lastFrame = 0;
    const loop = (now) => {
      if (now - lastFrame >= 1000 / 30) {
        render();
        lastFrame = now;
      }
      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);

    return () => {
      if (animId) cancelAnimationFrame(animId);
    };
  }, [globeCenterLat, globeCenterLon, globeZoom, isRotating, isPlaying, simTime, satellites, selectedSatelliteId, showSatellites]);

  const pointerPosition = (e) => {
    const rect = containerRef.current?.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 1.2);
    return rect ? { x: (e.clientX - rect.left) * dpr, y: (e.clientY - rect.top) * dpr, dpr } : null;
  };

  // Pointer handlers support both mouse and direct touch manipulation.
  const handlePointerDown = (e) => {
    if (!canRotate) return;
    activePointerRef.current = e.pointerId;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    isDraggingRef.current = true;
    hasDraggedRef.current = false;
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    lastMouseRef.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerMove = (e) => {
    const position = pointerPosition(e);
    if (!position) return;
    mousePosRef.current = { x: position.x, y: position.y };

    if (!isDraggingRef.current || !canRotate || activePointerRef.current !== e.pointerId) return;

    const dx = e.clientX - lastMouseRef.current.x;
    const dy = e.clientY - lastMouseRef.current.y;

    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
      hasDraggedRef.current = true;
    }

    setGlobeCenterLon(prev => (prev - dx * 0.45) % 360);
    setGlobeCenterLat(prev => Math.max(-85, Math.min(85, prev + dy * 0.45)));

    lastMouseRef.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerUp = (e) => {
    if (!isDraggingRef.current || activePointerRef.current !== e.pointerId) return;
    isDraggingRef.current = false;
    activePointerRef.current = null;
    const position = pointerPosition(e);
    if (!hasDraggedRef.current && position) {
      const hitRadius = (e.pointerType === 'touch' ? 28 : 15) * position.dpr;
      const nearest = projectedSatsRef.current.reduce((best, item) => {
        const distance = Math.hypot(position.x - item.x, position.y - item.y);
        return distance < best.distance ? { item, distance } : best;
      }, { item: null, distance: hitRadius });
      if (nearest.item) onSelectSatellite?.(nearest.item.sat.id);
    }
    e.currentTarget.releasePointerCapture?.(e.pointerId);
  };

  const handlePointerCancel = () => {
    isDraggingRef.current = false;
    activePointerRef.current = null;
  };

  const handleWheel = (e) => {
    if (!interactive) return;
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.08 : -0.08;
    setGlobeZoom(prev => Math.max(0.65, Math.min(2.5, prev + delta)));
  };

  const resetCamera = () => {
    setGlobeCenterLat(30);
    setGlobeCenterLon(50);
    setGlobeZoom(1.0);
  };

  return (
    <div 
      ref={containerRef}
      className={`relative select-none overflow-hidden bg-space-950 ${className}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onWheel={handleWheel}
      style={{ touchAction: 'none' }}
    >
      <canvas ref={canvasRef} className="block w-full h-full" />

      {/* Floating HUD controls */}
      {showControls && (
        <div className="earth-controls absolute top-3 right-3 flex flex-col gap-1.5 z-10">
          <button
            onClick={resetCamera}
            title="Сброс камеры (ЦУП Восточный)"
            className="p-1.5 rounded-md bg-space-900/80 hover:bg-space-800 text-slate-300 hover:text-orbit-blue border border-slate-700/60 transition"
          >
            <Compass className="w-4 h-4" />
          </button>
          <button 
            onClick={() => setGlobeZoom(z => Math.min(2.5, z + 0.15))}
            title="Приблизить"
            className="p-1.5 rounded-md bg-space-900/80 hover:bg-space-800 text-slate-300 hover:text-orbit-blue border border-slate-700/60 transition"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button 
            onClick={() => setGlobeZoom(z => Math.max(0.65, z - 0.15))}
            title="Отдалить"
            className="p-1.5 rounded-md bg-space-900/80 hover:bg-space-800 text-slate-300 hover:text-orbit-blue border border-slate-700/60 transition"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={() => setIsRotating(r => !r)}
            title={isRotating ? "Остановить авто-вращение" : "Включить авто-вращение"}
            className={`p-1.5 rounded-md border transition ${isRotating ? 'bg-orbit-blue/20 text-orbit-blue border-orbit-blue/50' : 'bg-space-900/80 text-slate-400 border-slate-700/60'}`}
          >
            <RotateCw className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Mini Legend Overlay */}
      {showLegend && (
        <div className="earth-legend absolute bottom-3 left-3 flex items-center gap-3 px-2.5 py-1.5 rounded-md bg-space-900/90 border border-slate-700 text-[10px] text-slate-300 font-mono pointer-events-none z-10 backdrop-blur-sm">
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#007AFF] ring-1 ring-white/50" />
            <span>P1</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#AAAAAA] ring-1 ring-white/50" />
            <span>P2</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#30D158] ring-1 ring-white/50" />
            <span>P3</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#FF9F0A] ring-1 ring-white/50" />
            <span>P4</span>
          </div>
          <div className="flex items-center gap-1 pl-1 border-l border-slate-700">
            <span className="text-[#FF453A] font-bold">✕</span>
            <span>Отказ</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-0.5 bg-[#007AFF]" />
            <span>Сброс</span>
          </div>
        </div>
      )}
    </div>
  );
}
