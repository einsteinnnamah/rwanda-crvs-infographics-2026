# Rwanda Vital Statistics (2019–2025): Who Gets Counted?

> **NISR 2026 Infographic Competition Submission**  
> *Topic: Rwanda Vital Statistics (2019–2025)*  
> *Organized by the National Institute of Statistics of Rwanda (NISR)*

---

## 📌 Executive Summary

Rwanda achieves remarkable coverage in recording births—capturing **92.9%** in 2025 through near-universal health facility deliveries. However, when citizens pass away, **only 50.5%** of expected deaths are registered in the year they occur.

This repository hosts **both the dynamic and static infographics** created for the 2026 NISR Infographic Competition, translating official statistics from the *Rwanda Vital Statistics Report 2025* into an evidence-based, interactive data story.

### 🌟 Key Findings
1. **The Recording Gap:** In 2025, 39,355 deaths were registered out of 77,876 expected deaths, leaving **38,521 unrecorded deaths (49.5%)**.
2. **The Missing Women Disparity:** Male death registration completeness reached **57.6%**, while female completeness lagged at **43.7%** (a 13.9 percentage-point gap). **57.9% of all unrecorded deaths in Rwanda are women (22,310 women)**, driven by property and land inheritance norms that primarily necessitate death certificates for male heads of household.
3. **Place of Death:** **55.9%** of deaths occur in the community and **44.1%** in health facilities. In rural districts like Muhanga (67.2%) and Nyaruguru (66.0%), two out of three deaths occur at home.
4. **Historical Backlog:** Of 57,067 deaths recorded in the CRVS system in 2025, **17,712 (31.0%)** occurred in earlier years, reflecting nationwide mop-up campaigns.
5. **Cause of Death Divide:** Noncommunicable Diseases (NCDs) represent **58.8%** of community deaths compared to **49.5%** in health facilities, whereas communicable diseases are more frequently captured in facilities (40.0% vs. 26.9%).

---

## 🚀 Live Demo & Interactive Application

* **Dynamic Infographic (Web App):** Open `index.html` in any modern web browser or visit the deployed GitHub Pages site. No build step.
  * A nine-chapter scroll story in an editorial "paper and ink" system (Instrument Serif figures, Inter Tight text, Space Mono labels, one brick-red accent).
  * **Chapters:**
    1. *Seven years on the record* — pinned horizontal timeline, one panel per year, with a ruler that tracks scroll position (GSAP ScrollTrigger; vertical fallback on phones and for reduced motion)
    2. *The ones not counted* — a 7,788-dot field (one dot = ten expected deaths) where 3,852 dots fade to outlines as you scroll
    3. *The missing women* — hand-drawn expected-vs-registered bars by sex (rough.js)
    4. *Where people die* — hand-drawn pie plus a hand-drawn SVG map of the 30 districts (hatch density and colour encode the community share) linked to a district inspector, a ranked strip of all 30 districts, and the extremes table
    5. *The backlog and the clock* — in-year vs earlier-year registrations, and the timeliness reversal
    6. *Who appears in the record* — age bands with a companion table that sums to 100.0%
    7. *What the record says they died of* — facility vs community cause pies
    8. *Three drivers, one gap* — relationship diagram linking place, sex and time to the 38,521
    9. *Now close the gap* — interactive 2030 policy simulator
  * Every chart has a hover tooltip and a text or table equivalent; `prefers-reduced-motion` is honoured throughout.
  * **Dark mode by default**, with a light toggle in the top bar (persisted). Charts, map and dot field re-render from CSS tokens on switch.
  * **Three languages:** English, French and Kinyarwanda (EN / FR / RW in the top bar, or `?lang=fr`). Dictionary in `i18n.js`, keyed by the English source text. *The Kinyarwanda copy should be proofread by a native speaker before submission.*
  * **Paged reader:** the cover (hero + key findings) and each chapter are separate pages. Only one is visible at a time; you move with the previous / next cards that close every chapter, the Chapters index, the ← → keys, or a `#ch-0N` hash. The top bar shows `0N / 09` plus the current chapter title.
  * **Motion:** GSAP ScrollSmoother (desktop only; native scroll on touch and with reduced motion) with parallax on hero figures; chapter titles rise in word by word; every rough.js chart sketches itself in stroke by stroke on entry; figures count up; table rows and cards stagger; timeline panels animate as the ruler advances.
* **Static Poster (Print-Ready):** [`static-poster/poster.html`](static-poster/poster.html)
  * A true A3 portrait sheet (`@page { size: A3 }`) in the same visual system, with fixed-seed hand-drawn charts so every PDF export is identical.
  * Export: open in Chrome, click **Print or save as PDF**, choose A3 portrait, margins none, background graphics on.

---

## 📁 Repository Structure

```text
rwanda-crvs-infographics-2026/
├── index.html              # Dynamic Infographic web application
├── styles.css              # Editorial design system (paper/ink tokens, chapters, timeline, reveal)
├── app.js                  # rough.js charts and map, GSAP paging + motion, simulator, theme + i18n
├── i18n.js                 # French and Kinyarwanda translations keyed by English text
├── data.js                 # Cleaned dataset with 30-district GeoJSON & CRVS metrics
├── DATA_AUDIT_REPORT.md    # Full data validation dossier against NISR source tables
├── README.md               # Project documentation
├── .claude/skills/         # Design and motion craft skills used while building the UI
└── static-poster/
    └── poster.html         # A3 print-ready static poster (self-contained)
```

---

## 📊 Data Source & Verification

All figures and indicators are strictly validated against official publications from the **National Institute of Statistics of Rwanda (NISR)**:
* **Primary Source:** *Rwanda Vital Statistics Report 2025* (`Final Tables_CRVS_2025_0.xlsx`)
  * Tables 11, 12, 14, 15, 16; Figures 16, 17, 18, 19, 21, 23, 24, 25; Tables 10.5, 10.6, 10.9.
* **Geographic Boundaries:** Rwanda ADM2 GeoJSON (`geoBoundaries-RWA-ADM2_simplified.geojson`), drawn as inline SVG.

Detailed verification formulas and reconciliation tables are available in [DATA_AUDIT_REPORT.md](DATA_AUDIT_REPORT.md).

---

## 👥 Authors

* **Team Shujazz**
* Compliant with NISR competition regulations (Teams of two enrolled university students).
