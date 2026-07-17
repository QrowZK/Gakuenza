// kadaiban-draw.js — the Kadaiban drawing surface.
//
// Fork-and-adapt of modules/nh6/writing.js (WritingCanvas): the stroke model
// (array of point-arrays), pointer/touch scaling, undo/clear/isEmpty are the
// same idea. What differs, and why this is a fork not a reuse (per the spec §7):
//
//   1. IMAGE-SPACE coordinates. The bitmap is sized to the source worksheet's
//      NATIVE pixel dimensions and never resized after load (nh6's resizeTo
//      changes the bitmap — we must not, or saved coords would be invalidated).
//      Display is scaled purely via CSS. Stored strokes are therefore in image
//      space, so resume-a-draft and flatten-to-PNG are pixel-exact regardless
//      of the on-screen scale or device.
//   2. BACKGROUND IMAGE layer instead of handwriting rulings/guide text. Two
//      stacked canvases: bg (worksheet, drawn once) + ink (transparent,
//      receives pointer events). The eraser is destination-out on the INK layer
//      only, so it can never rub out the worksheet underneath.
//   3. serialize()/load() ⇄ canvas_state jsonb, and flatten() → PNG data URL /
//      Blob for the kadaiban-submissions bucket.
//   4. Pointer Events (mouse + touch + stylus in one path) with touch-action:
//      none on the ink canvas.
//
// Phase 1 exposes a single pen colour + undo/clear. Eraser + colour select are
// wired but gated behind opts (Phase 2). No framework, no deps beyond a 2D ctx.
'use strict';

class KadaibanCanvas {
  // bgCanvas / inkCanvas: two overlaid <canvas> elements.
  // opts.color (default ink blue), opts.penWidth (6), opts.eraserWidth (30),
  // opts.onChange (called after every committed stroke / undo / clear — the
  // page debounces autosave off this).
  constructor(bgCanvas, inkCanvas, opts = {}) {
    this.bg  = bgCanvas;
    this.ink = inkCanvas;
    this.bgCtx  = bgCanvas.getContext('2d');
    this.inkCtx = inkCanvas.getContext('2d');

    this.strokes = [];       // [{ tool, color, width, points:[{x,y}] }]
    this._cur = null;
    this._drawing = false;

    this.tool = 'pen';
    this.color = opts.color || '#1f4e8c';
    this.penWidth = opts.penWidth || 6;
    this.eraserWidth = opts.eraserWidth || 30;
    this.onChange = opts.onChange || null;

    this._image = null;      // the loaded worksheet <img>, kept for flatten()
    this._setupEvents();
  }

  // ── background worksheet ────────────────────────────────────────────────
  // Loads the source image, sizes BOTH canvas bitmaps to its native pixels,
  // and paints it on the bg layer. Resolves once painted. `src` is any image
  // URL — in production a short-lived signed URL from the private
  // kadaiban-sources bucket. crossOrigin='anonymous' keeps the canvas
  // untainted so flatten()/toDataURL stays allowed (signed URLs are served
  // with permissive CORS by Supabase Storage).
  loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        this._image = img;
        const w = img.naturalWidth, h = img.naturalHeight;
        this.bg.width = w;  this.bg.height = h;
        this.ink.width = w; this.ink.height = h;
        this.bgCtx.clearRect(0, 0, w, h);
        this.bgCtx.drawImage(img, 0, 0, w, h);
        this._redrawInk();
        resolve({ width: w, height: h });
      };
      img.onerror = () => reject(new Error('kadaiban: worksheet image failed to load'));
      img.src = src;
    });
  }

  get width()  { return this.ink.width; }
  get height() { return this.ink.height; }

  // ── tools ───────────────────────────────────────────────────────────────
  setTool(t)  { this.tool = t === 'eraser' ? 'eraser' : 'pen'; }
  setColor(c) { this.color = c; this.tool = 'pen'; }

  // ── pointer handling (image-space) ──────────────────────────────────────
  _setupEvents() {
    const el = this.ink;
    el.addEventListener('pointerdown',  e => this._down(e));
    el.addEventListener('pointermove',  e => this._move(e));
    el.addEventListener('pointerup',    e => this._up(e));
    el.addEventListener('pointerleave', e => this._up(e));
    el.addEventListener('pointercancel',e => this._up(e));
  }

  _pos(e) {
    const r = this.ink.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) * (this.ink.width  / r.width),
      y: (e.clientY - r.top)  * (this.ink.height / r.height),
    };
  }

  _down(e) {
    e.preventDefault();
    try { this.ink.setPointerCapture(e.pointerId); } catch (_) {}
    this._drawing = true;
    const p = this._pos(e);
    this._cur = {
      tool: this.tool,
      color: this.color,
      width: this.tool === 'eraser' ? this.eraserWidth : this.penWidth,
      points: [p],
    };
    KadaibanCanvas.drawStroke(this.inkCtx, this._cur);   // dot on tap
  }

  _move(e) {
    if (!this._drawing || !this._cur) return;
    e.preventDefault();
    const prev = this._cur.points[this._cur.points.length - 1];
    const p = this._pos(e);
    this._cur.points.push(p);
    // Draw only the new segment incrementally (cheap; full ink is already on
    // the layer). Same tool/colour/width so it composites identically.
    KadaibanCanvas.drawStroke(this.inkCtx, {
      tool: this._cur.tool, color: this._cur.color, width: this._cur.width,
      points: [prev, p],
    });
  }

  _up() {
    if (!this._drawing) return;
    this._drawing = false;
    const cur = this._cur;
    this._cur = null;
    if (cur && cur.points.length) {
      this.strokes.push(cur);
      this._emitChange();
    }
  }

  // ── ink layer render ────────────────────────────────────────────────────
  _redrawInk() {
    this.inkCtx.clearRect(0, 0, this.ink.width, this.ink.height);
    for (const st of this.strokes) KadaibanCanvas.drawStroke(this.inkCtx, st);
  }

  _emitChange() { if (this.onChange) this.onChange(); }

  // ── public API ──────────────────────────────────────────────────────────
  undo()  { this.strokes.pop(); this._redrawInk(); this._emitChange(); }
  clear() { this.strokes = []; this._redrawInk(); this._emitChange(); }
  isEmpty() { return this.strokes.length === 0; }

  serialize() { return this.strokes; }         // → canvas_state jsonb

  // Restore a saved draft. Accepts the strokes array (jsonb) or its JSON string.
  load(state) {
    let arr = state;
    if (typeof state === 'string') { try { arr = JSON.parse(state); } catch (_) { arr = []; } }
    this.strokes = Array.isArray(arr) ? arr : [];
    this._redrawInk();
  }

  // Composite worksheet + ink at SOURCE resolution → PNG. Returns a Promise of
  // a Blob (for Storage upload). Uses an offscreen canvas so it never disturbs
  // the live layers.
  flattenBlob(type = 'image/png') {
    return new Promise((resolve) => {
      const c = this._flattenCanvas();
      if (c.toBlob) c.toBlob(b => resolve(b), type);
      else resolve(KadaibanCanvas._dataURLtoBlob(c.toDataURL(type)));
    });
  }
  flattenDataURL(type = 'image/png') { return this._flattenCanvas().toDataURL(type); }

  _flattenCanvas() {
    const c = document.createElement('canvas');
    c.width = this.ink.width; c.height = this.ink.height;
    const ctx = c.getContext('2d');
    if (this._image) ctx.drawImage(this._image, 0, 0, c.width, c.height);
    for (const st of this.strokes) KadaibanCanvas.drawStroke(ctx, st);
    return c;
  }

  // ── static stroke renderer (shared by live draw, redraw, and flatten) ────
  static drawStroke(ctx, st) {
    const pts = st.points;
    if (!pts || !pts.length) return;
    ctx.save();
    if (st.tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(0,0,0,1)';
      ctx.fillStyle = 'rgba(0,0,0,1)';
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = st.color || '#1f4e8c';
      ctx.fillStyle = st.color || '#1f4e8c';
    }
    ctx.lineWidth = st.width || 6;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (pts.length === 1) {
      // single tap → a dot
      ctx.beginPath();
      ctx.arc(pts[0].x, pts[0].y, ctx.lineWidth / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.stroke();
    ctx.restore();
  }

  static _dataURLtoBlob(dataURL) {
    const [head, b64] = dataURL.split(',');
    const mime = (head.match(/:(.*?);/) || [])[1] || 'image/png';
    const bin = atob(b64);
    const u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    return new Blob([u8], { type: mime });
  }
}

window.KadaibanCanvas = KadaibanCanvas;
