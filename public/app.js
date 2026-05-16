const state = {
  range: '15m',
  customFrom: null,
  customTo: null,
  selectedMac: '',
  clients: [],
  summary: null,
  series: [],
  usage: null,
  refreshTimer: null,
  chartGeometry: null,
  hoverIndex: null
};

const els = {
  routerName: document.querySelector('#routerName'),
  collectorStatus: document.querySelector('#collectorStatus'),
  refreshButton: document.querySelector('#refreshButton'),
  wanDown: document.querySelector('#wanDown'),
  wanUp: document.querySelector('#wanUp'),
  onlineCount: document.querySelector('#onlineCount'),
  cpuLoad: document.querySelector('#cpuLoad'),
  memoryUsage: document.querySelector('#memoryUsage'),
  uptime: document.querySelector('#uptime'),
  clientTotal: document.querySelector('#clientTotal'),
  clientSearch: document.querySelector('#clientSearch'),
  clientList: document.querySelector('#clientList'),
  chartTitle: document.querySelector('#chartTitle'),
  chartSubtitle: document.querySelector('#chartSubtitle'),
  rangeControl: document.querySelector('#rangeControl'),
  customRange: document.querySelector('#customRange'),
  customFrom: document.querySelector('#customFrom'),
  customTo: document.querySelector('#customTo'),
  applyCustomRange: document.querySelector('#applyCustomRange'),
  chart: document.querySelector('#trafficChart'),
  emptyChart: document.querySelector('#emptyChart'),
  chartTooltip: document.querySelector('#chartTooltip'),
  bucketInfo: document.querySelector('#bucketInfo'),
  meshStatus: document.querySelector('#meshStatus'),
  meshList: document.querySelector('#meshList'),
  wifiStatus: document.querySelector('#wifiStatus'),
  wifiList: document.querySelector('#wifiList'),
  usageDownChart: document.querySelector('#usageDownChart'),
  usageUpChart: document.querySelector('#usageUpChart'),
  usageDownLegend: document.querySelector('#usageDownLegend'),
  usageUpLegend: document.querySelector('#usageUpLegend'),
  usageDownTotal: document.querySelector('#usageDownTotal'),
  usageUpTotal: document.querySelector('#usageUpTotal')
};

restoreRangePreference();

const pieColors = [
  '#b85c38',
  '#3f7f7a',
  '#d58a64',
  '#6f7f4f',
  '#9d6a89',
  '#b08a3c',
  '#5f79a8',
  '#a75d5d',
  '#6f8f8a',
  '#c7b29f'
];

function formatRate(value) {
  const bps = Number(value) || 0;
  const units = ['bps', 'Kbps', 'Mbps', 'Gbps'];
  let scaled = bps * 8;
  let unit = 0;
  while (scaled >= 1000 && unit < units.length - 1) {
    scaled /= 1000;
    unit += 1;
  }
  const digits = scaled >= 100 ? 0 : scaled >= 10 ? 1 : 2;
  return `${scaled.toFixed(digits)} ${units[unit]}`;
}

function formatDuration(seconds) {
  const days = Math.floor((Number(seconds) || 0) / 86400);
  if (days > 0) return `${days}d`;
  const hours = Math.floor((Number(seconds) || 0) / 3600);
  if (hours > 0) return `${hours}h`;
  const minutes = Math.floor((Number(seconds) || 0) / 60);
  return `${minutes}m`;
}

function formatBytes(value) {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let scaled = Math.max(0, Number(value) || 0);
  let unit = 0;
  while (scaled >= 1024 && unit < units.length - 1) {
    scaled /= 1024;
    unit += 1;
  }
  const digits = scaled >= 100 ? 0 : scaled >= 10 ? 1 : 2;
  return `${scaled.toFixed(digits)} ${units[unit]}`;
}

function escapeHtml(text) {
  return String(text ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[char]);
}

async function getJson(path, options) {
  const response = await fetch(path, options);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

async function loadAll() {
  const [summary, clients] = await Promise.all([
    getJson('/api/summary'),
    getJson('/api/clients')
  ]);
  state.summary = summary;
  state.clients = clients.clients ?? [];
  renderSummary();
  renderClients();
  await loadSeries();
}

async function loadSeries() {
  const params = buildRangeParams();
  params.set('maxPoints', String(maxPointsForRange(state.range)));
  if (state.selectedMac) params.set('mac', state.selectedMac);
  const usageParams = buildRangeParams();
  const [seriesPayload, usagePayload] = await Promise.all([
    getJson(`/api/series?${params}`),
    getJson(`/api/usage?${usageParams}`)
  ]);
  state.series = seriesPayload.points ?? [];
  state.usage = usagePayload;
  state.hoverIndex = null;
  els.bucketInfo.textContent = seriesPayload.bucket ? `Bucket ${formatDuration(seriesPayload.bucket)}` : '';
  hideChartTooltip();
  renderChart();
  renderUsageCharts();
}

function buildRangeParams() {
  const params = new URLSearchParams({ range: state.range });
  if (state.range === 'custom' && state.customFrom && state.customTo) {
    params.set('from', String(state.customFrom));
    params.set('to', String(state.customTo));
  }
  return params;
}

function maxPointsForRange(range) {
  const pollSeconds = Math.max(5, Number(state.summary?.settings?.pollSeconds) || 30);
  const ranges = {
    '15m': 900,
    '1h': 3600,
    '6h': 21600,
    '1d': 86400,
    '30d': 2592000
  };
  const seconds = range === 'custom'
    ? Math.max(900, (state.customTo || 0) - (state.customFrom || 0))
    : ranges[range] ?? ranges['15m'];

  if (seconds <= 86400) {
    return Math.ceil(seconds / pollSeconds);
  }
  if (range === '30d') return 8640;
  return Math.min(10080, Math.ceil(seconds / 300));
}

function restoreRangePreference() {
  const now = Math.floor(Date.now() / 1000);
  const fallback = {
    range: '15m',
    customFrom: now - 3600,
    customTo: now
  };
  let saved = fallback;
  try {
    saved = { ...fallback, ...JSON.parse(localStorage.getItem('mirouter.range') || '{}') };
  } catch {
    saved = fallback;
  }

  const allowed = new Set(['15m', '1h', '6h', '1d', '30d', 'custom']);
  state.range = allowed.has(saved.range) ? saved.range : '15m';
  state.customFrom = Number.isFinite(Number(saved.customFrom)) ? Number(saved.customFrom) : fallback.customFrom;
  state.customTo = Number.isFinite(Number(saved.customTo)) ? Number(saved.customTo) : fallback.customTo;
  if (state.customTo <= state.customFrom) {
    state.customFrom = fallback.customFrom;
    state.customTo = fallback.customTo;
  }
  syncRangeControls();
}

function saveRangePreference() {
  localStorage.setItem('mirouter.range', JSON.stringify({
    range: state.range,
    customFrom: state.customFrom,
    customTo: state.customTo
  }));
}

function syncRangeControls() {
  els.rangeControl.querySelectorAll('button').forEach((item) => {
    item.classList.toggle('active', item.dataset.range === state.range);
  });
  els.customRange.hidden = state.range !== 'custom';
  els.customFrom.value = toDateTimeLocal(state.customFrom);
  els.customTo.value = toDateTimeLocal(state.customTo);
}

function toDateTimeLocal(seconds) {
  const date = new Date(seconds * 1000);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function fromDateTimeLocal(value) {
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : null;
}

function renderSummary() {
  const { latest, lastSnapshot, collector, settings } = state.summary;
  const hardware = lastSnapshot?.router ?? {};
  els.routerName.textContent = hardware.displayName || hardware.DisplayRomVer
    ? `${hardware.displayName || 'Xiaomi Router'} · ${hardware.platform || ''}`.trim()
    : 'Xiaomi Router';

  els.collectorStatus.classList.remove('ok', 'error');
  if (!settings.hasToken && !settings.canRefreshToken) {
    els.collectorStatus.textContent = 'No token';
    els.collectorStatus.classList.add('error');
  } else if (collector.lastError) {
    els.collectorStatus.textContent = 'Offline';
    els.collectorStatus.classList.add('error');
    els.collectorStatus.title = collector.lastError;
  } else {
    els.collectorStatus.textContent = 'Live';
    els.collectorStatus.classList.add('ok');
    els.collectorStatus.title = '';
  }

  els.wanDown.textContent = formatRate(latest?.wan_down_bps);
  els.wanUp.textContent = formatRate(latest?.wan_up_bps);
  els.onlineCount.textContent = latest ? `${latest.online_count}/${latest.all_count}` : '--';
  els.cpuLoad.textContent = latest ? `${Math.round(latest.cpu_load * 100)}%` : '--';
  els.memoryUsage.textContent = latest ? `${Math.round(latest.mem_usage * 100)}%` : '--';
  els.uptime.textContent = latest ? formatDuration(latest.uptime_seconds) : '--';

  renderMesh(lastSnapshot?.topo);
  renderWifi(lastSnapshot?.wifi);
  scheduleRefresh(settings.pollSeconds);
}

function scheduleRefresh(pollSeconds) {
  const refreshMs = Math.max(5000, (Number(pollSeconds) || 30) * 1000);
  if (state.refreshTimer?.refreshMs === refreshMs) return;
  if (state.refreshTimer) clearInterval(state.refreshTimer.id);
  state.refreshTimer = {
    refreshMs,
    id: setInterval(() => {
      loadAll().catch(() => {});
    }, refreshMs)
  };
}

function renderClients() {
  const query = els.clientSearch.value.trim().toLowerCase();
  const clients = state.clients.filter((client) => {
    const haystack = `${client.name} ${client.oname} ${client.ip} ${client.mac}`.toLowerCase();
    return haystack.includes(query);
  });

  els.clientTotal.textContent = String(state.clients.length);
  const allActive = state.selectedMac === '' ? ' active' : '';
  els.clientList.innerHTML = `
    <button class="client-row${allActive}" data-mac="">
      <span>
        <span class="client-name">WAN aggregate</span>
        <span class="client-meta">All router traffic</span>
      </span>
      <span class="client-rate">${formatRate(state.summary?.latest?.wan_down_bps || 0)}</span>
    </button>
    ${clients.map((client) => `
      <button class="client-row${client.mac === state.selectedMac ? ' active' : ''}" data-mac="${escapeHtml(client.mac)}">
        <span>
          <span class="client-name">${escapeHtml(client.name || client.oname || client.mac)}</span>
          <span class="client-meta">${escapeHtml(client.ip || 'no ip')} · ${escapeHtml(client.mac)}</span>
        </span>
        <span class="client-rate">${formatRate(client.down_bps)}<br>${formatRate(client.up_bps)}</span>
      </button>
    `).join('')}
  `;
}

function renderMesh(topo) {
  const graph = topo?.graph;
  const leafs = graph?.leafs ?? [];
  els.meshStatus.textContent = graph ? `${leafs.length + 1} nodes` : '--';
  if (!graph) {
    els.meshList.innerHTML = '<div>No topology sample yet</div>';
    return;
  }
  const nodes = [
    { ...graph, link_type: 'root', onlines: graph.onlines },
    ...leafs
  ];
  els.meshList.innerHTML = nodes.map((node) => `
    <div class="mesh-node">
      <div>
        <strong>${escapeHtml(node.locale || node.name || node.ip)}</strong>
        <span>${escapeHtml(node.hardware || '')} · ${escapeHtml(node.ip || '')}</span>
      </div>
      <span>${escapeHtml(node.link_type || 'root')} · ${escapeHtml(node.onlines ?? 0)} online</span>
    </div>
  `).join('');
}

function renderWifi(wifi) {
  const bands = wifi?.info ?? [];
  els.wifiStatus.textContent = bands.length ? `${bands.length} bands` : '--';
  if (!bands.length) {
    els.wifiList.innerHTML = '<div>No Wi-Fi sample yet</div>';
    return;
  }
  els.wifiList.innerHTML = bands.map((band) => `
    <div class="wifi-band">
      <div>
        <strong>${escapeHtml(band.ssid || band.ifname)}</strong>
        <span>${escapeHtml(band.wifimode || band.mode || '')} · ${escapeHtml(band.encryption || '')}</span>
      </div>
      <span>ch ${escapeHtml(band.channel)} · ${escapeHtml(band.bandwidth)} MHz</span>
    </div>
  `).join('');
}

function renderChart() {
  const selected = state.clients.find((client) => client.mac === state.selectedMac);
  els.chartTitle.textContent = selected ? selected.name || selected.mac : 'WAN Traffic';
  els.chartSubtitle.textContent = selected
    ? `${selected.ip || 'no ip'} · ${selected.mac}`
    : 'Downstream and upstream throughput';

  const points = state.series;
  els.emptyChart.classList.toggle('show', points.length < 2);

  const canvas = els.chart;
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.floor(rect.width * dpr));
  canvas.height = Math.max(1, Math.floor(rect.height * dpr));
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, rect.width, rect.height);

  const pad = { top: 12, right: 18, bottom: 30, left: 58 };
  const width = rect.width - pad.left - pad.right;
  const height = rect.height - pad.top - pad.bottom;
  state.chartGeometry = null;
  drawGrid(ctx, rect, pad, width, height);
  if (points.length < 2) return;

  const maxY = Math.max(1, ...points.flatMap((p) => [Number(p.down_bps) || 0, Number(p.up_bps) || 0]));
  const minT = points[0].ts;
  const maxT = points[points.length - 1].ts;

  const x = (ts) => pad.left + ((ts - minT) / Math.max(1, maxT - minT)) * width;
  const y = (value) => pad.top + height - ((Number(value) || 0) / maxY) * height;
  state.chartGeometry = { pad, width, height, maxY, minT, maxT };

  drawAxisLabels(ctx, pad, width, height, maxY, minT, maxT);
  drawLine(ctx, points, x, y, 'down_bps', '#b85c38');
  drawLine(ctx, points, x, y, 'up_bps', '#3f7f7a');
  drawHover(ctx, points, x, y, pad, height);
}

function renderUsageCharts() {
  renderPie({
    canvas: els.usageDownChart,
    legend: els.usageDownLegend,
    total: els.usageDownTotal,
    data: state.usage?.down,
    emptyLabel: 'No download data'
  });
  renderPie({
    canvas: els.usageUpChart,
    legend: els.usageUpLegend,
    total: els.usageUpTotal,
    data: state.usage?.up,
    emptyLabel: 'No upload data'
  });
}

function renderPie({ canvas, legend, total, data, emptyLabel }) {
  const items = data?.items ?? [];
  const sum = Number(data?.total) || 0;
  total.textContent = sum > 0 ? formatBytes(sum) : '--';
  legend.innerHTML = items.length
    ? items.map((item, index) => {
        const percent = sum > 0 ? (item.bytes / sum) * 100 : 0;
        return `
          <div class="pie-legend-row" title="${escapeHtml(item.name)}">
            <span class="pie-swatch" style="background:${pieColors[index % pieColors.length]}"></span>
            <span class="pie-name">${escapeHtml(item.name)}</span>
            <span class="pie-value">${escapeHtml(formatBytes(item.bytes))} · ${percent.toFixed(percent >= 10 ? 0 : 1)}%</span>
          </div>
        `;
      }).join('')
    : `<div class="pie-legend-row"><span></span><span class="pie-name">${emptyLabel}</span><span></span></div>`;

  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.max(1, Math.floor(rect.width * dpr));
  canvas.height = Math.max(1, Math.floor(rect.height * dpr));
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, rect.width, rect.height);

  const cx = rect.width / 2;
  const cy = rect.height / 2;
  const radius = Math.max(10, Math.min(rect.width, rect.height) / 2 - 5);
  ctx.lineWidth = 1;
  if (!items.length || sum <= 0) {
    ctx.fillStyle = '#f1e4d6';
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fffaf3';
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.58, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  let start = -Math.PI / 2;
  items.forEach((item, index) => {
    const angle = (item.bytes / sum) * Math.PI * 2;
    ctx.fillStyle = pieColors[index % pieColors.length];
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, radius, start, start + angle);
    ctx.closePath();
    ctx.fill();
    start += angle;
  });

  ctx.fillStyle = '#fffaf3';
  ctx.beginPath();
  ctx.arc(cx, cy, radius * 0.58, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2d241d';
  ctx.font = '700 13px Inter, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(formatBytes(sum), cx, cy);
}

function drawGrid(ctx, rect, pad, width, height) {
  ctx.strokeStyle = '#ecdccd';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i <= 4; i += 1) {
    const y = pad.top + (height / 4) * i;
    ctx.moveTo(pad.left, y);
    ctx.lineTo(pad.left + width, y);
  }
  ctx.stroke();
  ctx.strokeStyle = '#ddc9b6';
  ctx.strokeRect(pad.left, pad.top, width, height);
}

function drawAxisLabels(ctx, pad, width, height, maxY, minT, maxT) {
  ctx.fillStyle = '#7d7065';
  ctx.font = '12px Inter, system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (let i = 0; i <= 4; i += 1) {
    const value = maxY - (maxY / 4) * i;
    ctx.fillText(formatRate(value), pad.left - 8, pad.top + (height / 4) * i);
  }
  ctx.textBaseline = 'top';
  ctx.fillText(formatTime(minT), pad.left + 40, pad.top + height + 10);
  ctx.textAlign = 'right';
  ctx.fillText(formatTime(maxT), pad.left + width, pad.top + height + 10);
}

function drawLine(ctx, points, x, y, key, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  points.forEach((point, index) => {
    const px = x(point.ts);
    const py = y(point[key]);
    if (index === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  ctx.stroke();
}

function drawHover(ctx, points, x, y, pad, height) {
  if (state.hoverIndex === null || !points[state.hoverIndex]) return;

  const point = points[state.hoverIndex];
  const px = x(point.ts);
  const downY = y(point.down_bps);
  const upY = y(point.up_bps);

  ctx.save();
  ctx.strokeStyle = 'rgba(45, 36, 29, 0.3)';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(px, pad.top);
  ctx.lineTo(px, pad.top + height);
  ctx.stroke();
  ctx.setLineDash([]);
  drawPoint(ctx, px, downY, '#b85c38');
  drawPoint(ctx, px, upY, '#3f7f7a');
  ctx.restore();
}

function drawPoint(ctx, x, y, color) {
  ctx.fillStyle = '#fffdf9';
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

function formatTime(ts) {
  return new Date(ts * 1000).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatTooltipTime(ts) {
  return new Date(ts * 1000).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

function updateChartHover(event) {
  if (!state.chartGeometry || state.series.length < 2) {
    hideChartTooltip();
    return;
  }

  const canvasRect = els.chart.getBoundingClientRect();
  const mouseX = event.clientX - canvasRect.left;
  const mouseY = event.clientY - canvasRect.top;
  const { pad, width, height, minT, maxT } = state.chartGeometry;

  if (mouseX < pad.left || mouseX > pad.left + width || mouseY < pad.top || mouseY > pad.top + height) {
    if (state.hoverIndex !== null) {
      hideChartTooltip();
      renderChart();
    }
    return;
  }

  const targetTs = minT + ((mouseX - pad.left) / width) * Math.max(1, maxT - minT);
  let nearestIndex = 0;
  let nearestDistance = Infinity;
  for (let i = 0; i < state.series.length; i += 1) {
    const distance = Math.abs(state.series[i].ts - targetTs);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestIndex = i;
    }
  }

  state.hoverIndex = nearestIndex;
  renderChart();
  showChartTooltip(state.series[nearestIndex]);
}

function showChartTooltip(point) {
  if (!point || !state.chartGeometry) return;
  const { pad, width, height, maxY, minT, maxT } = state.chartGeometry;
  const x = pad.left + ((point.ts - minT) / Math.max(1, maxT - minT)) * width;
  const downY = pad.top + height - ((Number(point.down_bps) || 0) / maxY) * height;
  const upY = pad.top + height - ((Number(point.up_bps) || 0) / maxY) * height;
  const y = Math.min(downY, upY);

  els.chartTooltip.innerHTML = `
    <div class="tooltip-time">${escapeHtml(formatTooltipTime(point.ts))}</div>
    <div class="tooltip-row">
      <span class="tooltip-label down">Down</span>
      <span class="tooltip-value">${escapeHtml(formatRate(point.down_bps))}</span>
    </div>
    <div class="tooltip-row">
      <span class="tooltip-label up">Up</span>
      <span class="tooltip-value">${escapeHtml(formatRate(point.up_bps))}</span>
    </div>
  `;
  els.chartTooltip.classList.add('show');

  const wrapRect = els.chart.parentElement.getBoundingClientRect();
  const tooltipRect = els.chartTooltip.getBoundingClientRect();
  const left = x + 18 + tooltipRect.width > wrapRect.width ? x - tooltipRect.width - 18 : x + 18;
  const top = Math.min(
    Math.max(y - tooltipRect.height / 2, 8),
    wrapRect.height - tooltipRect.height - 8
  );
  els.chartTooltip.style.left = `${left}px`;
  els.chartTooltip.style.top = `${top}px`;
}

function hideChartTooltip() {
  state.hoverIndex = null;
  els.chartTooltip.classList.remove('show');
}

els.rangeControl.addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-range]');
  if (!button) return;
  state.range = button.dataset.range;
  if (state.range === 'custom') {
    const now = Math.floor(Date.now() / 1000);
    state.customTo = state.customTo || now;
    state.customFrom = state.customFrom || state.customTo - 3600;
  }
  syncRangeControls();
  saveRangePreference();
  await loadSeries();
});

els.applyCustomRange.addEventListener('click', async () => {
  const from = fromDateTimeLocal(els.customFrom.value);
  const to = fromDateTimeLocal(els.customTo.value);
  if (!from || !to || to <= from) {
    els.customTo.focus();
    return;
  }
  state.range = 'custom';
  state.customFrom = from;
  state.customTo = to;
  syncRangeControls();
  saveRangePreference();
  await loadSeries();
});

els.customFrom.addEventListener('change', () => {
  state.customFrom = fromDateTimeLocal(els.customFrom.value) ?? state.customFrom;
  saveRangePreference();
});

els.customTo.addEventListener('change', () => {
  state.customTo = fromDateTimeLocal(els.customTo.value) ?? state.customTo;
  saveRangePreference();
});

els.clientList.addEventListener('click', async (event) => {
  const row = event.target.closest('.client-row');
  if (!row) return;
  state.selectedMac = row.dataset.mac || '';
  renderClients();
  await loadSeries();
});

els.clientSearch.addEventListener('input', renderClients);
els.refreshButton.addEventListener('click', async () => {
  els.collectorStatus.textContent = 'Collecting';
  await getJson('/api/collect', { method: 'POST' });
  await loadAll();
});

els.chart.addEventListener('mousemove', updateChartHover);
els.chart.addEventListener('mouseleave', () => {
  hideChartTooltip();
  renderChart();
});
els.chart.addEventListener('focus', () => {
  state.hoverIndex = Math.max(0, state.series.length - 1);
  renderChart();
  showChartTooltip(state.series[state.hoverIndex]);
});
els.chart.addEventListener('blur', () => {
  hideChartTooltip();
  renderChart();
});

window.addEventListener('resize', () => {
  hideChartTooltip();
  renderChart();
  renderUsageCharts();
});

loadAll().catch((error) => {
  els.collectorStatus.textContent = 'Error';
  els.collectorStatus.classList.add('error');
  els.collectorStatus.title = error.message;
});
