/* BEGIN USAGE */
/**
 * <image-slot> — user-fillable image placeholder
 *
 * Attributes:
 *   slot-id     — storage key (slots sharing a slot-id share one image)
 *   shape       — "rect" (default) | "circle"
 *   fit         — "cover" (default) | "contain"
 *   placeholder — text shown when empty
 *   readonly    — boolean attr, disables editing
 *
 * Image data is stored in IndexedDB (no localStorage size limits).
 * For publishing, call window.__getImageStore() to get all image data.
 */
/* END USAGE */

(function () {
  'use strict';

  // ─── pub/sub for cross-slot sync ───────────────────────────────────────────
  const bus = new EventTarget();

  // ─── IndexedDB persistence ─────────────────────────────────────────────────
  const DB_NAME = 'image-slots';
  const DB_VER  = 1;
  const OBJ_STORE = 'images';
  let _dbPromise = null;

  function getDB () {
    if (_dbPromise) return _dbPromise;
    _dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VER);
      req.onupgradeneeded = () => req.result.createObjectStore(OBJ_STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return _dbPromise;
  }

  async function dbGet (key) {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(OBJ_STORE, 'readonly');
      const req = tx.objectStore(OBJ_STORE).get(key);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
  }

  async function dbPut (key, value) {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(OBJ_STORE, 'readwrite');
      const req = tx.objectStore(OBJ_STORE).put(value, key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async function dbGetAll () {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(OBJ_STORE, 'readonly');
      const store = tx.objectStore(OBJ_STORE);
      const result = {};
      const req = store.openCursor();
      req.onsuccess = () => {
        const cursor = req.result;
        if (cursor) { result[cursor.key] = cursor.value; cursor.continue(); }
        else resolve(result);
      };
      req.onerror = () => reject(req.error);
    });
  }

  // Migrate old localStorage data to IndexedDB (one-time)
  async function migrateFromLocalStorage () {
    const LS_KEY = '.image-slots.state.json';
    let old;
    try { old = JSON.parse(localStorage.getItem(LS_KEY) || '{}'); } catch { return; }
    const keys = Object.keys(old).filter(k => old[k] && old[k].src);
    if (!keys.length) return;
    for (const k of keys) {
      const existing = await dbGet(k);
      if (!existing) await dbPut(k, old[k]);
    }
    try { localStorage.removeItem(LS_KEY); } catch {}
  }

  // Global accessor for buildPublishHTML()
  window.__getImageStore = async function () {
    await migrateFromLocalStorage();
    return dbGetAll();
  };

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
      this._src    = null;
      this._zoom   = 1;
      this._ox     = 0.5;
      this._oy     = 0.5;
      this._drag   = null;
      this._adjusting = false;
    }

    connectedCallback () {
      if (this.shadowRoot) return;
      const shadow = this.attachShadow({ mode: 'open' });
      shadow.innerHTML = `
        <style>
          :host { display:block; position:relative; overflow:hidden;
                  cursor:pointer; user-select:none; -webkit-user-select:none; }
          :host([readonly]) { cursor:default; }
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
          :host([readonly]) .change-btn { display:none; }
          :host([readonly]) .badge { display:none; }
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

      bus.addEventListener('image-changed', (e) => {
        if (e.detail.key === this.slotId && e.detail.source !== this) {
          this._src  = e.detail.src;
          this._zoom = e.detail.zoom;
          this._ox   = e.detail.ox;
          this._oy   = e.detail.oy;
          this._render();
        }
      });
    }

    // ── public api ─────────────────────────────────────────────────────────────
    get slotId () { return this.getAttribute('slot-id') || this.id || ''; }
    get readonly () { return this.hasAttribute('readonly'); }

    // ── restore from storage ───────────────────────────────────────────────────
    async _restore () {
      const pubMeta = document.querySelector('meta[name="publish-date"]');
      const curPub  = pubMeta ? parseInt(pubMeta.getAttribute('content'), 10) || 0 : 0;

      // 1. IndexedDB (user's edits on this device)
      try {
        await migrateFromLocalStorage();
        const s = await dbGet(this.slotId);
        if (s && s.src) {
          if (!s.pub || !curPub || s.pub >= curPub) {
            this._src = s.src; this._zoom = s.zoom ?? 1;
            this._ox = s.ox ?? 0.5; this._oy = s.oy ?? 0.5;
            this._render();
            return;
          }
        }
      } catch {}

      // 2. Embedded image data (published HTML — for new devices)
      const embedded = document.getElementById('embedded-images');
      if (embedded) {
        try {
          const all = JSON.parse(embedded.textContent);
          const e = all[this.slotId];
          if (e && e.src) {
            this._src = e.src; this._zoom = e.zoom ?? 1;
            this._ox = e.ox ?? 0.5; this._oy = e.oy ?? 0.5;
            this._render();
            this._persist(curPub);
            return;
          }
        } catch {}
      }

      // 3. data-state attribute (published HTML — legacy)
      const attr = this.getAttribute('data-state');
      if (attr) {
        try {
          const a = JSON.parse(attr);
          if (a.src) {
            this._src = a.src; this._zoom = a.zoom ?? 1;
            this._ox = a.ox ?? 0.5; this._oy = a.oy ?? 0.5;
            this._render();
            this._persist(curPub);
            return;
          }
        } catch {}
      }
    }

    async _persist (fromPublish) {
      if (!this.slotId) return;
      const entry = { src: this._src, zoom: this._zoom, ox: this._ox, oy: this._oy };
      if (fromPublish) entry.pub = fromPublish;
      try { await dbPut(this.slotId, entry); } catch (e) {
        console.warn('[image-slot] Speichern fehlgeschlagen:', e.message);
      }
      bus.dispatchEvent(new CustomEvent('image-changed', {
        detail: { key: this.slotId, source: this, src: this._src, zoom: this._zoom, ox: this._ox, oy: this._oy }
      }));
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

      const scale = Math.max(W / iw, H / ih) * this._zoom;
      const sw    = iw * scale;
      const sh    = ih * scale;
      const sx    = (W - sw) * this._ox * 2;
      const sy    = (H - sh) * this._oy * 2;

      ctx.clearRect(0, 0, W, H);
      ctx.drawImage(img, sx, sy, sw, sh);
    }

    // ── events ─────────────────────────────────────────────────────────────────
    _bindEvents () {
      const handle = this._handle;

      this.addEventListener('dragover', e => { if (!this.readonly) e.preventDefault(); });
      this.addEventListener('drop', async e => {
        if (this.readonly) return;
        e.preventDefault();
        const file = e.dataTransfer?.files?.[0];
        if (file && file.type.startsWith('image/')) await this._loadFile(file);
      });

      handle.addEventListener('click', () => {
        if (this.readonly) return;
        if (this._adjusting) { this._adjusting = false; return; }
        if (!this._src) this._openPicker();
      });

      this._changeBtn.addEventListener('click', e => {
        if (this.readonly) return;
        e.stopPropagation();
        this._openPicker();
      });

      handle.addEventListener('dblclick', e => {
        if (this.readonly) return;
        e.stopPropagation();
        if (!this._src) return;
        this._adjusting = !this._adjusting;
        handle.style.cursor = this._adjusting ? 'move' : '';
        this.shadowRoot.querySelector('.badge').textContent =
          this._adjusting ? 'Ziehen zum Verschieben, Scrollen zum Zoomen' : 'Doppelklick zum Ausrichten';
      });

      handle.addEventListener('pointerdown', e => {
        if (this.readonly || !this._adjusting || !this._src) return;
        this._drag = { x: e.clientX, y: e.clientY, ox: this._ox, oy: this._oy };
        handle.setPointerCapture(e.pointerId);
      });
      handle.addEventListener('pointermove', e => {
        if (!this._drag) return;
        const W = this.offsetWidth, H = this.offsetHeight;
        this._ox = clamp(this._drag.ox - (e.clientX - this._drag.x) / W, 0, 1);
        this._oy = clamp(this._drag.oy - (e.clientY - this._drag.y) / H, 0, 1);
        this._render();
      });
      handle.addEventListener('pointerup', () => {
        if (!this._drag) return;
        this._drag = null;
        this._persist();
      });

      this.addEventListener('wheel', e => {
        if (this.readonly || !this._adjusting || !this._src) return;
        e.preventDefault();
        this._zoom = clamp(this._zoom * (e.deltaY < 0 ? 1.08 : 0.92), 0.5, 5);
        this._render();
        this._persist();
      }, { passive: false });

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
