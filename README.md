# Handoff: Bewerbungsmappe (German Job-Application Set)

## Overview
A three-page German job-application document set ("Bewerbungsunterlagen") for one
applicant, **Melanie Kerner**:

1. **Deckblatt** (cover sheet) — title page with photo, content index, contact.
2. **Anschreiben** (cover letter) — formal German business letter.
3. **Lebenslauf** (CV / résumé) — two-column résumé with sidebar + timeline.

All three render as fixed **DIN A4 portrait** pages (210 × 297 mm) and are designed
to be printed / exported to PDF. The page also includes a small in-browser toolbar
that toggles inline editing (`contentEditable`) and triggers `window.print()`.

## About the Design Files
The files in this bundle are **design references created in HTML** — a working
prototype showing the intended look, layout and behavior. They are **not** meant to
be shipped as-is. The task is to **recreate these designs in the target codebase's
environment** (React, Vue, plain templating, a PDF-generation pipeline, etc.) using
its established patterns. If there is no existing environment, pick the most suitable
approach for the goal (e.g. a React component set, or a server-side HTML→PDF renderer
such as Puppeteer/WeasyPrint).

The most important real-world constraint: **each page must stay exactly one A4 page**
(no overflow, no page-2 spill). The HTML achieves this with carefully tuned `mm`
sizes; if you re-implement, keep a layout test that asserts content height ≤ 297 mm.

## Fidelity
**High-fidelity (hifi).** Final colors, typography, spacing and interactions are all
specified below and in the HTML. Recreate pixel-faithfully. The visual direction is a
light, editorial résumé style: warm cream paper, near-black ink, a single green
accent, heavy friendly grotesk display type, thin rules, and bordered uppercase
"box" labels.

---

## Design Tokens

### Colors
| Token        | Hex       | Usage |
|--------------|-----------|-------|
| `--ink`      | `#1d1d1a` | Primary text, big headings, borders, box labels |
| `--soft`     | `#3a3833` | Body copy, secondary text |
| `--muted`    | `#6f6c63` | Org names, dates-as-labels, footer |
| `--faint`    | `#9a978c` | (reserved / faint text) |
| `--line`     | `#d7d3c7` | Hairlines (index list, stronger dividers) |
| `--line-soft`| `#e6e2d7` | Hairlines between CV rows |
| `--paper`    | `#f5f2ea` | Page background (warm cream) |
| `--bg`       | `#e3e0d6` | Workspace background behind pages (screen only) |
| `--green`    | `#2e7d50` | **Accent**: square logo mark, heading periods, bullets, dates, E:/P: labels, index numbers, links, primary button |
| `--green-deep`| `#225f3c`| Accent hover |
| `--chip`     | `#ebe7dc` | Empty photo-frame fill |

The accent green is intentionally used sparingly and consistently across all 3 pages.

### Typography
- **Single family:** `Plus Jakarta Sans` (Google Fonts), weights 400/500/600/700/800
  (+ italic 400/500). Used for everything (display + body) for a friendly, cohesive feel.
- Fallback stack: `"Plus Jakarta Sans", system-ui, sans-serif`.

| Role | Size | Weight | Tracking / line-height | Notes |
|------|------|--------|------------------------|-------|
| Big display name / cover title (`.big`) | 34pt | 800 | `-0.03em`, lh .94 | green full-stop appended via `.dot` |
| Section heading main column (`.h-big`) | 14pt | 800 | `-0.02em` | green `.dot` period |
| Letter subject (`.l-subject`) | 13.5pt | 800 | `-0.015em`, lh 1.3 | |
| Box label (`.boxlabel`) | 8pt | 800 | `+0.14em`, UPPERCASE | 1.5px solid `--ink` border, padding 1.7mm 3.2mm |
| Tag / brand (`.tag`) | 9pt | 800 | `+0.14em`, UPPERCASE | preceded by 9×9px green square |
| Role rule label (`.rule-row .role`) | 9pt | 700 | `+0.15em`, UPPERCASE | |
| Body paragraph (`.body`) | 10pt | 400 | lh 1.46, color `--soft` | |
| CV role (`.role`) | 10pt | 700 | lh 1.25 | |
| CV org (`.org`) | 8.8pt | 400 | lh 1.3, color `--muted` | |
| CV date (`.when`) | 8.2pt | 700 | color `--green` | |
| Sidebar value (`.s-v`) | 9.6pt | 400 | lh 1.38 | |
| Sidebar key (`.s-k`) | 7.6pt | 800 | `+0.1em`, UPPERCASE, green | |
| Task bullets (`.tasks li`) | 8.4pt | 400 | lh 1.28, 2 columns | green `•` |
| Contact block (`.hd-addr`) | 8.6pt | 400 | lh 1.5; `E:`/`P:` labels green/800 | right-aligned |

### Spacing & layout constants
- Page: `width: 210mm; height: 297mm;` fixed, `overflow: hidden`, `padding: 15mm` (`--pad`) on all sides → identical margins on every page.
- Column gap (`--gap`): `10mm`.
- Cover grid columns: `1fr 60mm` (content / photo). Photo aspect `3 / 4` (≈ 60×80mm).
- CV grid columns: `58mm 1fr` (sidebar / main). Sidebar photo aspect `5 / 6` (≈ 58×69.6mm).
- Big rule (`.rule-row`): a 14mm `2px` ink segment, the role label, then a flexible `2px` ink rule filling the row.
- CV row: `grid-template-columns: 25mm 1fr; gap: 5mm; padding: 1mm 0;` divided by `1px` `--line-soft` top borders (first row no border).
- CV footer: `border-top: 2px solid --ink`, space-between, signature in 12.5pt/800.

### Borders / shapes
- No rounded corners on document elements (sharp, editorial). Box labels & photo frames use **1.5px solid `--ink`**.
- Green square logo mark: 9×9px solid `--green`, no radius.
- Screen-only page shadow: `0 2px 10px rgba(29,29,26,.08), 0 18px 50px rgba(29,29,26,.13)` (removed in print).

---

## Screens / Views

### 1. Deckblatt (cover)
- **Purpose:** Title page introducing the application package.
- **Layout:** Column flex. Shared header (tag left + contact right, big "Bewerbung."
  title with green period, role rule). Below: 2-col grid (`1fr 60mm`).
  - **Left:** three bordered box labels — "Worum es geht" (intro paragraph),
    "Zeitraum" (date range), "Inhalt" (numbered index list 01–04: Anschreiben,
    Lebenslauf, Zeugnisse, Zertifikate, with green numbers and `--line` dividers).
  - **Right:** portrait photo frame (3:4) then name + address + phone beneath.

### 2. Anschreiben (cover letter)
- **Purpose:** Formal letter to the recipient (Gemeinde Weichering, Herr Thomas Mack).
- **Layout:** Shared header (tag "Anschreiben", contact, big name "Melanie Kerner.",
  role rule). Then: recipient block (left, with a "Empfänger" box label) + date
  (right); bold subject line; salutation; 5 body paragraphs (left-aligned, **not**
  justified); closing ("Mit freundlichen Grüßen") + signature name in display weight.

### 3. Lebenslauf (CV)
- **Purpose:** Résumé.
- **Layout:** Shared header (tag "Lebenslauf", contact, big name, role rule). Then a
  2-col grid (`58mm 1fr`):
  - **Sidebar (left):** portrait photo (5:6); box-labelled sections "Kontakt"
    (Adresse/Telefon/Mobil/E-Mail with green uppercase keys), "Persönliche Daten"
    (Geboren/Familie/Staatsangeh.), "Stärken" (green-square bullet list, 5 items).
  - **Main (right):** "Beruflicher Werdegang." heading; 8 timeline rows
    (date | role + org), the NKD entry has a 2-column green-bullet task list;
    "Kenntnisse." heading; 4 rows (EDV / Sprachen / Führerschein / Weiterbildung);
    footer with place+date and signature.

(Exact copy for every field lives in the HTML, keyed by `data-k` attributes.)

---

## Interactions & Behavior
- **Edit toggle** (`#btnEdit`): flips `document.body.classList` `editing` and sets
  `contentEditable` on every `[data-k]` element. In edit mode elements get a dashed
  green outline on hover/focus. Button label toggles "✎ Bearbeiten" ⇄ "✓ Fertig".
- **Persistence:** on every `input` inside a `[data-k]`, the full set of
  `el.innerHTML` is serialized to `localStorage` under key `bewerbung-edits-v3` and
  re-hydrated on load. (In a real app, replace with your data layer / form state.)
- **PDF** (`#btnPdf`): exits edit mode, then `window.print()`. Print CSS sets `@page
  { size: A4; margin: 0 }`, hides the toolbar/hint, removes shadows and forces a page
  break after each `.page`.
- **Photo slots:** `<image-slot>` web component (drag-and-drop an image; double-click
  to reframe/zoom; persists to a sidecar JSON). In a real app, replace with your
  normal file-upload + crop component. Slot ids: `foto-deckblatt`, `foto-lebenslauf`.
- No routing/animation beyond the above. Toolbar + hint are screen-only.

## State Management
- `editing: boolean` — drives edit mode.
- Field contents — currently `localStorage`; in production these are the document's
  data model (one object per applicant with the fields listed in the HTML `data-k`s).
- Photo images — currently the image-slot sidecar; in production, uploaded asset URLs.

## Assets
- **Fonts:** Plus Jakarta Sans via Google Fonts (`<link>` in `<head>`).
- **Images:** none shipped — two user-supplied portrait photos go in the photo frames.
- **`image-slot.js`:** helper web component for the drag-drop photo placeholders
  (prototype only; swap for your own uploader).
- No icon set; the only "icon" is a CSS green square.

## Files
- `Bewerbungsmappe Melanie Kerner.html` — the full prototype (all three pages + styles + edit/PDF script). All styling is in the single `<style>` block; all copy is inline, keyed with `data-k`.
- `image-slot.js` — photo-placeholder web component used by the prototype.
- `Bewerbungsmappe klassisch.html` *(optional, in `/archiv`)* — earlier navy/serif version, kept for reference only. **Not** the target design.

## Notes for re-implementation
- Keep the **one-page-per-document** guarantee — it's the main fragility. The current
  font sizes/margins are tuned so each page's content is exactly ≤ 297mm tall.
- Prefer real form fields / a data model over `contentEditable` for production.
- For server-side PDF, the same HTML/CSS works under Puppeteer or WeasyPrint with the
  existing `@page` rules; load Plus Jakarta Sans locally for reliable rendering.
