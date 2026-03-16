// ── Entrance animations (IntersectionObserver) ──
const observer = new IntersectionObserver(
  entries => entries.forEach(el => {
    if (el.isIntersecting) { el.target.classList.add('visible'); observer.unobserve(el.target); }
  }),
  { threshold: 0.08 }
);
document.querySelectorAll('.fade-up').forEach(el => observer.observe(el));

// ── Mouse spotlight on overview card ──
const overviewCard      = document.getElementById('overviewCard');
const overviewSpotlight = document.getElementById('overviewSpotlight');
if (overviewCard && overviewSpotlight) {
  overviewCard.addEventListener('mousemove', e => {
    const r = overviewCard.getBoundingClientRect();
    overviewSpotlight.style.background =
      `radial-gradient(300px circle at ${e.clientX - r.left}px ${e.clientY - r.top}px, rgba(94,106,210,0.10), transparent 70%)`;
  });
}

// ── DOM refs ──
const dropZone  = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const errorMsg  = document.getElementById('errorMsg');
const loading   = document.getElementById('loading');
const results   = document.getElementById('results');

// ── Stored chart data (for lazy tab rendering) ──
let chartsData   = null;
const tabRendered = { correlation: false, distributions: false, trends: false };

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
  setStep('upload');
  Object.keys(tabRendered).forEach(k => tabRendered[k] = false);

  const formData = new FormData();
  formData.append('file', file);

  try {
    setStep('parse');
    const res  = await fetch('/upload', { method: 'POST', body: formData });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || 'Upload failed');

    setStep('charts');
    chartsData = data.charts;
    renderSummary(data.summary);
    switchTab('correlation');
    showResults();

    requestAnimationFrame(() => {
      requestAnimationFrame(() => renderTab('correlation'));
    });
  } catch (err) {
    setError(err.message);
    showLoading(false);
  }
}

// ── Step indicator ──
const stepMeta = {
  upload: { id: 'lstep-upload', sub: 'Uploading file\u2026' },
  parse:  { id: 'lstep-parse',  sub: 'Parsing dataset\u2026' },
  charts: { id: 'lstep-charts', sub: 'Generating charts\u2026' },
};
function setStep(name) {
  const order = ['upload', 'parse', 'charts'];
  const idx   = order.indexOf(name);
  order.forEach((s, i) => {
    const el = document.getElementById(stepMeta[s].id);
    if (!el) return;
    el.classList.remove('active', 'done');
    if (i < idx)  el.classList.add('done');
    if (i === idx) el.classList.add('active');
  });
  const subEl = document.getElementById('loadingStep');
  if (subEl) subEl.textContent = stepMeta[name].sub;
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
  const cols   = Object.keys(s.preview[0]);
  const header = cols.map(c => `<th>${esc(c)}</th>`).join('');
  const rows   = s.preview.map(row =>
    `<tr>${cols.map(c => `<td>${esc(String(row[c] ?? ''))}</td>`).join('')}</tr>`
  ).join('');
  document.getElementById('previewTable').innerHTML =
    `<table><thead><tr>${header}</tr></thead><tbody>${rows}</tbody></table>`;
}

// ── Plotly config & layout helpers ──
const plotCfg = {
  responsive: true,
  displayModeBar: true,
  modeBarButtonsToRemove: ['select2d', 'lasso2d', 'autoScale2d'],
  displaylogo: false,
  toImageButtonOptions: { format: 'png', scale: 2 },
};

function mergeLayout(layout) {
  // Deep-merge only the visual/theme properties — never overwrite height/margin/showlegend
  const merged = { ...layout };
  merged.paper_bgcolor = 'rgba(0,0,0,0)';
  merged.plot_bgcolor  = 'rgba(0,0,0,0)';
  merged.font          = { family: 'Inter, system-ui, sans-serif', color: '#8A8F98', ...(layout.font || {}) };

  merged.xaxis = {
    gridcolor: 'rgba(255,255,255,0.05)',
    linecolor: 'rgba(255,255,255,0.06)',
    zerolinecolor: 'rgba(255,255,255,0.06)',
    tickfont: { color: '#8A8F98' },
    ...(layout.xaxis || {}),
  };
  merged.yaxis = {
    gridcolor: 'rgba(255,255,255,0.05)',
    linecolor: 'rgba(255,255,255,0.06)',
    zerolinecolor: 'rgba(255,255,255,0.06)',
    tickfont: { color: '#8A8F98' },
    ...(layout.yaxis || {}),
  };

  const titleSrc = typeof layout.title === 'string' ? { text: layout.title } : (layout.title || {});
  merged.title = { ...titleSrc, font: { color: '#EDEDEF', size: 14, family: 'Inter, system-ui, sans-serif' } };

  // Remove template so our explicit colors take full effect
  delete merged.template;

  return merged;
}

// ── Tab rendering (lazy — only render when tab is first shown) ──
function renderTab(name) {
  if (!chartsData || tabRendered[name]) return;
  tabRendered[name] = true;

  if (name === 'correlation') {
    const el = document.getElementById('chart-correlation');
    el.innerHTML = '';
    // Ensure element is visible before Plotly measures it
    el.classList.add('visible');
    if (chartsData.correlation) {
      Plotly.newPlot(el, chartsData.correlation.data, mergeLayout(chartsData.correlation.layout), plotCfg);
    } else {
      el.innerHTML = emptyState('Need at least 2 numeric columns for a correlation matrix.');
    }
  }

  if (name === 'distributions') {
    const container = document.getElementById('chart-distributions');
    container.innerHTML = '';
    if (chartsData.distributions?.length) {
      chartsData.distributions.forEach(ch => {
        const wrap = makeChartWrap();
        container.appendChild(wrap);
        Plotly.newPlot(wrap.querySelector('.chart-plot'), ch.data, mergeLayout(ch.layout), plotCfg);
        addSpotlight(wrap);
      });
    } else {
      container.innerHTML = emptyState('No numeric columns found for distributions.');
    }
  }

  if (name === 'trends') {
    const container = document.getElementById('chart-trends');
    container.innerHTML = '';
    if (chartsData.trends?.length) {
      chartsData.trends.forEach(ch => {
        const wrap = makeChartWrap();
        container.appendChild(wrap);
        Plotly.newPlot(wrap.querySelector('.chart-plot'), ch.data, mergeLayout(ch.layout), plotCfg);
        addSpotlight(wrap);
      });
    } else {
      container.innerHTML = emptyState('No trends found. Need a datetime column or 2+ numeric columns.');
    }
  }
}

function makeChartWrap() {
  const outer = document.createElement('div');
  outer.className = 'chart-item';          // no overflow:hidden, no fade-up
  outer.style.position = 'relative';

  const inner = document.createElement('div');
  inner.className = 'chart-plot';
  outer.appendChild(inner);

  return outer;
}

function addSpotlight(wrapEl) {
  const sp = document.createElement('div');
  sp.className = 'chart-spotlight';
  // inserted as first child so it sits beneath the Plotly SVG
  wrapEl.insertBefore(sp, wrapEl.firstChild);

  wrapEl.addEventListener('mousemove', e => {
    const r = wrapEl.getBoundingClientRect();
    sp.style.background =
      `radial-gradient(280px circle at ${e.clientX - r.left}px ${e.clientY - r.top}px, rgba(94,106,210,0.09), transparent 70%)`;
    sp.style.opacity = '1';
  });
  wrapEl.addEventListener('mouseleave', () => { sp.style.opacity = '0'; });
}

// ── Tabs ──
function switchTab(name) {
  document.querySelectorAll('.tab').forEach(t =>
    t.classList.toggle('active', t.dataset.tab === name)
  );
  document.querySelectorAll('.tab-panel').forEach(p =>
    p.classList.toggle('active', p.id === 'tab-' + name)
  );
}

document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => {
    const name = btn.dataset.tab;
    switchTab(name);
    // Render tab content if not yet rendered, then resize existing charts
    if (!tabRendered[name]) {
      renderTab(name);
    } else {
      // Force Plotly to resize charts now that the panel is visible
      document.querySelectorAll('#tab-' + name + ' .chart-plot, #tab-' + name + ' .chart-card').forEach(el => {
        Plotly.Plots.resize(el);
      });
    }
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
