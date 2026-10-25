/**
 * Rwanda CRVS 2026 Dynamic Infographic Application
 * Validated against NISR Final Tables_CRVS_2025_0.xlsx
 */

document.addEventListener('DOMContentLoaded', () => {
  const data = window.RWANDA_CRVS_DATA;
  if (!data) {
    console.error('Data not loaded');
    return;
  }

  // --- 1. Tab Switching Controller ---
  const tabBtns = document.querySelectorAll('.tab-btn');
  const panels = document.querySelectorAll('.story-panel');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      panels.forEach(p => p.classList.remove('active'));

      btn.classList.add('active');
      const targetId = btn.getAttribute('data-tab');
      const targetPanel = document.getElementById(targetId);
      if (targetPanel) {
        targetPanel.classList.add('active');
        // Trigger resize for Leaflet or Chart.js if needed
        window.dispatchEvent(new Event('resize'));
        if (targetId === 'tab-map' && window.rwandaMap) {
          setTimeout(() => window.rwandaMap.invalidateSize(), 100);
        }
      }
    });
  });

  // --- 2. Leaflet Choropleth Map of 30 Districts ---
  initChoroplethMap(data);

  // --- 3. Chart.js Visualizations ---
  initCharts(data);

  // --- 4. Interactive Policy Simulator ---
  initPolicySimulator();
});

/**
 * Initialize Rwanda 30-District Choropleth Map using Leaflet
 */
function initChoroplethMap(data) {
  const mapElement = document.getElementById('rwanda-map');
  if (!mapElement) return;

  // Center on Rwanda [-1.9403, 29.8739]
  const map = L.map('rwanda-map', {
    zoomSnap: 0.25,
    attributionControl: false,
    zoomControl: true,
    scrollWheelZoom: false
  }).setView([-1.95, 29.87], 8.5);

  window.rwandaMap = map;

  // Color Scale based on Community Death Share %
  function getColor(pct) {
    return pct >= 60.0 ? '#b91c1c' :
           pct >= 50.0 ? '#ea580c' :
           pct >= 40.0 ? '#eab308' :
                         '#0284c7';
  }

  function style(feature) {
    const commPct = feature.properties.community_pct || 50;
    return {
      fillColor: getColor(commPct),
      weight: 1.5,
      opacity: 1,
      color: '#ffffff',
      dashArray: '',
      fillOpacity: 0.85
    };
  }

  let geojsonLayer;

  function highlightFeature(e) {
    const layer = e.target;
    layer.setStyle({
      weight: 3,
      color: '#0f172a',
      dashArray: '',
      fillOpacity: 0.95
    });
    layer.bringToFront();
    updateInspector(layer.feature.properties);
  }

  function resetHighlight(e) {
    geojsonLayer.resetStyle(e.target);
  }

  function onEachFeature(feature, layer) {
    layer.on({
      mouseover: highlightFeature,
      mouseout: resetHighlight,
      click: highlightFeature
    });
  }

  geojsonLayer = L.geoJson(data.geoJSON, {
    style: style,
    onEachFeature: onEachFeature
  }).addTo(map);

  // Fit bounds to Rwanda
  map.fitBounds(geojsonLayer.getBounds(), { padding: [10, 10] });

  // Default selection: Muhanga
  const muhanga = data.districtData['Muhanga'];
  if (muhanga) updateInspector(muhanga);
}

/**
 * Update the District Inspector Card when a user clicks/hovers a district
 */
function updateInspector(d) {
  if (!d) return;

  document.getElementById('insp-name').textContent = d.district + ' District';
  document.getElementById('insp-province').textContent = d.province + ' Province';
  document.getElementById('insp-type').textContent = (d.type ? d.type.toUpperCase() : 'DISTRICT');

  document.getElementById('insp-comm-pct').textContent = d.community_pct + '%';
  document.getElementById('insp-comm-count').textContent = '(' + (d.community || 0).toLocaleString() + ' deaths)';
  
  document.getElementById('insp-fac-pct').textContent = d.facility_pct + '%';
  document.getElementById('insp-fac-count').textContent = '(' + (d.facility || 0).toLocaleString() + ' deaths)';

  document.getElementById('insp-total').textContent = (d.total || 0).toLocaleString();

  // Rank determination
  const dList = Object.values(window.RWANDA_CRVS_DATA.districtData);
  dList.sort((a, b) => b.community_pct - a.community_pct);
  const rank = dList.findIndex(x => x.district === d.district) + 1;
  document.getElementById('insp-rank').textContent = '#' + rank + ' of 30 Districts';

  // Bar tracks
  document.getElementById('insp-bar-fill').style.width = Math.min(100, d.community_pct) + '%';
  document.getElementById('insp-bar-fac').style.width = Math.min(100, d.facility_pct) + '%';

  // Dynamic Contextual Takeaway
  const takeaway = document.getElementById('insp-takeaway');
  if (d.community_pct >= 60) {
    takeaway.textContent = `Over 6 in 10 deaths in ${d.district} occur in the community. Without active Community Health Worker (CHW) reporting, these home deaths risk never reaching the civil registry.`;
  } else if (d.community_pct <= 40) {
    takeaway.textContent = `${d.district} has a high concentration of hospitals and clinics, where 60%+ of deaths occur and are directly logged into CRVS at the facility bedside.`;
  } else {
    takeaway.textContent = `In ${d.district}, deaths are nearly evenly split between home (${d.community_pct}%) and health facilities (${d.facility_pct}%). Dual reporting channels are vital here.`;
  }
}

/**
 * Initialize all Chart.js Visualizations
 */
function initCharts(data) {
  // Chart font settings
  Chart.defaults.font.family = "'Plus Jakarta Sans', sans-serif";
  Chart.defaults.font.size = 12;
  Chart.defaults.color = '#475569';

  // --- Chart 1: The Missing Women Donut Chart ---
  const ctxMissing = document.getElementById('missingWomenChart');
  if (ctxMissing) {
    new Chart(ctxMissing, {
      type: 'doughnut',
      data: {
        labels: ['Missing Women (57.9%)', 'Missing Men (42.1%)'],
        datasets: [{
          data: [22310, 16211],
          backgroundColor: ['#db2777', '#2563eb'],
          hoverOffset: 6,
          borderWidth: 2,
          borderColor: '#ffffff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: function(context) {
                const val = context.raw || 0;
                const total = 38521;
                const pct = ((val / total) * 100).toFixed(1);
                return ` ${context.label}: ${val.toLocaleString()} (${pct}%)`;
              }
            }
          }
        },
        cutout: '68%'
      }
    });
  }

  // --- Chart 2: 2019-2025 Trend Chart ---
  const ctxTrend = document.getElementById('trendChart');
  if (ctxTrend) {
    const ts = data.timeSeriesCompleteness;
    new Chart(ctxTrend, {
      type: 'line',
      data: {
        labels: ts.map(t => t.year),
        datasets: [
          {
            label: 'Birth Completeness (%)',
            data: ts.map(t => t.birth),
            borderColor: '#0284c7',
            backgroundColor: '#0284c7',
            tension: 0.3,
            borderWidth: 2.5,
            pointRadius: 4
          },
          {
            label: 'Total Death Completeness (%)',
            data: ts.map(t => t.death),
            borderColor: '#ea580c',
            backgroundColor: '#ea580c',
            tension: 0.3,
            borderWidth: 3,
            pointRadius: 5
          },
          {
            label: 'Male Death Completeness (%)',
            data: ts.map(t => t.maleDeath),
            borderColor: '#2563eb',
            borderDash: [5, 5],
            tension: 0.3,
            borderWidth: 1.5,
            pointRadius: 3
          },
          {
            label: 'Female Death Completeness (%)',
            data: ts.map(t => t.femaleDeath),
            borderColor: '#db2777',
            borderDash: [5, 5],
            tension: 0.3,
            borderWidth: 1.5,
            pointRadius: 3
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top', labels: { boxWidth: 12, usePointStyle: true } }
        },
        scales: {
          y: {
            min: 0,
            max: 100,
            ticks: { callback: v => v + '%' },
            grid: { color: '#f1f5f9' }
          },
          x: {
            grid: { display: false }
          }
        }
      }
    });
  }

  // --- Chart 3: Age-Sex Pyramid ---
  const ctxPyramid = document.getElementById('pyramidChart');
  if (ctxPyramid) {
    const ages = data.ageSexData2025;
    new Chart(ctxPyramid, {
      type: 'bar',
      data: {
        labels: ages.map(a => a.age),
        datasets: [
          {
            label: 'Male Deaths',
            data: ages.map(a => a.male),
            backgroundColor: '#2563eb',
            borderRadius: 4
          },
          {
            label: 'Female Deaths',
            data: ages.map(a => a.female),
            backgroundColor: '#db2777',
            borderRadius: 4
          }
        ]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top' },
          tooltip: {
            callbacks: {
              afterBody: function(items) {
                const idx = items[0].dataIndex;
                const total = ages[idx].total;
                const pct = ages[idx].pct;
                return `Total cohort: ${total.toLocaleString()} (${pct}%)`;
              }
            }
          }
        },
        scales: {
          x: {
            stacked: true,
            grid: { color: '#f1f5f9' },
            ticks: { callback: v => v.toLocaleString() }
          },
          y: {
            stacked: true,
            grid: { display: false }
          }
        }
      }
    });
  }

  // --- Chart 4: Cause of Death Grouped Bar ---
  const ctxCause = document.getElementById('causeChart');
  if (ctxCause) {
    new Chart(ctxCause, {
      type: 'bar',
      data: {
        labels: [
          'Noncommunicable Diseases (NCDs)',
          'Communicable, Maternal & Perinatal',
          'Injuries & External Causes'
        ],
        datasets: [
          {
            label: 'Health Facility Deaths (%)',
            data: [49.5, 40.0, 10.5],
            backgroundColor: '#0284c7',
            borderRadius: 6
          },
          {
            label: 'Community / Home Deaths (%)',
            data: [58.8, 26.9, 14.3],
            backgroundColor: '#ea580c',
            borderRadius: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top' },
          tooltip: {
            callbacks: {
              label: c => ` ${c.dataset.label}: ${c.raw}%`
            }
          }
        },
        scales: {
          y: {
            min: 0,
            max: 70,
            ticks: { callback: v => v + '%' },
            grid: { color: '#f1f5f9' }
          },
          x: {
            grid: { display: false }
          }
        }
      }
    });
  }
}

/**
 * Interactive 2030 Policy Simulator
 */
function initPolicySimulator() {
  const sliderChw = document.getElementById('slider-chw');
  const sliderFemale = document.getElementById('slider-female');
  const sliderKiosk = document.getElementById('slider-kiosk');

  const valChw = document.getElementById('val-chw');
  const valFemale = document.getElementById('val-female');
  const valKiosk = document.getElementById('val-kiosk');

  const projResult = document.getElementById('proj-result');
  const scProj = document.getElementById('sc-proj');

  function updateSim() {
    const chw = parseInt(sliderChw.value, 10) || 0;
    const female = parseInt(sliderFemale.value, 10) || 0;
    const kiosk = parseInt(sliderKiosk.value, 10) || 0;

    valChw.textContent = '+' + chw + '%';
    valFemale.textContent = '+' + female + '%';
    valKiosk.textContent = '+' + kiosk + '%';

    // Baseline 2025: 50.5%
    // Organic growth trajectory to 2030: +16.5% (reaching ~67%)
    // Policy levers add incremental lift:
    const baseline = 50.5;
    const trendLift = 16.5; // reaches 67% without intervention
    const interventionLift = (chw * 0.8) + (female * 0.9) + (kiosk * 0.7);

    const projected = Math.min(96.0, baseline + trendLift + interventionLift).toFixed(1);

    projResult.textContent = projected + '%';
    scProj.textContent = projected + '%';

    if (projected >= 80.0) {
      projResult.style.color = '#4ade80'; // Target achieved!
    } else {
      projResult.style.color = '#38bdf8';
    }
  }

  [sliderChw, sliderFemale, sliderKiosk].forEach(s => {
    if (s) s.addEventListener('input', updateSim);
  });

  updateSim();
}
