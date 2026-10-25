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

* **Dynamic Infographic (Web App):** Open `index.html` in any modern web browser or visit the deployed GitHub Pages site.
  * **Features:**
    * Interactive 30-District Choropleth Map of Rwanda (Leaflet.js + ADM2 GeoJSON)
    * The Missing Women Demographic Explorer
    * Historical Completeness Trajectory (2019–2025)
    * Age-Sex Demographic Pyramid (100% verified math across 17 cohorts)
    * Facility vs. Community Cause of Death Breakdown
    * Interactive 2030 Policy Target Simulator
* **Static Poster (Print-Ready):** [`static-poster/poster.html`](static-poster/poster.html)
  * Vector typography and high-contrast analytical design pre-formatted for 300-DPI A3 / Poster PDF export.

---

## 📁 Repository Structure

```text
rwanda-crvs-infographics-2026/
├── index.html              # Dynamic Infographic web application
├── styles.css              # Custom responsive design system (WCAG AAA compliant)
├── app.js                  # Interactive controllers, Leaflet map, and Chart.js logic
├── data.js                 # Cleaned dataset with 30-district GeoJSON & CRVS metrics
├── DATA_AUDIT_REPORT.md    # Full data validation dossier against NISR source tables
├── README.md               # Project documentation
└── static-poster/
    └── poster.html         # High-resolution print-ready static poster
```

---

## 📊 Data Source & Verification

All figures and indicators are strictly validated against official publications from the **National Institute of Statistics of Rwanda (NISR)**:
* **Primary Source:** *Rwanda Vital Statistics Report 2025* (`Final Tables_CRVS_2025_0.xlsx`)
  * Tables 11, 12, 14, 15, 16; Figures 16, 17, 18, 19, 21, 23, 24, 25; Tables 10.5, 10.6, 10.9.
* **Geographic Boundaries:** Rwanda ADM2 GeoJSON (`geoBoundaries-RWA-ADM2_simplified.geojson`).

Detailed verification formulas and reconciliation tables are available in [DATA_AUDIT_REPORT.md](DATA_AUDIT_REPORT.md).

---

## 👥 Authors

* **Team Shujazz**
* Compliant with NISR competition regulations (Teams of two enrolled university students).
