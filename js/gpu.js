// SINGULARIS — Full-World Hardware-Accelerated WebGL2/WebGL1 GPU Renderer
window.SG = window.SG || {};

(function (SG) {
  'use strict';

  const NEBULA_VS = `
    attribute vec2 aPos;
    varying vec2 vUv;
    void main() {
      vUv = aPos * 0.5 + 0.5;
      gl_Position = vec4(aPos, 0.0, 1.0);
    }
  `;

  const NEBULA_FS = `
    precision mediump float;
    varying vec2 vUv;
    uniform vec2 uRes;
    uniform float uTime;
    uniform float uBulletTime;
    uniform float uNebula;

    void main() {
      vec2 p = vUv - 0.5;
      float aspect = uRes.x / max(1.0, uRes.y);
      vec2 pa = vec2(p.x * aspect, p.y);
      float dist = length(pa);

      vec3 innerCol = mix(vec3(0.027, 0.051, 0.114), vec3(0.047, 0.031, 0.133), uBulletTime);
      vec3 outerCol = mix(vec3(0.012, 0.024, 0.059), vec3(0.016, 0.012, 0.051), uBulletTime);
      vec3 col = mix(innerCol, outerCol, smoothstep(0.05, 0.85, dist));

      if (uNebula > 0.01) {
        float w1 = sin(pa.x * 3.1 + uTime * 0.18) * cos(pa.y * 2.7 - uTime * 0.14);
        float w2 = sin((pa.x + pa.y) * 4.4 - uTime * 0.11);
        float neb = clamp((w1 * 0.5 + w2 * 0.5) * 0.5 + 0.5, 0.0, 1.0);
        vec3 nebTint = mix(vec3(0.0, 0.16, 0.24), vec3(0.18, 0.04, 0.28), smoothstep(-0.4, 0.5, pa.x));
        col += nebTint * pow(neb, 2.2) * 0.22 * uNebula * (1.0 - smoothstep(0.4, 1.05, dist));
      }

      gl_FragColor = vec4(col, 1.0);
    }
  `;

  const GEOM_VS = `
    attribute vec2 aPos;
    attribute vec4 aColor;
    uniform vec2 uRes;
    uniform vec2 uShake;
    varying vec4 vColor;
    void main() {
      vec2 p = aPos + uShake;
      vec2 clip = vec2((p.x / uRes.x) * 2.0 - 1.0, 1.0 - (p.y / uRes.y) * 2.0);
      gl_Position = vec4(clip, 0.0, 1.0);
      vColor = aColor;
    }
  `;

  const GEOM_FS = `
    precision mediump float;
    varying vec4 vColor;
    void main() {
      gl_FragColor = vColor;
    }
  `;

  const POINT_VS = `
    attribute vec2 aPos;
    attribute float aSize;
    attribute vec4 aColor;
    uniform vec2 uRes;
    uniform vec2 uShake;
    uniform float uDpr;
    uniform float uMaxPt;
    varying vec4 vColor;
    void main() {
      vec2 p = aPos + uShake;
      vec2 clip = vec2((p.x / uRes.x) * 2.0 - 1.0, 1.0 - (p.y / uRes.y) * 2.0);
      gl_Position = vec4(clip, 0.0, 1.0);
      gl_PointSize = clamp(aSize * uDpr, 1.0, uMaxPt);
      vColor = aColor;
    }
  `;

  const POINT_FS = `
    precision mediump float;
    varying vec4 vColor;
    void main() {
      vec2 d = gl_PointCoord - vec2(0.5);
      float r2 = dot(d, d) * 4.0;
      if (r2 > 1.0) discard;
      float falloff = exp(-r2 * 2.4);
      gl_FragColor = vec4(vColor.rgb, vColor.a * falloff);
    }
  `;

  function hslToRgbNorm(hDeg, s, l) {
    const h = ((hDeg % 360) + 360) % 360 / 60;
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs((h % 2) - 1));
    let r = 0, g = 0, b = 0;
    if (h < 1) { r = c; g = x; }
    else if (h < 2) { r = x; g = c; }
    else if (h < 3) { g = c; b = x; }
    else if (h < 4) { g = x; b = c; }
    else if (h < 5) { r = x; b = c; }
    else { r = c; b = x; }
    const m = l - c * 0.5;
    return [r + m, g + m, b + m];
  }

  // Reusable local silhouettes [x0, y0, x1, y1, ...]
  const SHIP_POLY = [18, 0, -12, 12, -7, 0, -12, -12];
  const DRONE_POLY = [7, 0, -5, 5, -3, 0, -5, -5];
  const SWARMER_POLY = [14, 0, -10, 9, -5, 0, -10, -9];
  const SNIPER_POLY = [19, 0, -11, 11, -15, 0, -11, -11];
  const WEAVER_POLY = [15, 0, 0, 14, -15, 0, 0, -14];
  const LEVI_HEAD_POLY = [34, 0, -14, 24, -24, 0, -14, -24];
  const PHALANX_POLY = (() => {
    const pts = [];
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3;
      pts.push(Math.cos(a) * 16, Math.sin(a) * 16);
    }
    return pts;
  })();
  const PULSAR_POLY = (() => {
    const pts = [];
    for (let i = 0; i < 8; i++) {
      const r = i % 2 === 0 ? 18 : 9;
      const a = (i * Math.PI) / 4;
      pts.push(Math.cos(a) * r, Math.sin(a) * r);
    }
    return pts;
  })();

  class GpuRenderer {
    constructor(canvas) {
      this.canvas = canvas;
      this.gl = null;
      this.supported = false;
      this.enabled = true;
      this.backend = '2D';
      this.maxPointSize = 64;
      this.colorCache = new Map();

      // Pre-allocated reusable batch buffers (grow on demand, zero per-frame GC)
      this.batches = {
        lineGrid:  { data: new Float32Array(32768 * 6), len: 0 },
        triAdd:    { data: new Float32Array(16384 * 6), len: 0 },
        triAlpha:  { data: new Float32Array(16384 * 6), len: 0 },
        lineAlpha: { data: new Float32Array(16384 * 6), len: 0 },
        lineAdd:   { data: new Float32Array(16384 * 6), len: 0 },
        pointAdd:  { data: new Float32Array(8192 * 7),  len: 0 }
      };

      if (canvas && typeof canvas.getContext === 'function') {
        const opts = {
          alpha: false,
          antialias: false,
          depth: false,
          stencil: false,
          premultipliedAlpha: false,
          preserveDrawingBuffer: false,
          powerPreference: 'high-performance'
        };
        let gl = null;
        let isWebGL2 = false;
        try {
          gl = canvas.getContext('webgl2', opts);
          if (gl) isWebGL2 = true;
          else gl = canvas.getContext('webgl', opts) || canvas.getContext('experimental-webgl', opts);
        } catch (_) {
          gl = null;
        }
        if (gl) {
          this.gl = gl;
          this.backend = isWebGL2 ? 'WebGL2' : 'WebGL1';
          const range = gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE);
          if (range && range.length >= 2 && range[1] > 0) {
            this.maxPointSize = range[1];
          }
          this.supported = this.initPrograms();
          if (!this.supported) {
            this.gl = null;
            this.backend = '2D';
          }
        }
      }
    }

    compileShader(type, src) {
      const gl = this.gl;
      const sh = gl.createShader(type);
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        gl.deleteShader(sh);
        return null;
      }
      return sh;
    }

    createProgram(vsSrc, fsSrc) {
      const gl = this.gl;
      const vs = this.compileShader(gl.VERTEX_SHADER, vsSrc);
      const fs = this.compileShader(gl.FRAGMENT_SHADER, fsSrc);
      if (!vs || !fs) return null;
      const prog = gl.createProgram();
      gl.attachShader(prog, vs);
      gl.attachShader(prog, fs);
      gl.linkProgram(prog);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        gl.deleteProgram(prog);
        return null;
      }
      return prog;
    }

    initPrograms() {
      const gl = this.gl;
      this.nebulaProg = this.createProgram(NEBULA_VS, NEBULA_FS);
      this.geomProg = this.createProgram(GEOM_VS, GEOM_FS);
      this.pointProg = this.createProgram(POINT_VS, POINT_FS);
      if (!this.nebulaProg || !this.geomProg || !this.pointProg) return false;

      this.nebLoc = {
        aPos: gl.getAttribLocation(this.nebulaProg, 'aPos'),
        uRes: gl.getUniformLocation(this.nebulaProg, 'uRes'),
        uTime: gl.getUniformLocation(this.nebulaProg, 'uTime'),
        uBulletTime: gl.getUniformLocation(this.nebulaProg, 'uBulletTime'),
        uNebula: gl.getUniformLocation(this.nebulaProg, 'uNebula')
      };

      this.geomLoc = {
        aPos: gl.getAttribLocation(this.geomProg, 'aPos'),
        aColor: gl.getAttribLocation(this.geomProg, 'aColor'),
        uRes: gl.getUniformLocation(this.geomProg, 'uRes'),
        uShake: gl.getUniformLocation(this.geomProg, 'uShake')
      };

      this.ptLoc = {
        aPos: gl.getAttribLocation(this.pointProg, 'aPos'),
        aSize: gl.getAttribLocation(this.pointProg, 'aSize'),
        aColor: gl.getAttribLocation(this.pointProg, 'aColor'),
        uRes: gl.getUniformLocation(this.pointProg, 'uRes'),
        uShake: gl.getUniformLocation(this.pointProg, 'uShake'),
        uDpr: gl.getUniformLocation(this.pointProg, 'uDpr'),
        uMaxPt: gl.getUniformLocation(this.pointProg, 'uMaxPt')
      };

      this.triBuf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.triBuf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);

      this.geomBuf = gl.createBuffer();
      this.pointBuf = gl.createBuffer();

      gl.enable(gl.BLEND);
      return true;
    }

    isActive() {
      return this.supported && this.enabled;
    }

    setEnabled(flag) {
      this.enabled = !!flag;
      if (this.canvas) {
        this.canvas.hidden = !this.isActive();
      }
    }

    resize(width, height, dpr) {
      if (!this.supported || !this.canvas) return;
      this.canvas.width = Math.max(1, Math.floor(width * dpr));
      this.canvas.height = Math.max(1, Math.floor(height * dpr));
      this.canvas.style.width = `${width}px`;
      this.canvas.style.height = `${height}px`;
      this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    }

    parseHexRgb(hex) {
      const cached = this.colorCache.get(hex);
      if (cached) return cached;
      let rgb = [0, 0.94, 1];
      if (typeof hex === 'string' && hex[0] === '#') {
        if (hex.length === 7) {
          rgb = [
            parseInt(hex.slice(1, 3), 16) / 255,
            parseInt(hex.slice(3, 5), 16) / 255,
            parseInt(hex.slice(5, 7), 16) / 255
          ];
        } else if (hex.length === 4) {
          rgb = [
            parseInt(hex[1] + hex[1], 16) / 255,
            parseInt(hex[2] + hex[2], 16) / 255,
            parseInt(hex[3] + hex[3], 16) / 255
          ];
        }
      }
      this.colorCache.set(hex, rgb);
      return rgb;
    }

    reserve(batch, extraFloats) {
      const needed = batch.len + extraFloats;
      if (needed > batch.data.length) {
        const next = new Float32Array(Math.ceil(needed * 1.5));
        next.set(batch.data.subarray(0, batch.len));
        batch.data = next;
      }
    }

    pushLine(batch, x1, y1, x2, y2, r, g, b, a, r2 = r, g2 = g, b2 = b, a2 = a) {
      this.reserve(batch, 12);
      const d = batch.data;
      let i = batch.len;
      d[i++] = x1; d[i++] = y1; d[i++] = r;  d[i++] = g;  d[i++] = b;  d[i++] = a;
      d[i++] = x2; d[i++] = y2; d[i++] = r2; d[i++] = g2; d[i++] = b2; d[i++] = a2;
      batch.len = i;
    }

    pushTri(batch, x1, y1, r1, g1, b1, a1, x2, y2, r2, g2, b2, a2, x3, y3, r3, g3, b3, a3) {
      this.reserve(batch, 18);
      const d = batch.data;
      let i = batch.len;
      d[i++] = x1; d[i++] = y1; d[i++] = r1; d[i++] = g1; d[i++] = b1; d[i++] = a1;
      d[i++] = x2; d[i++] = y2; d[i++] = r2; d[i++] = g2; d[i++] = b2; d[i++] = a2;
      d[i++] = x3; d[i++] = y3; d[i++] = r3; d[i++] = g3; d[i++] = b3; d[i++] = a3;
      batch.len = i;
    }

    pushRect(batch, x, y, w, h, r, g, b, a) {
      this.pushTri(batch, x, y, r, g, b, a, x + w, y, r, g, b, a, x + w, y + h, r, g, b, a);
      this.pushTri(batch, x, y, r, g, b, a, x + w, y + h, r, g, b, a, x, y + h, r, g, b, a);
    }

    pushRadialFan(batch, cx, cy, radius, segs, cr, cg, cb, ca, er, eg, eb, ea) {
      this.reserve(batch, segs * 18);
      const d = batch.data;
      let idx = batch.len;
      const step = (Math.PI * 2) / segs;
      let px = cx + radius;
      let py = cy;
      for (let s = 1; s <= segs; s++) {
        const ang = s * step;
        const nx = cx + Math.cos(ang) * radius;
        const ny = cy + Math.sin(ang) * radius;
        d[idx++] = cx; d[idx++] = cy; d[idx++] = cr; d[idx++] = cg; d[idx++] = cb; d[idx++] = ca;
        d[idx++] = px; d[idx++] = py; d[idx++] = er; d[idx++] = eg; d[idx++] = eb; d[idx++] = ea;
        d[idx++] = nx; d[idx++] = ny; d[idx++] = er; d[idx++] = eg; d[idx++] = eb; d[idx++] = ea;
        px = nx;
        py = ny;
      }
      batch.len = idx;
    }

    pushCircleOutline(batch, cx, cy, radius, segs, r, g, b, a, startAng = 0, endAng = Math.PI * 2, dashed = false) {
      const span = endAng - startAng;
      const step = span / segs;
      this.reserve(batch, segs * 12);
      let px = cx + Math.cos(startAng) * radius;
      let py = cy + Math.sin(startAng) * radius;
      for (let s = 1; s <= segs; s++) {
        const ang = startAng + s * step;
        const nx = cx + Math.cos(ang) * radius;
        const ny = cy + Math.sin(ang) * radius;
        if (!dashed || (s & 1) === 1) {
          this.pushLine(batch, px, py, nx, ny, r, g, b, a);
        }
        px = nx;
        py = ny;
      }
    }

    pushTransformedPoly(poly, cx, cy, cosA, sinA, fillCol, strokeCol, fillBatch, lineBatch) {
      const count = poly.length >> 1;
      if (count < 3) return;
      // Compute world vertices in small static-ish scratch or emit fan from centroid (0,0)
      let x0 = cx + poly[0] * cosA - poly[1] * sinA;
      let y0 = cy + poly[0] * sinA + poly[1] * cosA;
      let prevX = x0;
      let prevY = y0;

      for (let k = 1; k < count; k++) {
        const lx = poly[k * 2];
        const ly = poly[k * 2 + 1];
        const wx = cx + lx * cosA - ly * sinA;
        const wy = cy + lx * sinA + ly * cosA;
        if (fillCol) {
          this.pushTri(
            fillBatch,
            cx, cy, fillCol[0], fillCol[1], fillCol[2], fillCol[3],
            prevX, prevY, fillCol[0], fillCol[1], fillCol[2], fillCol[3],
            wx, wy, fillCol[0], fillCol[1], fillCol[2], fillCol[3]
          );
        }
        if (strokeCol) {
          this.pushLine(lineBatch, prevX, prevY, wx, wy, strokeCol[0], strokeCol[1], strokeCol[2], strokeCol[3]);
        }
        prevX = wx;
        prevY = wy;
      }
      if (fillCol) {
        this.pushTri(
          fillBatch,
          cx, cy, fillCol[0], fillCol[1], fillCol[2], fillCol[3],
          prevX, prevY, fillCol[0], fillCol[1], fillCol[2], fillCol[3],
          x0, y0, fillCol[0], fillCol[1], fillCol[2], fillCol[3]
        );
      }
      if (strokeCol) {
        this.pushLine(lineBatch, prevX, prevY, x0, y0, strokeCol[0], strokeCol[1], strokeCol[2], strokeCol[3]);
      }
    }

    pushPoint(x, y, size, r, g, b, a) {
      const batch = this.batches.pointAdd;
      this.reserve(batch, 7);
      const d = batch.data;
      let i = batch.len;
      d[i++] = x; d[i++] = y; d[i++] = size; d[i++] = r; d[i++] = g; d[i++] = b; d[i++] = a;
      batch.len = i;
    }

    flushGeom(batch, mode, additive, width, height, shakeX, shakeY) {
      if (batch.len === 0) return;
      const gl = this.gl;
      gl.blendFunc(gl.SRC_ALPHA, additive ? gl.ONE : gl.ONE_MINUS_SRC_ALPHA);
      gl.useProgram(this.geomProg);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.geomBuf);
      gl.bufferData(gl.ARRAY_BUFFER, batch.data.subarray(0, batch.len), gl.STREAM_DRAW);
      gl.enableVertexAttribArray(this.geomLoc.aPos);
      gl.enableVertexAttribArray(this.geomLoc.aColor);
      gl.vertexAttribPointer(this.geomLoc.aPos, 2, gl.FLOAT, false, 24, 0);
      gl.vertexAttribPointer(this.geomLoc.aColor, 4, gl.FLOAT, false, 24, 8);
      gl.uniform2f(this.geomLoc.uRes, width, height);
      gl.uniform2f(this.geomLoc.uShake, shakeX, shakeY);
      gl.drawArrays(mode, 0, batch.len / 6);
      gl.disableVertexAttribArray(this.geomLoc.aPos);
      gl.disableVertexAttribArray(this.geomLoc.aColor);
    }

    renderFrame(frame) {
      if (!this.isActive()) return;
      const gl = this.gl;
      const {
        width, height, dpr, timeSec, timeScale, shakeX, shakeY,
        stars, grid, particles, wells, bullets, enemies, pickups,
        player, autopilot, state, quality, preset
      } = frame;

      const bGrid = this.batches.lineGrid;
      const bTriAdd = this.batches.triAdd;
      const bTriAlpha = this.batches.triAlpha;
      const bLineAlpha = this.batches.lineAlpha;
      const bLineAdd = this.batches.lineAdd;
      const bPt = this.batches.pointAdd;

      bGrid.len = 0;
      bTriAdd.len = 0;
      bTriAlpha.len = 0;
      bLineAlpha.len = 0;
      bLineAdd.len = 0;
      bPt.len = 0;

      // 1. Background + Cosmic Nebula Shader Pass
      gl.disable(gl.BLEND);
      gl.useProgram(this.nebulaProg);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.triBuf);
      gl.enableVertexAttribArray(this.nebLoc.aPos);
      gl.vertexAttribPointer(this.nebLoc.aPos, 2, gl.FLOAT, false, 0, 0);
      gl.uniform2f(this.nebLoc.uRes, width, height);
      gl.uniform1f(this.nebLoc.uTime, timeSec);
      gl.uniform1f(this.nebLoc.uBulletTime, timeScale < 0.7 ? 1.0 : 0.0);
      gl.uniform1f(this.nebLoc.uNebula, preset ? preset.nebula : 0.5);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.disableVertexAttribArray(this.nebLoc.aPos);
      gl.enable(gl.BLEND);

      // 2. Pack Spacetime Grid
      if (grid) {
        const cols = grid.cols;
        const rows = grid.rows;
        const isSlow = timeScale < 0.7;
        const baseR = isSlow ? 0.37 : 0.165;
        const baseG = isSlow ? 0.51 : 0.305;
        const baseB = isSlow ? 1.0 : 0.54;
        const baseA = 0.2;
        const showStrain = quality !== 'low';

        for (let r = 1; r < rows - 1; r++) {
          const rowOff = r * cols;
          for (let c = 1; c < cols - 1; c++) {
            const i = rowOff + c;
            const x0 = grid.px[i];
            const y0 = grid.py[i];
            const s = showStrain ? grid.strain[i] : 0;

            let cr = baseR, cg = baseG, cb = baseB, ca = baseA;
            if (s > 0.12) {
              const rgb = hslToRgbNorm(grid.hueShift[i] || 195, 0.95, 0.64);
              cr = rgb[0]; cg = rgb[1]; cb = rgb[2];
              ca = Math.min(0.82, s * 0.72);
            }
            if (c < cols - 2) {
              this.pushLine(bGrid, x0, y0, grid.px[i + 1], grid.py[i + 1], cr, cg, cb, ca);
            }
            if (r < rows - 2) {
              this.pushLine(bGrid, x0, y0, grid.px[i + cols], grid.py[i + cols], cr, cg, cb, ca);
            }
          }
        }
      }

      // 3. Pack Binary Star Bridges
      if (player && player.mods.binaryBridge > 0 && wells && wells.length >= 2) {
        for (let i = 0; i < wells.length; i++) {
          for (let j = i + 1; j < wells.length; j++) {
            const w1 = wells[i];
            const w2 = wells[j];
            if (Math.hypot(w2.x - w1.x, w2.y - w1.y) < 560) {
              this.pushLine(bLineAdd, w1.x - 2, w1.y - 2, w2.x - 2, w2.y - 2, 0.72, 0.36, 1.0, 0.42);
              this.pushLine(bLineAdd, w1.x + 2, w1.y + 2, w2.x + 2, w2.y + 2, 0.72, 0.36, 1.0, 0.42);
              this.pushLine(bLineAdd, w1.x, w1.y, w2.x, w2.y, 0.49, 0.98, 1.0, 0.9);
            }
          }
        }
      }

      // 4. Pack Gravity Wells
      if (wells) {
        for (let i = 0; i < wells.length; i++) {
          const w = wells[i];
          const alpha = Math.min(1, w.life / 0.8) * Math.min(1, (w.maxLife - w.life + 0.12) * 5);
          const isPull = w.polarity > 0;
          const pr = isPull ? 0.725 : 1.0;
          const pg = isPull ? 0.36 : 0.72;
          const pb = isPull ? 1.0 : 0.22;
          const ar = isPull ? 0.0 : 1.0;
          const ag = isPull ? 0.94 : 0.94;
          const ab = isPull ? 1.0 : 0.72;

          // Accretion glow fan
          const glowR = w.slingshotRadius * 1.18;
          this.pushRadialFan(
            bTriAdd, w.x, w.y, glowR, 24,
            pr, pg, pb, 0.55 * alpha,
            ar * 0.4, ag * 0.4, ab * 0.4, 0.0
          );

          // Event horizon core
          if (isPull) {
            this.pushRadialFan(bTriAlpha, w.x, w.y, w.coreRadius * 0.9, 18, 0.015, 0.008, 0.04, 0.98 * alpha, 0.03, 0.01, 0.08, 0.9 * alpha);
          } else {
            this.pushRadialFan(bTriAlpha, w.x, w.y, w.coreRadius * 0.9, 18, 1.0, 0.98, 0.9, 0.96 * alpha, 1.0, 0.78, 0.28, 0.85 * alpha);
          }

          // Slingshot dashed ring + 3 swirling photon-sphere arcs + remaining life arc
          this.pushCircleOutline(bLineAlpha, w.x, w.y, w.slingshotRadius, 28, pr, pg, pb, 0.24 * alpha, w.phase * 0.25, w.phase * 0.25 + Math.PI * 2, true);
          for (let k = 0; k < 3; k++) {
            const a0 = w.phase + (k * Math.PI * 2) / 3;
            this.pushCircleOutline(bLineAlpha, w.x, w.y, w.coreRadius * 1.22, 8, ar, ag, ab, 0.92 * alpha, a0, a0 + 1.15);
          }
          const lifeRatio = Math.max(0, w.life / w.maxLife);
          this.pushCircleOutline(bLineAlpha, w.x, w.y, w.coreRadius * 1.55, 18, pr, pg, pb, 0.75 * alpha, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * lifeRatio);
          if (w.orbitCount > 0) {
            const chargeAlpha = Math.min(0.95, 0.3 + w.orbitCount * 0.06);
            this.pushCircleOutline(bLineAdd, w.x, w.y, w.coreRadius * 1.48, 22, 1.0, 0.48, 1.0, chargeAlpha * alpha);
          }
        }
      }

      // 5. Pack Pickups
      if (pickups) {
        for (let i = 0; i < pickups.length; i++) {
          const pk = pickups[i];
          if (pk.kind === 'xp') {
            this.pushTri(bTriAlpha, pk.x, pk.y - 5, 0, 1, 0.65, 1, pk.x + 4.5, pk.y, 0, 1, 0.65, 1, pk.x, pk.y + 5, 0, 1, 0.65, 1);
            this.pushTri(bTriAlpha, pk.x, pk.y - 5, 0, 1, 0.65, 1, pk.x, pk.y + 5, 0, 1, 0.65, 1, pk.x - 4.5, pk.y, 0, 1, 0.65, 1);
          } else {
            this.pushRadialFan(bTriAlpha, pk.x, pk.y, 7, 12, 0.13, 1, 0.65, 1, 0.13, 1, 0.65, 1);
            this.pushCircleOutline(bLineAlpha, pk.x, pk.y, 7, 12, 1, 1, 1, 0.95);
          }
        }
      }

      // 6. Pack Bullets & Relativistic Trails
      if (bullets) {
        const showTrails = !preset || preset.bulletTrails;
        const showGlow = !preset || preset.bulletGlow;
        for (let i = 0; i < bullets.length; i++) {
          const b = bullets[i];
          const rgb = this.parseHexRgb(b.color);
          if (showTrails && b.trail.length > 1) {
            let px = b.trail[0].x;
            let py = b.trail[0].y;
            const len = b.trail.length;
            for (let t = 1; t < len; t++) {
              const nx = b.trail[t].x;
              const ny = b.trail[t].y;
              const a0 = 0.12 + 0.45 * (t / len);
              this.pushLine(bLineAdd, px, py, nx, ny, rgb[0], rgb[1], rgb[2], a0);
              px = nx;
              py = ny;
            }
            this.pushLine(bLineAdd, px, py, b.x, b.y, rgb[0], rgb[1], rgb[2], 0.65);
          }
          if (showGlow) {
            this.pushPoint(b.x, b.y, b.radius * 4.4, rgb[0], rgb[1], rgb[2], 0.42);
            this.pushPoint(b.x, b.y, b.radius * 2.1, 1.0, 1.0, 1.0, 1.0);
          } else {
            this.pushPoint(b.x, b.y, b.radius * 2.4, rgb[0], rgb[1], rgb[2], 0.95);
          }
        }
      }

      // 7. Pack Enemies & Bosses
      if (enemies) {
        const hullCol = [0.051, 0.071, 0.141, 0.96];
        const segFill = [0.11, 0.043, 0.118, 0.96];
        for (let i = 0; i < enemies.length; i++) {
          const e = enemies[i];
          const baseRgb = this.parseHexRgb(e.color);
          let sr = baseRgb[0], sg = baseRgb[1], sb = baseRgb[2];
          if (e.hitFlash > 0) { sr = 1; sg = 1; sb = 1; }
          else if (e.stunTimer > 0) { sr = 0.49; sg = 0.98; sb = 1; }
          else if (e.cryoTimer > 0) { sr = 0.49; sg = 0.83; sb = 0.99; }
          const strokeCol = [sr, sg, sb, 1.0];

          // Sniper telegraph laser sight
          if (e.type === 'sniper' && e.chargeTimer > 0) {
            const imminent = e.chargeTimer < 0.22;
            const lx = e.x + Math.cos(e.angle) * 900;
            const ly = e.y + Math.sin(e.angle) * 900;
            if (imminent) {
              this.pushLine(bLineAlpha, e.x, e.y, lx, ly, 1, 1, 1, 0.92);
            } else {
              this.pushLine(bLineAlpha, e.x, e.y, lx, ly, 1, 0.62, 0.17, 0.45);
            }
          }

          if (e.type === 'boss_archon') {
            const c1x = e.x + Math.cos(e.orbitAngle) * e.twinDist;
            const c1y = e.y + Math.sin(e.orbitAngle) * e.twinDist;
            const c2x = e.x - Math.cos(e.orbitAngle) * e.twinDist;
            const c2y = e.y - Math.sin(e.orbitAngle) * e.twinDist;
            this.pushLine(bLineAdd, c1x, c1y, c2x, c2y, 1.0, 0.87, 0.49, 0.9);
            this.pushLine(bLineAdd, c1x + 1.5, c1y + 1.5, c2x + 1.5, c2y + 1.5, 1.0, 0.87, 0.49, 0.55);

            this.pushRadialFan(bTriAlpha, c1x, c1y, 24, 18, 0.08, 0.05, 0.14, 0.96, 0.08, 0.05, 0.14, 0.96);
            this.pushCircleOutline(bLineAlpha, c1x, c1y, 24, 18, e.hitFlash > 0 ? 1 : 1.0, e.hitFlash > 0 ? 1 : 0.72, e.hitFlash > 0 ? 1 : 0.22, 1.0);

            this.pushRadialFan(bTriAlpha, c2x, c2y, 24, 18, 0.08, 0.05, 0.14, 0.96, 0.08, 0.05, 0.14, 0.96);
            this.pushCircleOutline(bLineAlpha, c2x, c2y, 24, 18, e.hitFlash > 0 ? 1 : 0.75, e.hitFlash > 0 ? 1 : 0.42, e.hitFlash > 0 ? 1 : 1.0, 1.0);
            continue;
          }

          // Leviathan segments
          if (e.segments) {
            const segStrokeR = e.hitFlash > 0 ? 1 : 1.0;
            const segStrokeG = e.hitFlash > 0 ? 1 : 0.16;
            const segStrokeB = e.hitFlash > 0 ? 1 : 0.37;
            for (let s = e.segments.length - 1; s >= 0; s--) {
              const seg = e.segments[s];
              const cosS = Math.cos(seg.angle);
              const sinS = Math.sin(seg.angle);
              this.pushRadialFan(bTriAlpha, seg.x, seg.y, seg.radius, 14, segFill[0], segFill[1], segFill[2], 0.95, segFill[0], segFill[1], segFill[2], 0.95);
              this.pushCircleOutline(bLineAlpha, seg.x, seg.y, seg.radius, 14, segStrokeR, segStrokeG, segStrokeB, 1.0);
              // Spine fins
              this.pushLine(
                bLineAlpha,
                seg.x + 4 * cosS - (-seg.radius) * sinS, seg.y + 4 * sinS + (-seg.radius) * cosS,
                seg.x + (-8) * cosS - (-seg.radius - 7) * sinS, seg.y + (-8) * sinS + (-seg.radius - 7) * cosS,
                segStrokeR, segStrokeG, segStrokeB, 1.0
              );
              this.pushLine(
                bLineAlpha,
                seg.x + 4 * cosS - seg.radius * sinS, seg.y + 4 * sinS + seg.radius * cosS,
                seg.x + (-8) * cosS - (seg.radius + 7) * sinS, seg.y + (-8) * sinS + (seg.radius + 7) * cosS,
                segStrokeR, segStrokeG, segStrokeB, 1.0
              );
            }
          }

          const cosA = Math.cos(e.angle);
          const sinA = Math.sin(e.angle);
          let poly = SWARMER_POLY;
          if (e.type === 'sniper') poly = SNIPER_POLY;
          else if (e.type === 'phalanx') poly = PHALANX_POLY;
          else if (e.type === 'pulsar') poly = PULSAR_POLY;
          else if (e.type === 'weaver') poly = WEAVER_POLY;
          else if (e.type === 'boss_leviathan') poly = LEVI_HEAD_POLY;

          this.pushTransformedPoly(poly, e.x, e.y, cosA, sinA, hullCol, strokeCol, bTriAlpha, bLineAlpha);

          if (e.type === 'phalanx') {
            this.pushCircleOutline(bLineAlpha, e.x, e.y, 24, 14, 0.49, 0.98, 1.0, 0.95, e.angle - 1.12, e.angle + 1.12);
          } else if (e.type === 'boss_leviathan') {
            this.pushLine(
              bLineAlpha,
              e.x + 18 * cosA - (-12) * sinA, e.y + 18 * sinA + (-12) * cosA,
              e.x + 38 * cosA - (-18) * sinA, e.y + 38 * sinA + (-18) * cosA,
              sr, sg, sb, 1
            );
            this.pushLine(
              bLineAlpha,
              e.x + 18 * cosA - 12 * sinA, e.y + 18 * sinA + 12 * cosA,
              e.x + 38 * cosA - 18 * sinA, e.y + 38 * sinA + 18 * cosA,
              sr, sg, sb, 1
            );
          }

          if (!e.isBoss && e.hp < e.maxHp) {
            const bw = 26;
            const bx = e.x - bw * 0.5;
            const by = e.y - e.radius - 10;
            this.pushRect(bTriAlpha, bx, by, bw, 3.5, 0, 0, 0, 0.65);
            this.pushRect(bTriAlpha, bx, by, bw * Math.max(0, e.hp / e.maxHp), 3.5, baseRgb[0], baseRgb[1], baseRgb[2], 1.0);
          }
        }
      }

      // 8. Pack Player, Auras, Drones, Clones, Afterimages & AI Telemetry
      if (player && (state === 'playing' || state === 'upgrade' || state === 'paused')) {
        // AI Telemetry
        if (autopilot && autopilot.enabled && autopilot.showTelemetry) {
          let minS = Infinity, maxS = -Infinity;
          for (const d of autopilot.sampledDirs) {
            if (d.score < minS) minS = d.score;
            if (d.score > maxS) maxS = d.score;
          }
          const span = Math.max(1, maxS - minS);
          for (const d of autopilot.sampledDirs) {
            const norm = (d.score - minS) / span;
            const len = 24 + norm * 38;
            const tr = norm > 0.75 ? 0.13 : (norm < 0.3 ? 1.0 : 0.49);
            const tg = norm > 0.75 ? 1.0 : (norm < 0.3 ? 0.23 : 0.98);
            const tb = norm > 0.75 ? 0.65 : (norm < 0.3 ? 0.42 : 1.0);
            const ta = norm > 0.75 ? 0.55 : (norm < 0.3 ? 0.42 : 0.22);
            this.pushLine(bLineAlpha, player.x + d.vx * 20, player.y + d.vy * 20, player.x + d.vx * len, player.y + d.vy * len, tr, tg, tb, ta);
          }
          if (autopilot.targetPoint) {
            const tp = autopilot.targetPoint;
            this.pushCircleOutline(bLineAlpha, tp.x, tp.y, tp.r + 12, 20, 0.13, 1.0, 0.65, 0.78, 0, Math.PI * 2, true);
          }
        }

        // Temporal rewind 3s ghost
        if (player.history.length > 15 && player.rewindCooldown <= 0) {
          const ghost = player.history[0];
          this.pushCircleOutline(bLineAlpha, ghost.x, ghost.y, 11, 16, 0, 0.94, 1, 0.26, 0, Math.PI * 2, true);
        }

        // Afterimages
        for (let i = 0; i < player.afterimages.length; i++) {
          const a = player.afterimages[i];
          const col = this.parseHexRgb(a.color);
          this.pushTransformedPoly(SHIP_POLY, a.x, a.y, Math.cos(a.angle), Math.sin(a.angle), null, [col[0], col[1], col[2], a.alpha], bTriAlpha, bLineAlpha);
        }

        // Paradox clones
        for (let i = 0; i < player.clones.length; i++) {
          const c = player.clones[i];
          const ca = Math.min(0.8, c.life * 0.4);
          this.pushRadialFan(bTriAlpha, c.x, c.y, 14, 16, 0, 1, 0.65, ca * 0.3, 0, 1, 0.65, ca * 0.3);
          this.pushCircleOutline(bLineAlpha, c.x, c.y, 14, 16, 0, 1, 0.65, ca);
        }

        // Auras
        const m = player.mods;
        const ap = player.auraPhase;
        const rMult = m.auraRadiusMult || 1.0;
        if (m.dilationAura > 0) {
          this.pushCircleOutline(bLineAlpha, player.x, player.y, 145, 32, 0.38, 0.65, 0.98, 0.16);
        }
        if (m.coronaRadius > 0) {
          const r = m.coronaRadius * rMult;
          this.pushRadialFan(bTriAdd, player.x, player.y, r, 24, 1.0, 0.43, 0.16, 0.02, 1.0, 0.35, 0.12, 0.14);
          this.pushCircleOutline(bLineAlpha, player.x, player.y, r, 32, 1.0, 0.51, 0.22, 0.45, ap * 0.9, ap * 0.9 + Math.PI * 2, true);
        }
        if (m.cryoRadius > 0) {
          const r = m.cryoRadius * rMult;
          this.pushCircleOutline(bLineAlpha, player.x, player.y, r, 32, 0.49, 0.83, 0.99, 0.38, -ap * 0.55, -ap * 0.55 + Math.PI * 2, true);
        }
        if (m.stormRadius > 0) {
          const r = m.stormRadius * rMult;
          this.pushCircleOutline(bLineAlpha, player.x, player.y, r, 36, 0, 0.94, 1, 0.28);
          for (let k = 0; k < 6; k++) {
            const ang = ap * 1.4 + (k * Math.PI * 2) / 6;
            this.pushPoint(player.x + Math.cos(ang) * r, player.y + Math.sin(ang) * r, 5.5, 0.49, 0.98, 1.0, 0.95);
          }
        }
        if (m.repulseRadius > 0) {
          const r = m.repulseRadius * rMult;
          const pulse = 0.24 + 0.14 * Math.sin(ap * 4);
          this.pushCircleOutline(bLineAlpha, player.x, player.y, r, 32, 0.75, 0.42, 1.0, pulse);
        }
        if (m.entropyRadius > 0) {
          const r = m.entropyRadius * rMult;
          this.pushCircleOutline(bLineAlpha, player.x, player.y, r, 32, 1.0, 0.23, 0.42, 0.34, -ap * 1.1, -ap * 1.1 + Math.PI * 2, true);
        }
        if (m.radRadius > 0) {
          const r = m.radRadius * rMult;
          this.pushCircleOutline(bLineAlpha, player.x, player.y, r, 32, 0.64, 0.9, 0.21, 0.36, ap * 0.7, ap * 0.7 + Math.PI * 2, true);
        }
        if (m.vortexPullRadius > 0) {
          const r = m.vortexPullRadius * rMult;
          this.pushCircleOutline(bLineAlpha, player.x, player.y, r, 32, 0.65, 0.55, 0.98, 0.26, -ap * 0.45, -ap * 0.45 + Math.PI * 2, true);
        }
        if (m.antimatterRadius > 0) {
          const r = m.antimatterRadius * rMult;
          this.pushCircleOutline(bLineAlpha, player.x, player.y, r, 28, 0.96, 0.45, 0.71, 0.38);
        }
        const beams = (player.beamTargets && player.beamTargets.length > 0)
          ? player.beamTargets
          : (player.beamTarget ? [player.beamTarget] : []);
        if (m.beamLevel > 0 && beams.length > 0) {
          const isPrism = m.evoBeamPrism > 0;
          for (let bi = 0; bi < beams.length; bi++) {
            const bt = beams[bi];
            if (!bt || bt.dead) continue;
            this.pushThickLine(
              bTriAdd,
              player.x,
              player.y,
              bt.x,
              bt.y,
              4.5 + m.beamLevel * 1.4,
              isPrism ? 1.0 : 0.49,
              isPrism ? 0.82 : 0.98,
              isPrism ? 0.4 : 1.0,
              0.82
            );
          }
        }

        // Lagrange drones
        for (let i = 0; i < player.drones.length; i++) {
          const d = player.drones[i];
          this.pushTransformedPoly(DRONE_POLY, d.x, d.y, Math.cos(d.angle * 2), Math.sin(d.angle * 2), [0, 0.94, 1, 0.95], [1, 1, 1, 0.95], bTriAlpha, bLineAlpha);
        }

        // Player Shield + Ship Hull + Quantum Core
        if (player.shield > 1) {
          const sRatio = player.shield / player.maxShield;
          this.pushCircleOutline(bLineAlpha, player.x, player.y, player.radius + 6, 24, 0.22, 0.74, 0.97, 0.22 + 0.38 * sRatio);
        }
        const shipAlpha = (player.invulnTimer > 0 && Math.floor(player.invulnTimer * 24) % 2 === 0) ? 0.45 : 1.0;
        const pCos = Math.cos(player.aimAngle);
        const pSin = Math.sin(player.aimAngle);
        this.pushTransformedPoly(SHIP_POLY, player.x, player.y, pCos, pSin, [0.043, 0.082, 0.157, 0.96 * shipAlpha], [0, 0.94, 1, shipAlpha], bTriAlpha, bLineAlpha);
        this.pushPoint(player.x + pCos, player.y + pSin, 8.5, player.bulletTimeActive ? 0.85 : 0.49, player.bulletTimeActive ? 0.54 : 0.98, 1.0, shipAlpha);
      }

      // 9. Pack Boss Health Bar (background + fill)
      if (enemies) {
        const boss = enemies.find(e => e.isBoss && !e.dead);
        if (boss) {
          const bw = Math.min(480, width * 0.62);
          const bx = (width - bw) * 0.5;
          const by = height - 42;
          const bRgb = this.parseHexRgb(boss.color);
          this.pushRect(bTriAlpha, bx, by, bw, 12, 0.024, 0.039, 0.094, 0.82);
          this.pushRect(bTriAlpha, bx + 2, by + 2, (bw - 4) * Math.max(0, boss.hp / boss.maxHp), 8, bRgb[0], bRgb[1], bRgb[2], 1.0);
          this.pushLine(bLineAlpha, bx, by, bx + bw, by, 1, 0.23, 0.42, 0.6);
          this.pushLine(bLineAlpha, bx + bw, by, bx + bw, by + 12, 1, 0.23, 0.42, 0.6);
          this.pushLine(bLineAlpha, bx + bw, by + 12, bx, by + 12, 1, 0.23, 0.42, 0.6);
          this.pushLine(bLineAlpha, bx, by + 12, bx, by, 1, 0.23, 0.42, 0.6);
        }
      }

      // 10. Pack Stars, Particles, Shockwaves & Lightnings
      if (stars) {
        for (let i = 0; i < stars.length; i++) {
          const s = stars[i];
          const a = s.alpha * (0.7 + 0.3 * Math.sin(timeSec * 2.0 + s.twinkle));
          this.pushPoint(s.nx * width, s.ny * height, s.size * 2.8, 0.85, 0.93, 1.0, a);
        }
      }

      if (particles) {
        const pList = particles.particles;
        for (let i = 0; i < pList.length; i++) {
          const p = pList[i];
          const alpha = Math.max(0, p.life / p.maxLife);
          if (alpha <= 0) continue;
          const rgb = this.parseHexRgb(p.color);
          if (p.streak) {
            this.pushLine(bLineAdd, p.x, p.y, p.x - p.vx * 0.032, p.y - p.vy * 0.032, rgb[0], rgb[1], rgb[2], alpha, rgb[0], rgb[1], rgb[2], alpha * 0.15);
          } else {
            this.pushPoint(p.x, p.y, p.size * (1.8 + 1.6 * alpha), rgb[0], rgb[1], rgb[2], alpha);
          }
        }

        const swList = particles.shockwaves;
        for (let i = 0; i < swList.length; i++) {
          const sw = swList[i];
          const alpha = Math.max(0, sw.life / sw.maxLife) * 0.85;
          const rgb = this.parseHexRgb(sw.color);
          this.pushCircleOutline(bLineAdd, sw.x, sw.y, sw.radius, 28, rgb[0], rgb[1], rgb[2], alpha);
        }

        const lList = particles.lightnings;
        for (let i = 0; i < lList.length; i++) {
          const l = lList[i];
          const alpha = Math.max(0, l.life / l.maxLife);
          const rgb = this.parseHexRgb(l.color);
          for (let k = 1; k < l.pts.length; k++) {
            this.pushLine(bLineAdd, l.pts[k - 1].x, l.pts[k - 1].y, l.pts[k].x, l.pts[k].y, rgb[0], rgb[1], rgb[2], alpha);
          }
        }
      }

      // 11. Flush All Batches in Visual Depth Order (<= 6 GPU draw calls!)
      this.flushGeom(bGrid, gl.LINES, false, width, height, shakeX, shakeY);
      this.flushGeom(bTriAdd, gl.TRIANGLES, true, width, height, shakeX, shakeY);
      this.flushGeom(bTriAlpha, gl.TRIANGLES, false, width, height, shakeX, shakeY);
      this.flushGeom(bLineAlpha, gl.LINES, false, width, height, shakeX, shakeY);
      this.flushGeom(bLineAdd, gl.LINES, true, width, height, shakeX, shakeY);

      if (bPt.len > 0) {
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
        gl.useProgram(this.pointProg);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.pointBuf);
        gl.bufferData(gl.ARRAY_BUFFER, bPt.data.subarray(0, bPt.len), gl.STREAM_DRAW);
        gl.enableVertexAttribArray(this.ptLoc.aPos);
        gl.enableVertexAttribArray(this.ptLoc.aSize);
        gl.enableVertexAttribArray(this.ptLoc.aColor);
        gl.vertexAttribPointer(this.ptLoc.aPos, 2, gl.FLOAT, false, 28, 0);
        gl.vertexAttribPointer(this.ptLoc.aSize, 1, gl.FLOAT, false, 28, 8);
        gl.vertexAttribPointer(this.ptLoc.aColor, 4, gl.FLOAT, false, 28, 12);
        gl.uniform2f(this.ptLoc.uRes, width, height);
        gl.uniform2f(this.ptLoc.uShake, shakeX, shakeY);
        gl.uniform1f(this.ptLoc.uDpr, dpr);
        gl.uniform1f(this.ptLoc.uMaxPt, this.maxPointSize);
        gl.drawArrays(gl.POINTS, 0, bPt.len / 7);
        gl.disableVertexAttribArray(this.ptLoc.aPos);
        gl.disableVertexAttribArray(this.ptLoc.aSize);
        gl.disableVertexAttribArray(this.ptLoc.aColor);
      }
    }
  }

  SG.GpuRenderer = GpuRenderer;
})(window.SG);
