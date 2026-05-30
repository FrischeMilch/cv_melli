/* BEGIN USAGE */
/**
 * <image-slot> — user-fillable image placeholder
 *
 * Usage:
 *   <image-slot id="my-slot" shape="rect" fit="cover" placeholder="Drop image"></image-slot>
 *
 * Attributes:
 *   shape       — "rect" (default) | "circle"
 *   fit         — "cover" (default) | "contain"
 *   placeholder — text shown when empty
 *   readonly    — boolean attr, disables editing
 *
 * The component stores image data + crop/zoom in localStorage under the key
 * ".image-slots.state.json" as a JSON object keyed by element id.
 */
/* END USAGE */

(function () {
  'use strict';

  // ─── tiny pub/sub ──────────────────────────────────────────────────────────
  const bus = new EventTarget();

  // ─── persistence ───────────────────────────────────────────────────────────
  const STORE_KEY = '.image-slots.state.json';
  function loadStore () {
    try { return JSON.parse(localStorage.getItem(STORE_KEY) || '{}'); } catch { return {}; }
  }
  function saveStore (store) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch {}
  }

  // ─── helpers ────────────────────────────────────────────────────────────────
  function clamp (v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  function readFileAsDataURL (file) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result);
      r.onerror = rej;
      r.readAsDataURL(file);
    });
  }

  function imageFromSrc (src) {
    return new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = rej;
      img.src = src;
    });
  }

  // ─── component ──────────────────────────────────────────────────────────────
  class ImageSlot extends HTMLElement {
    constructor () {
      super();
      this._src    = null;   // raw data-url
      this._zoom   = 1;
      this._ox     = 0.5;   // origin 0‥1
      this._oy     = 0.5;
      this._drag   = null;
      this._adjusting = false;
    }

    connectedCallback () {
      if (this.shadowRoot) return; // already set up
      const shadow = this.attachShadow({ mode: 'open' });
      shadow.innerHTML = `
        <style>
          :host { display:block; position:relative; overflow:hidden;
                  cursor:pointer; user-select:none; -webkit-user-select:none; }
          .bg   { position:absolute; inset:0; display:flex; align-items:center;
                  justify-content:center; flex-direction:column; gap:6px;
                  background:#e8e4da; color:#9a978c;
                  font-family:system-ui,sans-serif; font-size:13px; font-weight:500; }
          .bg svg { opacity:.45; }
          .img  { position:absolute; inset:0; }
          .img canvas { position:absolute; top:0; left:0; width:100%; height:100%; }
          .handle { position:absolute; inset:0; }
          .badge  { position:absolute; bottom:6px; right:6px;
                    background:rgba(0,0,0,.45); color:#fff; border-radius:4px;
                    font-family:system-ui,sans-serif; font-size:10px;
                    padding:2px 6px; pointer-events:none; opacity:0;
                    transition:opacity .2s; }
          :host(:hover) .badge { opacity:1; }
          .change-btn { position:absolute; top:6px; right:6px;
                    background:rgba(0,0,0,.55); color:#fff; border:none; border-radius:4px;
                    font-family:system-ui,sans-serif; font-size:10px; font-weight:600;
                    padding:4px 8px; cursor:pointer; opacity:0;
                    transition:opacity .2s; z-index:2; }
          .change-btn:hover { background:rgba(0,0,0,.75); }
          :host(:hover) .change-btn.visible { opacity:1; }
        </style>
        <div class="bg">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="1.5">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <path d="M21 15l-5-5L5 21"/>
          </svg>
          <span class="ph"></span>
        </div>
        <div class="img" hidden>
          <canvas></canvas>
        </div>
        <div class="handle"></div>
        <button class="change-btn" type="button">📷 Ändern</button>
        <div class="badge">Doppelklick zum Ausrichten</div>`;

      this._bg     = shadow.querySelector('.bg');
      this._ph     = shadow.querySelector('.ph');
      this._imgDiv = shadow.querySelector('.img');
      this._canvas = shadow.querySelector('canvas');
      this._handle = shadow.querySelector('.handle');

      this._changeBtn = shadow.querySelector('.change-btn');
      this._ph.textContent = this.getAttribute('placeholder') || 'Drop image';

      this._bindEvents();
      this._restore();
    }

    // ── public api ─────────────────────────────────────────────────────────────
    get slotId ()  { return this.id || this.getAttribute('slot-id') || ''; }
    get readonly ()  { return this.hasAttribute('readonly'); }

    // ── restore from storage ───────────────────────────────────────────────────
    _restore () {
      const store = loadStore();
      const s = store[this.slotId];
      if (!s) return;
      this._src  = s.src;
      this._zoom = s.zoom ?? 1;
      this._ox   = s.ox   ?? 0.5;
      this._oy   = s.oy   ?? 0.5;
      this._render();
    }

    _persist () {
      if (!this.slotId) return;
      const store = loadStore();
      store[this.slotId] = { src: this._src, zoom: this._zoom, ox: this._ox, oy: this._oy };
      saveStore(store);
    }

    // ── rendering ──────────────────────────────────────────────────────────────
    async _render () {
      if (!this._src) {
        this._imgDiv.hidden = true;
        this._bg.hidden = false;
        this._changeBtn.classList.remove('visible');
        return;
      }
      this._bg.hidden = true;
      this._imgDiv.hidden = false;
      this._changeBtn.classList.add('visible');

      const canvas  = this._canvas;
      const dpr     = window.devicePixelRatio || 1;
      const W       = this.offsetWidth  || 300;
      const H       = this.offsetHeight || 400;
      canvas.width  = W * dpr;
      canvas.height = H * dpr;
      canvas.style.width  = W + 'px';
      canvas.style.height = H + 'px';

      const ctx  = canvas.getContext('2d');
      ctx.scale(dpr, dpr);

      const img  = await imageFromSrc(this._src);
      const iw   = img.naturalWidth;
      const ih   = img.naturalHeight;

      // base scale (cover)
      const scale = Math.max(W / iw, H / ih) * this._zoom;
      const sw    = iw * scale;
      const sh    = ih * scale;
      const sx    = (W - sw) * this._ox * 2;  // origin mapping
      const sy    = (H - sh) * this._oy * 2;

      ctx.clearRect(0, 0, W, H);
      ctx.drawImage(img, sx, sy, sw, sh);
    }

    // ── events ─────────────────────────────────────────────────────────────────
    _bindEvents () {
      if (this.readonly) return;

      const handle = this._handle;

      // ── drag-and-drop ──
      this.addEventListener('dragover',  e => e.preventDefault());
      this.addEventListener('drop', async e => {
        e.preventDefault();
        const file = e.dataTransfer?.files?.[0];
        if (file && file.type.startsWith('image/')) await this._loadFile(file);
      });

      // ── click-to-open ──
      handle.addEventListener('click', () => {
        if (this._adjusting) { this._adjusting = false; return; }
        if (!this._src) this._openPicker();
      });

      // ── change button ──
      this._changeBtn.addEventListener('click', e => {
        e.stopPropagation();
        this._openPicker();
      });

      // ── double-click → adjust mode ──
      handle.addEventListener('dblclick', e => {
        e.stopPropagation();
        if (!this._src) return;
        this._adjusting = !this._adjusting;
        handle.style.cursor = this._adjusting ? 'move' : '';
        this.shadowRoot.querySelector('.badge').textContent =
          this._adjusting ? 'Ziehen zum Verschieben, Scrollen zum Zoomen' : 'Doppelklick zum Ausrichten';
      });

      // ── pointer drag (adjust) ──
      handle.addEventListener('pointerdown', e => {
        if (!this._adjusting || !this._src) return;
        this._drag = { x: e.clientX, y: e.clientY, ox: this._ox, oy: this._oy };
        handle.setPointerCapture(e.pointerId);
      });
      handle.addEventListener('pointermove', e => {
        if (!this._drag) return;
        const W  = this.offsetWidth;
        const H  = this.offsetHeight;
        const dx = (e.clientX - this._drag.x) / W;
        const dy = (e.clientY - this._drag.y) / H;
        this._ox = clamp(this._drag.ox - dx, 0, 1);
        this._oy = clamp(this._drag.oy - dy, 0, 1);
        this._render();
      });
      handle.addEventListener('pointerup', () => {
        if (!this._drag) return;
        this._drag = null;
        this._persist();
      });

      // ── wheel zoom ──
      this.addEventListener('wheel', e => {
        if (!this._adjusting || !this._src) return;
        e.preventDefault();
        this._zoom = clamp(this._zoom * (e.deltaY < 0 ? 1.08 : 0.92), 0.5, 5);
        this._render();
        this._persist();
      }, { passive: false });

      // ── re-render on resize ──
      new ResizeObserver(() => this._render()).observe(this);
    }

    async _loadFile (file) {
      this._src  = await readFileAsDataURL(file);
      this._zoom = 1;
      this._ox   = 0.5;
      this._oy   = 0.5;
      this._render();
      this._persist();
    }

    _openPicker () {
      const inp = document.createElement('input');
      inp.type   = 'file';
      inp.accept = 'image/*';
      inp.onchange = () => { if (inp.files[0]) this._loadFile(inp.files[0]); };
      inp.click();
    }
  }

  customElements.define('image-slot', ImageSlot);
})();
