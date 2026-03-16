// ── State ──
let currentCharts = null;

// ── DOM refs ──
const dropZone   = document.getElementById('dropZone');
const fileInput  = document.getElementById('fileInput');
const errorMsg   = document.getElementById('errorMsg');
const loading    = document.getElementById('loading');
const results    = document.getElementById('results');
const uploadSec  = document.getElementById('uploadSection');

// ── Drag & Drop ──
['dragenter', 'dragover'].forEach(ev =>
  dropZone.addEventListener(ev, e => { e.preventDefault(); dropZone.classList.add('drag-over'); })
);
['dragleave', 'drop'].forEach(ev =>
  dropZone.addEventListener(ev, e => { e.preventDefault(); dropZone.classList.remove('drag-over'); })
);
dropZone.addEventListener('drop', e => {
  const file = e.dataTransfer.files[0];
  if (file) processFile(file);
});
fileInput.addEventListener('change', () => {
  if (fileInput.files[0]) processFile(fileInput.files[0]);
});

// ── Upload & process ──
async function processFile(file) {
  setError('');
  showLoading(true);

  const formData = new FormData();
  formData.append('file', file);

  try {
    const res  = await fetch('/upload', { method: 'POST', body: formData });
    const data = await res.json();

    if (!res.ok || data.error) {
      throw new Error(data.error || 'Upload failed');
    }

    currentCharts = data.charts;
    renderSummary(data.summary);
    renderCharts(data.charts);
    showResults();
  } catch (err) {
    setError(err.message);
    showLoading(false);
  }
}

// ── Render Summary ──
function renderSummary(s) {
  // Stat pills
  const statRow = document.getElementById('statRow');
  statRow.innerHTML = `
    <div class="stat-pill">Rows <strong>${s.rows.toLocaleString()}</strong></div>
    <div class="stat-pill">Columns <strong>${s.cols}</strong></div>
    <div class="stat-pill">Numeric cols <strong>${Object.values(s.dtypes).filter(d => d.includes('int') || d.includes('float')).length}</strong></div>
    <div class="stat-pill">Missing values <strong>${Object.values(s.missing).reduce((a, b) => a + b, 0).toLocaleString()}</strong></div>
  `;

  // Preview table
  if (!s.preview || s.preview.length === 0) return;
  const cols = Object.keys(s.preview[0]);
  const wrap = document.getElementById('previewTable');
  const header = cols.map(c => `<th>${escHtml(c)}</th>`).join('');
  const rows = s.preview.map(row =>
    `<tr>${cols.map(c => `<td>${escHtml(String(row[c] ?? ''))}</td>`).join('')}</tr>`
  ).join('');
  wrap.innerHTML = `
    <table>
      <thead><tr>${header}</tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

// ── Render Charts ──
const plotConfig = {
  responsive: true,
  displayModeBar: true,
  modeBarButtonsToRemove: ['select2d', 'lasso2d', 'autoScale2d'],
  displaylogo: false,
};

function renderCharts(charts) {
  // Correlation
  const corrEl = document.getElementById('chart-correlation');
  if (charts.correlation) {
    corrEl.innerHTML = '';
    Plotly.newPlot(corrEl, charts.correlation.data, charts.correlation.layout, plotConfig);
  } else {
    corrEl.innerHTML = emptyState('Need at least 2 numeric columns for correlation matrix.');
  }

  // Distributions
  const distEl = document.getElementById('chart-distributions');
  distEl.innerHTML = '';
  if (charts.distributions && charts.distributions.length) {
    charts.distributions.forEach(ch => {
      const div = document.createElement('div');
      div.className = 'chart-item';
      distEl.appendChild(div);
      Plotly.newPlot(div, ch.data, ch.layout, plotConfig);
    });
  } else {
    distEl.innerHTML = emptyState('No numeric columns found for distributions.');
  }

  // Trends
  const trendEl = document.getElementById('chart-trends');
  trendEl.innerHTML = '';
  if (charts.trends && charts.trends.length) {
    charts.trends.forEach(ch => {
      const div = document.createElement('div');
      div.className = 'chart-item';
      trendEl.appendChild(div);
      Plotly.newPlot(div, ch.data, ch.layout, plotConfig);
    });
  } else {
    trendEl.innerHTML = emptyState('No trends detected. Need a datetime column or 2+ numeric columns.');
  }
}

// ── Tabs ──
document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-' + btn.dataset.tab).classList.add('active');

    // Trigger Plotly resize after tab switch
    setTimeout(() => window.dispatchEvent(new Event('resize')), 50);
  });
});

// ── Helpers ──
function showLoading(on) {
  loading.classList.toggle('hidden', !on);
  if (on) {
    results.classList.add('hidden');
  }
}

function showResults() {
  loading.classList.add('hidden');
  results.classList.remove('hidden');
  // Scroll to results
  results.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function setError(msg) {
  errorMsg.textContent = msg;
  if (msg) showLoading(false);
}

function escHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function emptyState(msg) {
  return `
    <div class="empty-state">
      <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
        <circle cx="20" cy="20" r="20" fill="rgba(99,102,241,0.1)"/>
        <path d="M20 12v8M20 26v2" stroke="#6366f1" stroke-width="2.5" stroke-linecap="round"/>
      </svg>
      <p>${msg}</p>
    </div>
  `;
}
