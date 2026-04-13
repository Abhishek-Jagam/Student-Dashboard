/**
 * =============================================
 *  Student Performance Dashboard — script.js
 *  Fixed version — handles quoted CSV fields,
 *  real column names from combined data.csv
 * =============================================
 */

// -----------------------------------------------
// GLOBAL STATE
// -----------------------------------------------
let allData      = [];
let filteredData = [];

let chartCity     = null;
let chartSchool   = null;
let chartRank     = null;
let chartStandard = null;

let sortColumn = '';
let sortAsc    = true;

// -----------------------------------------------
// 1. CSV PARSER  ← KEY FIX: handles quoted fields
//    e.g.  "School Of Scholars, Kaulkhed, Akola"
// -----------------------------------------------
function parseCSV(text) {
  const lines = text.trim().split('\n');

  function parseLine(line) {
    const result = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
        else { inQuotes = !inQuotes; }
      } else if (ch === ',' && !inQuotes) {
        result.push(cur.trim());
        cur = '';
      } else {
        cur += ch;
      }
    }
    result.push(cur.trim());
    return result;
  }

  const headers = parseLine(lines[0]);
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const values = parseLine(line);
    const row = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] !== undefined ? values[idx] : '';
    });

    row['Score']       = parseFloat(row['Score'])       || 0;
    row['Rank']        = parseFloat(row['Rank'])         || 0;
    row['School Rank'] = parseFloat(row['School Rank'])  || 0;
    row['Standard']    = row['Standard'] ? row['Standard'].toString() : '';
    row['Year']        = row['Year']     ? row['Year'].toString()     : '';

    rows.push(row);
  }
  return rows;
}

// -----------------------------------------------
// 2. LOAD CSV FILE
// -----------------------------------------------
async function loadCSV() {
  try {
    const response = await fetch('data.csv');
    if (!response.ok) throw new Error('Could not load data.csv');
    const text = await response.text();
    allData      = parseCSV(text);
    filteredData = [...allData];
    populateFilters();
    updateAll();
    hideLoading();
  } catch (err) {
    console.error('Error loading CSV:', err);
    document.getElementById('loadingOverlay').innerHTML =
      `<p style="color:#e03131;font-family:sans-serif;padding:20px">
         ⚠️ Could not load data.csv.<br>
         Make sure it is in the same folder as index.html<br>
         and you are serving via a local server (e.g. VS Code Live Server).
       </p>`;
  }
}

// -----------------------------------------------
// 3. POPULATE FILTER DROPDOWNS
// -----------------------------------------------
function populateFilters() {
  const cities    = [...new Set(allData.map(r => r['School City']))].filter(Boolean).sort();
  const standards = [...new Set(allData.map(r => r['Standard']))].filter(Boolean).sort((a, b) => +a - +b);
  const years     = [...new Set(allData.map(r => r['Year']))].filter(Boolean).sort().reverse();

  fillSelect('filterCity',     cities,    'All Cities');
  fillSelect('filterStandard', standards, 'All Standards');
  fillSelect('filterYear',     years,     'All Years');
}

function fillSelect(id, values, placeholder) {
  const sel = document.getElementById(id);
  sel.innerHTML = `<option value="">${placeholder}</option>`;
  values.forEach(v => {
    const opt = document.createElement('option');
    opt.value       = v;
    opt.textContent = v;
    sel.appendChild(opt);
  });
}

// -----------------------------------------------
// 4. FILTER DATA
// -----------------------------------------------
function filterData() {
  const city     = document.getElementById('filterCity').value;
  const standard = document.getElementById('filterStandard').value;
  const year     = document.getElementById('filterYear').value;

  filteredData = allData.filter(row => {
    const matchCity  = !city     || row['School City'] === city;
    const matchStd   = !standard || row['Standard']    === standard;
    const matchYear  = !year     || row['Year']        === year;
    return matchCity && matchStd && matchYear;
  });
}

// -----------------------------------------------
// 5. CALCULATE METRICS
// -----------------------------------------------
function calculateMetrics(data) {
  if (!data.length) return { total: 0, avgScore: '0.0', topScore: 0, totalSchools: 0 };

  const total        = data.length;
  const avgScore     = (data.reduce((s, r) => s + r['Score'], 0) / total).toFixed(1);
  const topScore     = Math.max(...data.map(r => r['Score']));
  const totalSchools = new Set(data.map(r => r['School Name'])).size;

  return { total, avgScore, topScore, totalSchools };
}

function updateKPIs(metrics) {
  document.getElementById('kpiStudents').textContent = metrics.total.toLocaleString();
  document.getElementById('kpiAvgScore').textContent = metrics.avgScore;
  document.getElementById('kpiTopScore').textContent = metrics.topScore;
  document.getElementById('kpiSchools').textContent  = metrics.totalSchools;
}

// -----------------------------------------------
// 6. CHART HELPERS
// -----------------------------------------------
function destroyChart(instance) {
  if (instance) instance.destroy();
  return null;
}

function palette(n, alpha = 0.85) {
  const base = [
    `rgba(59,91,219,${alpha})`,
    `rgba(112,72,232,${alpha})`,
    `rgba(116,143,252,${alpha})`,
    `rgba(247,103,7,${alpha})`,
    `rgba(47,158,68,${alpha})`,
    `rgba(230,73,128,${alpha})`,
    `rgba(23,162,184,${alpha})`,
    `rgba(255,169,77,${alpha})`,
  ];
  return Array.from({ length: n }, (_, i) => base[i % base.length]);
}

function setChartDefaults() {
  Chart.defaults.font.family = "'DM Sans', sans-serif";
  Chart.defaults.font.size   = 12;
  Chart.defaults.color       = '#5c6080';
  Chart.defaults.plugins.legend.labels.boxWidth = 12;
  Chart.defaults.plugins.legend.labels.padding  = 16;
}

function avgArr(arr) {
  if (!arr.length) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function barOptions(maxY = 100) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#1a1d2e',
        padding: 10,
        titleFont: { weight: '600', family: "'Sora', sans-serif" },
        callbacks: { label: ctx => ` Score: ${ctx.raw}` }
      }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { maxRotation: 30, font: { size: 11 } }
      },
      y: {
        beginAtZero: true,
        max: maxY,
        grid: { color: 'rgba(0,0,0,0.04)' },
        ticks: { font: { size: 11 } }
      }
    }
  };
}

// -----------------------------------------------
// 7. UPDATE CHARTS
// -----------------------------------------------
function updateCharts(data) {

  // Chart 1: Avg Score by City
  const cityMap = {};
  data.forEach(r => {
    const c = r['School City'];
    if (!c) return;
    if (!cityMap[c]) cityMap[c] = [];
    cityMap[c].push(r['Score']);
  });
  const cityLabels = Object.keys(cityMap).sort();
  const cityAvgs   = cityLabels.map(c => +avgArr(cityMap[c]).toFixed(1));

  chartCity = destroyChart(chartCity);
  chartCity = new Chart(document.getElementById('chartCity'), {
    type: 'bar',
    data: {
      labels: cityLabels,
      datasets: [{
        label: 'Avg Score',
        data: cityAvgs,
        backgroundColor: palette(cityLabels.length, 0.8),
        borderRadius: 6,
        borderSkipped: false,
      }]
    },
    options: barOptions(100)
  });

  // Chart 2: Top 10 Schools by Avg Score
  const schoolMap = {};
  data.forEach(r => {
    const s = r['School Name'];
    if (!s) return;
    if (!schoolMap[s]) schoolMap[s] = [];
    schoolMap[s].push(r['Score']);
  });
  const schoolEntries = Object.entries(schoolMap)
    .map(([name, scores]) => ({ name, avg: avgArr(scores) }))
    .sort((a, b) => b.avg - a.avg)
    .slice(0, 10);

  chartSchool = destroyChart(chartSchool);
  chartSchool = new Chart(document.getElementById('chartSchool'), {
    type: 'bar',
    data: {
      labels: schoolEntries.map(e => e.name),
      datasets: [{
        label: 'Avg Score',
        data: schoolEntries.map(e => +e.avg.toFixed(1)),
        backgroundColor: palette(schoolEntries.length, 0.82),
        borderRadius: 6,
        borderSkipped: false,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: 'y',
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1a1d2e',
          callbacks: { label: ctx => ` Avg Score: ${ctx.raw}` }
        }
      },
      scales: {
        x: {
          beginAtZero: true, max: 100,
          grid: { color: 'rgba(0,0,0,0.04)' },
          ticks: { font: { size: 11 } }
        },
        y: {
          grid: { display: false },
          ticks: {
            font: { size: 10 },
            callback: function(val) {
              const label = this.getLabelForValue(val);
              return label.length > 25 ? label.slice(0, 24) + '…' : label;
            }
          }
        }
      }
    }
  });

  // Chart 3: Achievement Distribution
  const achvMap = {};
  data.forEach(r => {
    const a = r['Achievement'] || 'Participant';
    achvMap[a] = (achvMap[a] || 0) + 1;
  });
  const achvLabels = Object.keys(achvMap);
  const achvCounts = Object.values(achvMap);

  chartRank = destroyChart(chartRank);
  chartRank = new Chart(document.getElementById('chartRank'), {
    type: 'doughnut',
    data: {
      labels: achvLabels,
      datasets: [{
        data: achvCounts,
        backgroundColor: palette(achvLabels.length, 0.88),
        borderWidth: 2,
        borderColor: '#fff',
        hoverOffset: 8,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '62%',
      plugins: {
        legend: { position: 'bottom', labels: { font: { size: 10 } } },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.label}: ${ctx.raw.toLocaleString()} students`
          }
        }
      }
    }
  });

  // Chart 4: Standard-wise Avg Score
  const stdMap = {};
  data.forEach(r => {
    const s = r['Standard'];
    if (!s) return;
    if (!stdMap[s]) stdMap[s] = [];
    stdMap[s].push(r['Score']);
  });
  const stdLabels = Object.keys(stdMap).sort((a, b) => +a - +b);
  const stdAvgs   = stdLabels.map(s => +avgArr(stdMap[s]).toFixed(1));

  chartStandard = destroyChart(chartStandard);
  chartStandard = new Chart(document.getElementById('chartStandard'), {
    type: 'bar',
    data: {
      labels: stdLabels.map(s => `Std ${s}`),
      datasets: [{
        label: 'Avg Score',
        data: stdAvgs,
        backgroundColor: palette(stdLabels.length, 0.8),
        borderRadius: 6,
        borderSkipped: false,
      }]
    },
    options: barOptions(100)
  });
}

// -----------------------------------------------
// 8. UPDATE TABLE (max 500 rows for performance)
// -----------------------------------------------
function updateTable(data) {
  const searchVal = document.getElementById('tableSearch').value.trim().toLowerCase();

  let rows = data.filter(row => {
    if (!searchVal) return true;
    return (
      (row['School Name'] || '').toLowerCase().includes(searchVal) ||
      (row['School City'] || '').toLowerCase().includes(searchVal) ||
      (row['Name']        || '').toLowerCase().includes(searchVal) ||
      (row['Standard']    || '').toLowerCase().includes(searchVal)
    );
  });

  if (sortColumn) {
    rows = [...rows].sort((a, b) => {
      let va = a[sortColumn], vb = b[sortColumn];
      if (!isNaN(va) && !isNaN(vb)) { va = +va; vb = +vb; }
      else { va = (va || '').toString().toLowerCase(); vb = (vb || '').toString().toLowerCase(); }
      if (va < vb) return sortAsc ? -1 :  1;
      if (va > vb) return sortAsc ?  1 : -1;
      return 0;
    });
  }

  const tbody = document.getElementById('tableBody');
  tbody.innerHTML = '';

  document.getElementById('rowCount').textContent =
    `${rows.length.toLocaleString()} student${rows.length !== 1 ? 's' : ''}`;

  if (!rows.length) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="6">No students match the current filters.</td></tr>`;
    return;
  }

  const MAX_ROWS = 500;
  rows.slice(0, MAX_ROWS).forEach(row => {
    const rank      = Math.round(row['Rank']);
    const rankClass = rank === 1 ? 'rank-1' : rank === 2 ? 'rank-2' : rank === 3 ? 'rank-3' : 'rank-other';
    const score     = row['Score'];
    const scorePct  = Math.min(100, score);

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${row['School Name'] || '—'}</td>
      <td><span class="city-tag">${row['School City'] || '—'}</span></td>
      <td>${row['Name'] || '—'}</td>
      <td><span class="std-tag">${row['Standard'] || '—'}</span></td>
      <td>
        <div class="score-cell">
          <span class="score-num">${score}</span>
          <div class="score-bar-bg">
            <div class="score-bar-fill" style="width:${scorePct}%"></div>
          </div>
        </div>
      </td>
      <td><span class="rank-badge ${rankClass}">${rank}</span></td>
    `;
    tbody.appendChild(tr);
  });

  if (rows.length > MAX_ROWS) {
    const note = document.createElement('tr');
    note.innerHTML = `<td colspan="6" style="text-align:center;padding:12px 16px;color:#9ea3bc;font-size:12px">
      Showing ${MAX_ROWS.toLocaleString()} of ${rows.length.toLocaleString()} rows — use filters or search to narrow results.
    </td>`;
    tbody.appendChild(note);
  }
}

// -----------------------------------------------
// 9. TABLE SORTING
// -----------------------------------------------
function setupTableSorting() {
  const headers = document.querySelectorAll('#dataTable thead th[data-col]');
  headers.forEach(th => {
    th.addEventListener('click', () => {
      const col = th.getAttribute('data-col');
      if (sortColumn === col) { sortAsc = !sortAsc; }
      else { sortColumn = col; sortAsc = true; }

      headers.forEach(h => {
        h.classList.remove('sorted');
        h.querySelector('.sort-icon').textContent = '↕';
      });
      th.classList.add('sorted');
      th.querySelector('.sort-icon').textContent = sortAsc ? '↑' : '↓';
      updateTable(filteredData);
    });
  });
}

// -----------------------------------------------
// 10. MASTER UPDATE
// -----------------------------------------------
function updateAll() {
  filterData();
  const metrics = calculateMetrics(filteredData);
  updateKPIs(metrics);
  updateCharts(filteredData);
  updateTable(filteredData);
}

// -----------------------------------------------
// 11. LOADING OVERLAY
// -----------------------------------------------
function hideLoading() {
  const overlay = document.getElementById('loadingOverlay');
  overlay.style.opacity    = '0';
  overlay.style.transition = 'opacity 0.4s';
  setTimeout(() => overlay.remove(), 400);
}

// -----------------------------------------------
// 12. EVENT LISTENERS
// -----------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  setChartDefaults();
  setupTableSorting();

  ['filterCity', 'filterStandard', 'filterYear'].forEach(id => {
    document.getElementById(id).addEventListener('change', updateAll);
  });

  document.getElementById('btnReset').addEventListener('click', () => {
    document.getElementById('filterCity').value     = '';
    document.getElementById('filterStandard').value = '';
    document.getElementById('filterYear').value     = '';
    document.getElementById('tableSearch').value    = '';
    sortColumn = '';
    sortAsc    = true;
    document.querySelectorAll('#dataTable thead th[data-col]').forEach(th => {
      th.classList.remove('sorted');
      th.querySelector('.sort-icon').textContent = '↕';
    });
    updateAll();
  });

  document.getElementById('tableSearch').addEventListener('input', () => {
    updateTable(filteredData);
  });

  loadCSV();
});