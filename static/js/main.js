// ── Entrance animations (IntersectionObserver) ──
const observer = new IntersectionObserver(
  entries => entries.forEach(el => {
    if (el.isIntersecting) {
      el.target.classList.add('visible');
      observer.unobserve(el.target);
    }
  }),
  { threshold: 0.1 }
);
document.querySelectorAll('.fade-up').forEach(el => observer.observe(el));

// ── Mouse spotlight on cards ──
function initSpotlight(card, spotlightEl) {
  card.addEventListener('mousemove', e => {
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    spotlightEl.style.background =
      `radial-gradient(300px circle at ${x}px ${y}px, rgba(94,106,210,0.10), transparent 70%)`;
  });
}
const overviewCard = document.getElementById('overviewCard');
const overviewSpotlight = document.getElementById('overviewSpotlight');
if (overviewCard && overviewSpotlight) initSpotlight(overviewCard, overviewSpotlight);

// ── DOM refs ──
const dropZone  = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const errorMsg  = document.getElementById('errorMsg');
const loading   = document.getElementById('loading');
const results   = document.getElementById('results');

// ── Drag & drop ──
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
    if (!res.ok || data.error) throw new Error(data.error || 'Upload failed');

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
  const numericCount = Object.values(s.dtypes)
    .filter(d => d.includes('int') || d.includes('float')).length;
  const missingTotal = Object.values(s.missing).reduce((a, b) => a + b, 0);

  document.getElementById('statRow').innerHTML = `
    <div class="stat-pill">Rows <strong>${s.rows.toLocaleString()}</strong></div>
    <div class="stat-pill">Columns <strong>${s.cols}</strong></div>
    <div class="stat-pill">Numeric <strong>${numericCount}</strong></div>
    <div class="stat-pill">Missing <strong>${missingTotal.toLocaleString()}</strong></div>
  `;

  if (!s.preview?.length) return;
  const cols = Object.keys(s.preview[0]);
  const header = cols.map(c => `<th>${esc(c)}</th>`).join('');
  const rows = s.preview.map(row =>
    `<tr>${cols.map(c => `<td>${esc(String(row[c] ?? ''))}</td>`).join('')}</tr>`
  ).join('');
  document.getElementById('previewTable').innerHTML =
    `<table><thead><tr>${header}</tr></thead><tbody>${rows}</tbody></table>`;
}

// ── Render Charts ──
const plotCfg = {
  responsive: true,
  displayModeBar: true,
  modeBarButtonsToRemove: ['select2d', 'lasso2d', 'autoScale2d'],
  displaylogo: false,
  toImageButtonOptions: { format: 'png', scale: 2 },
};

// Shared dark layout overrides injected into every chart
const darkLayout = {
  paper_bgcolor: 'rgba(0,0,0,0)',
  plot_bgcolor:  'rgba(0,0,0,0)',
  font: { family: 'Inter, system-ui, sans-serif', color: '#8A8F98' },
  xaxis: { gridcolor: 'rgba(255,255,255,0.05)', linecolor: 'rgba(255,255,255,0.06)', tickfont: { color: '#8A8F98' } },
  yaxis: { gridcolor: 'rgba(255,255,255,0.05)', linecolor: 'rgba(255,255,255,0.06)', tickfont: { color: '#8A8F98' } },
  title: { font: { color: '#EDEDEF', size: 14, family: 'Inter, system-ui, sans-serif' } },
};

function mergeLayout(layout) {
  return {
    ...layout,
    ...darkLayout,
    font: darkLayout.font,
    xaxis: { ...layout.xaxis, ...darkLayout.xaxis },
    yaxis: { ...layout.yaxis, ...darkLayout.yaxis },
    title: { ...(typeof layout.title === 'string' ? { text: layout.title } : layout.title), ...darkLayout.title },
  };
}

function renderCharts(charts) {
  // Correlation
  const corrEl = document.getElementById('chart-correlation');
  if (charts.correlation) {
    corrEl.innerHTML = '';
    Plotly.newPlot(corrEl, charts.correlation.data, mergeLayout(charts.correlation.layout), plotCfg);
  } else {
    corrEl.innerHTML = emptyState('Need at least 2 numeric columns for a correlation matrix.');
  }

  // Distributions
  const distEl = document.getElementById('chart-distributions');
  distEl.innerHTML = '';
  if (charts.distributions?.length) {
    charts.distributions.forEach((ch, i) => {
      const wrap = makeChartItem();
      distEl.appendChild(wrap);
      // Staggered entrance
      setTimeout(() => wrap.classList.add('visible'), 60 * i);
      Plotly.newPlot(wrap, ch.data, mergeLayout(ch.layout), plotCfg);
      addChartSpotlight(wrap);
    });
  } else {
    distEl.innerHTML = emptyState('No numeric columns found for distributions.');
  }

  // Trends
  const trendEl = document.getElementById('chart-trends');
  trendEl.innerHTML = '';
  if (charts.trends?.length) {
    charts.trends.forEach((ch, i) => {
      const wrap = makeChartItem();
      trendEl.appendChild(wrap);
      setTimeout(() => wrap.classList.add('visible'), 60 * i);
      Plotly.newPlot(wrap, ch.data, mergeLayout(ch.layout), plotCfg);
      addChartSpotlight(wrap);
    });
  } else {
    trendEl.innerHTML = emptyState('No trends found. Need a datetime column or 2+ numeric columns.');
  }
}

function makeChartItem() {
  const div = document.createElement('div');
  div.className = 'chart-item fade-up';
  div.style.position = 'relative';
  div.style.overflow = 'hidden';
  return div;
}

function addChartSpotlight(el) {
  const sp = document.createElement('div');
  sp.style.cssText = 'position:absolute;inset:0;pointer-events:none;opacity:0;transition:opacity 300ms;border-radius:16px;';
  el.appendChild(sp);
  el.addEventListener('mousemove', e => {
    const r = el.getBoundingClientRect();
    sp.style.background = `radial-gradient(280px circle at ${e.clientX - r.left}px ${e.clientY - r.top}px, rgba(94,106,210,0.09), transparent 70%)`;
    sp.style.opacity = '1';
  });
  el.addEventListener('mouseleave', () => { sp.style.opacity = '0'; });
}

// ── Tabs ──
document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
    setTimeout(() => window.dispatchEvent(new Event('resize')), 50);
  });
});

// ── Helpers ──
function showLoading(on) {
  loading.classList.toggle('hidden', !on);
  if (on) results.classList.add('hidden');
}

function showResults() {
  loading.classList.add('hidden');
  results.classList.remove('hidden');
  // Trigger entrance animations for newly visible elements
  results.querySelectorAll('.fade-up').forEach(el => observer.observe(el));
  results.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function setError(msg) {
  errorMsg.textContent = msg;
  if (msg) showLoading(false);
}

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function emptyState(msg) {
  return `
    <div class="empty-state">
      <div class="empty-icon">
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <circle cx="9" cy="9" r="8" stroke="#5E6AD2" stroke-width="1.5"/>
          <path d="M9 5v4M9 11v2" stroke="#5E6AD2" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
      </div>
      <p>${msg}</p>
    </div>`;
}
