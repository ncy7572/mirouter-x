const state = {
  range: '15m',
  customFrom: null,
  customTo: null,
  selectedMac: '',
  clients: [],
  summary: null,
  series: [],
  usage: null,
  seriesBucket: 0,
  hasBand: false,
  refreshTimer: null,
  chartGeometry: null,
  hoverIndex: null,
  drag: null,
  prevRanges: [],
  chartLoading: false,
  lang: 'en',
  liveUpdates: true
};

const els = {
  routerName: document.querySelector('#routerName'),
  databaseSize: document.querySelector('#databaseSize'),
  collectorStatus: document.querySelector('#collectorStatus'),
  langToggle: document.querySelector('#langToggle'),
  themeSelect: document.querySelector('#themeSelect'),
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
  sidePanel: document.querySelector('.side-panel'),
  chartPanel: document.querySelector('.chart-panel'),
  chartTitle: document.querySelector('#chartTitle'),
  chartSubtitle: document.querySelector('#chartSubtitle'),
  rangeControl: document.querySelector('#rangeControl'),
  customRange: document.querySelector('#customRange'),
  customFrom: document.querySelector('#customFrom'),
  customTo: document.querySelector('#customTo'),
  applyCustomRange: document.querySelector('#applyCustomRange'),
  clientMetricToggle: document.querySelector('#clientMetricToggle'),
  chart: document.querySelector('#trafficChart'),
  emptyChart: document.querySelector('#emptyChart'),
  chartTooltip: document.querySelector('#chartTooltip'),
  zoomOutButton: document.querySelector('#zoomOutButton'),
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
  usageUpTotal: document.querySelector('#usageUpTotal'),
  pieTooltip: document.querySelector('#pieTooltip')
};

restoreRangePreference();
restoreClientMetricPreference();
restoreLanguagePreference();
restoreThemePreference();
restoreLiveUpdatePreference();

const translations = {
  en: {
    accumulated: 'Accumulated',
    accumulatedDown: 'Accumulated Down',
    accumulatedUp: 'Accumulated Up',
    allRouterTraffic: 'All router traffic',
    apply: 'Apply',
    bands: 'bands',
    bucket: 'Bucket',
    clients: 'Clients',
    collectNow: 'Collect now',
    collecting: 'Collecting',
    connecting: 'Connecting',
    databaseSize: 'SQLite data size',
    down: 'Down',
    downstreamUpstream: 'Downstream and upstream throughput',
    endTime: 'End time',
    error: 'Error',
    filterClients: 'Filter clients',
    latest: 'Latest',
    live: 'Live',
    liveMode: 'Live',
    liveUpdatesLabel: 'Toggle live updates',
    memory: 'Memory',
    mesh: 'Mesh',
    noDownloadData: 'No download data',
    noIp: 'no ip',
    noPassword: 'No password',
    noTopologySample: 'No topology sample yet',
    noUploadData: 'No upload data',
    noWifiSample: 'No Wi-Fi sample yet',
    nodes: 'nodes',
    offline: 'Offline',
    online: 'Online',
    root: 'root',
    startTime: 'Start time',
    staticMode: 'Static',
    timeRange: 'Time range',
    total: 'Total',
    traffic: 'Traffic',
    trafficChart: 'Traffic chart',
    upload: 'Upload',
    up: 'Up',
    uptime: 'Uptime',
    wanDown: 'WAN Down',
    wanAggregate: 'WAN aggregate',
    wanTraffic: 'WAN Traffic',
    wanUp: 'WAN Up',
    zoomOut: '↩ Zoom out',
    loading: 'Loading…',
    waitingSamples: 'Waiting for traffic samples',
    detailDataCleaned: 'Detail data not available — raw samples are kept for {days} days (MIROUTER_RETENTION_DET_DAYS)',
    notEnoughData: 'Not enough data: {current} / {required} points',
    wifi: 'Wi-Fi',
    xiaomiRouter: 'Xiaomi Router'
  },
  zh: {
    accumulated: '累计',
    accumulatedDown: '累计下载',
    accumulatedUp: '累计上传',
    allRouterTraffic: '全部路由流量',
    apply: '应用',
    bands: '频段',
    bucket: '粒度',
    clients: '客户端',
    collectNow: '立即采集',
    collecting: '采集中',
    connecting: '连接中',
    databaseSize: 'SQLite 数据大小',
    down: '下载',
    downstreamUpstream: '下载与上传吞吐',
    endTime: '结束时间',
    error: '错误',
    filterClients: '筛选客户端',
    latest: '实时',
    live: '在线',
    liveMode: '实时',
    liveUpdatesLabel: '切换实时更新',
    memory: '内存',
    mesh: 'Mesh',
    noDownloadData: '暂无下载数据',
    noIp: '无 IP',
    noPassword: '缺少密码',
    noTopologySample: '暂无拓扑样本',
    noUploadData: '暂无上传数据',
    noWifiSample: '暂无 Wi-Fi 样本',
    nodes: '节点',
    offline: '离线',
    online: '在线',
    root: '主节点',
    startTime: '开始时间',
    staticMode: '静态',
    timeRange: '时间范围',
    total: '总计',
    traffic: '流量',
    trafficChart: '流量图表',
    upload: '上传',
    up: '上传',
    uptime: '运行时长',
    wanDown: 'WAN 下载',
    wanAggregate: 'WAN 汇总',
    wanTraffic: 'WAN 流量',
    wanUp: 'WAN 上传',
    zoomOut: '↩ 缩小',
    loading: '加载中…',
    waitingSamples: '等待流量样本',
    detailDataCleaned: '详细数据不可用 — 原始样本保留 {days} 天（MIROUTER_RETENTION_DET_DAYS）',
    notEnoughData: '数据不足：{current} / {required} 个数据点',
    wifi: 'Wi-Fi',
    xiaomiRouter: '小米路由器'
  }
};
const themeNames = {
  en: {
    'light-warm': 'Light Warm',
    'light-sage': 'Light Sage',
    'light-paper': 'Light Paper',
    'dark-ember': 'Dark Ember',
    'dark-forest': 'Dark Forest',
    'dark-graphite': 'Dark Graphite'
  },
  zh: {
    'light-warm': '浅色暖调',
    'light-sage': '浅色鼠尾草',
    'light-paper': '浅色纸白',
    'dark-ember': '深色余烬',
    'dark-forest': '深色森林',
    'dark-graphite': '深色石墨'
  }
};

const pieColors = [
  'var(--down)',
  'var(--up)',
  '#d58a64',
  '#6f7f4f',
  '#9d6a89',
  '#b08a3c',
  '#5f79a8',
  '#a75d5d',
  '#6f8f8a',
  '#c7b29f'
];
const pieHitCache = new WeakMap(); // canvas → { segments, cx, cy, radius, innerRadius }
const minChartRateBytes = 10 * 1024;
const maxChartPoints = 1500;
const MIN_RANGE_POINTS = { '1h': 30, '1d': 30, '7d': 24, '30d': 15 };
const rowHtmlCache = new WeakMap();

applyLanguage();
applyTheme();

function formatRate(value) {
  return `${formatBytes(value)}/s`;
}

function rateAxisScale(maxValue) {
  const units = [
    { label: 'KB/s', divisor: 1024 },
    { label: 'MB/s', divisor: 1024 * 1024 },
    { label: 'GB/s', divisor: 1024 * 1024 * 1024 }
  ];
  let unit = units[0];
  for (const candidate of units) {
    if (maxValue >= candidate.divisor) unit = candidate;
  }
  return unit;
}

function bytesAxisScale(maxValue) {
  const units = [
    { label: 'KB', divisor: 1024 },
    { label: 'MB', divisor: 1024 * 1024 },
    { label: 'GB', divisor: 1024 * 1024 * 1024 },
    { label: 'TB', divisor: 1024 * 1024 * 1024 * 1024 }
  ];
  let unit = units[0];
  for (const candidate of units) {
    if (maxValue >= candidate.divisor) unit = candidate;
  }
  return unit;
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
  const units = ['KB', 'MB', 'GB'];
  let scaled = Math.max(0, Number(value) || 0) / 1024;
  let unit = 0;
  while (scaled >= 1024 && unit < units.length - 1) {
    scaled /= 1024;
    unit += 1;
  }
  const digits = scaled >= 100 ? 0 : scaled >= 10 ? 1 : 2;
  return `${scaled.toFixed(digits)} ${units[unit]}`;
}

function formatStorageSize(value) {
  const units = ['KB', 'MB', 'GB'];
  let scaled = Math.max(0, Number(value) || 0) / 1024;
  let unit = 0;
  while (scaled >= 1024 && unit < units.length - 1) {
    scaled /= 1024;
    unit += 1;
  }
  const digits = unit === 0 ? 1 : 2;
  return `${scaled.toFixed(digits)} ${units[unit]}`;
}

function usageByMac() {
  return new Map((state.usage?.clients ?? []).map((client) => [client.mac, client]));
}

function restoreClientMetricPreference() {
  state.clientMetric = localStorage.getItem('mirouter.clientMetric') === 'latest' ? 'latest' : 'accumulated';
}

function saveClientMetricPreference() {
  localStorage.setItem('mirouter.clientMetric', state.clientMetric);
}

function restoreLanguagePreference() {
  const saved = localStorage.getItem('mirouter.lang');
  state.lang = saved === 'zh' ? 'zh' : 'en';
}

function saveLanguagePreference() {
  localStorage.setItem('mirouter.lang', state.lang);
}

function restoreThemePreference() {
  const allowedThemes = new Set([
    'light-warm',
    'light-sage',
    'light-paper',
    'dark-ember',
    'dark-forest',
    'dark-graphite'
  ]);
  const saved = localStorage.getItem('mirouter.theme');
  state.theme = allowedThemes.has(saved) ? saved : 'light-warm';
}

function saveThemePreference() {
  localStorage.setItem('mirouter.theme', state.theme);
}

function t(key) {
  return translations[state.lang]?.[key] ?? translations.en[key] ?? key;
}

function applyLanguage() {
  document.documentElement.lang = state.lang === 'zh' ? 'zh-CN' : 'en';
  els.langToggle.textContent = state.lang === 'zh' ? 'EN' : '中文';
  els.langToggle.setAttribute('aria-label', state.lang === 'zh' ? 'Switch to English' : '切换到中文');
  els.refreshButton.title = t('collectNow');
  els.refreshButton.setAttribute('aria-label', t('collectNow'));
  els.collectorStatus.setAttribute('aria-label', t('liveUpdatesLabel'));
  els.databaseSize.title = t('databaseSize');
  els.chart.setAttribute('aria-label', t('trafficChart'));
  updateThemeLabels();
  document.querySelectorAll('[data-i18n]').forEach((item) => {
    item.textContent = t(item.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach((item) => {
    item.placeholder = t(item.dataset.i18nPlaceholder);
  });
  document.querySelectorAll('[data-i18n-aria-label]').forEach((item) => {
    item.setAttribute('aria-label', t(item.dataset.i18nAriaLabel));
  });
  document.querySelectorAll('[data-i18n-title]').forEach((item) => {
    item.title = t(item.dataset.i18nTitle);
  });
  syncRangeButtonStates();
}

function applyTheme() {
  document.documentElement.dataset.theme = state.theme;
  els.themeSelect.value = state.theme;
}

function updateThemeLabels() {
  els.themeSelect.querySelectorAll('option').forEach((option) => {
    option.textContent = themeNames[state.lang]?.[option.value] ?? themeNames.en[option.value] ?? option.textContent;
  });
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

function isFixedRange() {
  return state.range === 'custom';
}

function effectiveClientMetric() {
  return isFixedRange() ? 'accumulated' : state.clientMetric;
}

async function loadAll() {
  const firstLoad = state.series.length === 0;

  if (isFixedRange() && !firstLoad) {
    // In fixed range after initial load: only refresh live stat cards, leave client list and chart frozen.
    state.summary = await getJson('/api/summary');
    renderSummary();
    return;
  }

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
  state.chartLoading = true;
  renderChart();
  const params = buildRangeParams();
  params.set('maxPoints', String(maxPointsForRange(state.range)));
  if (state.selectedMac) params.set('mac', state.selectedMac);
  const usageParams = buildRangeParams();
  const [seriesPayload, usagePayload] = await Promise.all([
    getJson(`/api/series?${params}`),
    getJson(`/api/usage?${usageParams}`)
  ]);
  state.chartLoading = false;
  state.series = seriesPayload.points ?? [];
  state.seriesBucket = Number(seriesPayload.bucket) || 0;
  state.hasBand = seriesPayload.hasBand ?? false;
  state.usage = usagePayload;
  state.hoverIndex = null;
  els.bucketInfo.textContent = seriesPayload.bucket ? `${t('bucket')} ${formatDuration(seriesPayload.bucket)}` : '';
  hideChartTooltip();
  renderClients();
  renderChart();
  renderUsageCharts();
  syncWorkspaceHeights();
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
  const pollSeconds = Math.max(1, Number(state.summary?.settings?.pollSeconds) || 30);
  const presets = { '15m': 900, '1h': 3600, '1d': 86400, '7d': 604800, '30d': 2592000 };
  const seconds = range === 'custom'
    ? Math.max(1, (state.customTo || 0) - (state.customFrom || 0))
    : presets[range] ?? 900;

  // Mirror the tier map in db.js seriesTier()
  if (seconds < 1800) return Math.min(maxChartPoints, Math.ceil(seconds / pollSeconds)); // raw
  if (seconds <= 86400) return Math.min(maxChartPoints, Math.ceil(seconds / 60));        // _1m
  if (seconds < 30 * 86400) return Math.min(maxChartPoints, Math.ceil(seconds / 3600)); // _1h
  return Math.min(maxChartPoints, Math.ceil(seconds / 86400));                           // _1d
}

function currentRangeSeconds() {
  if (state.range === 'custom' && state.customFrom && state.customTo) {
    return Math.max(1, state.customTo - state.customFrom);
  }
  const ranges = {
    '15m': 900,
    '1h': 3600,
    '1d': 86400,
    '7d': 604800,
    '30d': 2592000
  };
  return ranges[state.range] ?? ranges['15m'];
}

function useDailyStackedBars() {
  return currentRangeSeconds() >= 30 * 86400;
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

  const allowed = new Set(['15m', '1h', '1d', '7d', '30d', 'custom']);
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

function restoreLiveUpdatePreference() {
  state.liveUpdates = localStorage.getItem('mirouter.liveUpdates') !== 'false';
}

function saveLiveUpdatePreference() {
  localStorage.setItem('mirouter.liveUpdates', String(state.liveUpdates));
}

function syncRangeButtonStates() {
  const rangePoints = state.summary?.rangePoints ?? {};
  els.rangeControl.querySelectorAll('button[data-range]').forEach((btn) => {
    const range = btn.dataset.range;
    const required = MIN_RANGE_POINTS[range];
    if (!required) return;
    const current = Number(rangePoints[range]) || 0;
    const ok = current >= required;
    btn.disabled = !ok;
    btn.title = ok ? '' : t('notEnoughData')
      .replace('{current}', current)
      .replace('{required}', required);
  });
}

function syncZoomOutButton() {
  els.zoomOutButton.hidden = state.prevRanges.length === 0;
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
    ? `${hardware.displayName || t('xiaomiRouter')} · ${hardware.platform || ''}`.trim()
    : t('xiaomiRouter');
  els.databaseSize.textContent = formatStorageSize(state.summary.database?.sizeBytes);

  els.collectorStatus.classList.remove('ok', 'error');
  els.collectorStatus.setAttribute('aria-pressed', String(state.liveUpdates));
  if (!settings.hasToken && !settings.canRefreshToken) {
    els.collectorStatus.textContent = t('noPassword');
    els.collectorStatus.classList.add('error');
    els.collectorStatus.title = state.liveUpdates ? t('liveMode') : t('staticMode');
  } else if (collector.lastError) {
    els.collectorStatus.textContent = t('offline');
    els.collectorStatus.classList.add('error');
    els.collectorStatus.title = `${state.liveUpdates ? t('liveMode') : t('staticMode')}: ${collector.lastError}`;
  } else {
    els.collectorStatus.textContent = state.liveUpdates ? t('liveMode') : t('staticMode');
    els.collectorStatus.classList.add('ok');
    els.collectorStatus.title = t('liveUpdatesLabel');
  }

  els.wanDown.textContent = formatRate(latest?.wan_down_bps);
  els.wanUp.textContent = formatRate(latest?.wan_up_bps);
  els.onlineCount.textContent = latest ? `${latest.online_count}/${latest.all_count}` : '--';
  els.cpuLoad.textContent = latest ? `${Math.round(latest.cpu_load * 100)}%` : '--';
  els.memoryUsage.textContent = latest ? `${Math.round(latest.mem_usage * 100)}%` : '--';
  els.uptime.textContent = latest ? formatDuration(latest.uptime_seconds) : '--';

  renderMesh(lastSnapshot?.topo);
  renderWifi(lastSnapshot?.wifi);
  syncRangeButtonStates();
  scheduleRefresh(settings.pollSeconds);
}

function scheduleRefresh(pollSeconds) {
  if (!state.liveUpdates) {
    if (state.refreshTimer) clearInterval(state.refreshTimer.id);
    state.refreshTimer = null;
    return;
  }
  const refreshMs = Math.max(1000, (Number(pollSeconds) || 30) * 1000);
  if (state.refreshTimer?.refreshMs === refreshMs) return;
  if (state.refreshTimer) clearInterval(state.refreshTimer.id);

  state.refreshTimer = {
    refreshMs,
    id: setInterval(() => {
      loadAll().catch(() => {});
    }, refreshMs)
  };
}

function clientRowInnerHtml(name, meta, upRate, downRate, upTotal, downTotal, volume, maxVolume, showAccumulated) {
  return `<span class="client-text"><span class="client-name">${escapeHtml(name)}</span><span class="client-meta">${escapeHtml(meta)}</span></span><span class="client-traffic">${trafficLine('up', upRate, upTotal, showAccumulated)}${trafficLine('down', downRate, downTotal, showAccumulated)}</span>${volumeBar(volume, maxVolume, showAccumulated)}`;
}

function setRowHtml(el, html) {
  if (rowHtmlCache.get(el) === html) return;
  el.innerHTML = html;
  rowHtmlCache.set(el, html);
}

function renderClients() {
  const query = els.clientSearch.value.trim().toLowerCase();
  const usage = usageByMac();
  const totalDown = Number(state.usage?.down?.total) || 0;
  const totalUp = Number(state.usage?.up?.total) || 0;
  const showAccumulated = effectiveClientMetric() !== 'latest';
  els.clientMetricToggle.disabled = isFixedRange();
  const aggregateVolume = showAccumulated
    ? totalDown + totalUp
    : Number(state.summary?.latest?.wan_down_bps || 0) + Number(state.summary?.latest?.wan_up_bps || 0);
  const clientVolume = (client) => {
    const totals = usage.get(client.mac);
    return showAccumulated
      ? Number(totals?.down_bytes || 0) + Number(totals?.up_bytes || 0)
      : Number(client.down_bps || 0) + Number(client.up_bps || 0);
  };
  const clients = state.clients
    .filter((client) => {
      const haystack = `${client.name} ${client.oname} ${client.ip} ${client.mac}`.toLowerCase();
      return haystack.includes(query);
    })
    .sort((a, b) => clientVolume(b) - clientVolume(a));
  const maxVolume = Math.max(1, aggregateVolume, ...clients.map(clientVolume));

  els.clientTotal.textContent = `${state.clients.length} ${t('total')}`;
  els.clientMetricToggle.textContent = showAccumulated ? t('accumulated') : t('latest');
  els.clientMetricToggle.setAttribute('aria-pressed', String(showAccumulated));

  // Build desired row descriptors
  const desired = [
    {
      mac: '',
      active: state.selectedMac === '',
      html: clientRowInnerHtml(
        t('wanAggregate'), t('allRouterTraffic'),
        state.summary?.latest?.wan_up_bps || 0,
        state.summary?.latest?.wan_down_bps || 0,
        totalUp, totalDown, aggregateVolume, maxVolume, showAccumulated
      )
    },
    ...clients.map((client) => {
      const totals = usage.get(client.mac);
      return {
        mac: client.mac,
        active: client.mac === state.selectedMac,
        html: clientRowInnerHtml(
          client.name || client.oname || client.mac,
          `${client.ip || t('noIp')} · ${client.mac}`,
          client.up_bps, client.down_bps,
          totals?.up_bytes || 0, totals?.down_bytes || 0,
          clientVolume(client), maxVolume, showAccumulated
        )
      };
    })
  ];

  // Collect existing row elements keyed by mac
  const existing = new Map();
  for (const el of els.clientList.children) {
    existing.set(el.dataset.mac, el);
  }

  // Reconcile: update content, reorder in-place — never touches clientList.innerHTML
  for (let i = 0; i < desired.length; i++) {
    const { mac, active, html } = desired[i];
    let el = existing.get(mac);
    if (el) {
      existing.delete(mac);
    } else {
      el = document.createElement('button');
      el.className = 'client-row';
      el.dataset.mac = mac;
    }
    setRowHtml(el, html);
    el.classList.toggle('active', active);
    const slot = els.clientList.children[i];
    if (el !== slot) els.clientList.insertBefore(el, slot ?? null);
  }

  // Remove rows no longer in the list
  for (const el of existing.values()) el.remove();

  syncWorkspaceHeights();
}

let _syncRafId = null;
let _syncSavedScroll = 0;

function syncWorkspaceHeights() {
  // Only capture scroll on the first call in a burst — subsequent calls within the
  // same frame would see a layout-shifted (zero) scroll after height is cleared.
  if (_syncRafId === null) _syncSavedScroll = els.clientList.scrollTop;

  els.sidePanel.style.height = '';
  els.sidePanel.style.maxHeight = '';

  if (_syncRafId !== null) cancelAnimationFrame(_syncRafId);

  if (window.matchMedia('(max-width: 1100px)').matches) {
    _syncRafId = null;
    return;
  }

  _syncRafId = requestAnimationFrame(() => {
    _syncRafId = null;
    const chartHeight = els.chartPanel.getBoundingClientRect().height;
    if (chartHeight <= 0) return;
    els.sidePanel.style.height = `${chartHeight}px`;
    els.sidePanel.style.maxHeight = `${chartHeight}px`;
    els.clientList.scrollTop = _syncSavedScroll;
  });
}

function volumeBar(value, maxValue, showAccumulated) {
  const segmentCount = 16;
  const activeSegments = Math.max(0, Math.min(segmentCount, Math.round((Number(value) || 0) / Math.max(1, maxValue) * segmentCount)));
  const label = showAccumulated ? formatBytes(value) : formatRate(value);
  return `
    <span class="volume-bar" aria-label="${escapeHtml(t('traffic'))} ${escapeHtml(label)}">
      ${Array.from({ length: segmentCount }, (_, index) => `
        <span class="${index < activeSegments ? 'active' : ''}"></span>
      `).join('')}
    </span>
  `;
}

function cssColor(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function pieColor(index) {
  const color = pieColors[index % pieColors.length];
  if (color.startsWith('var(')) {
    return cssColor(color.slice(4, -1));
  }
  return color;
}

function trafficLine(direction, rate, total, showAccumulated) {
  const isUp = direction === 'up';
  return `
    <span class="traffic-line ${direction}">
      <span class="traffic-value">${escapeHtml(showAccumulated ? formatBytes(total) : formatRate(rate))}</span>
      <span class="traffic-direction" aria-label="${isUp ? t('upload') : t('down')}">${isUp ? '↑' : '↓'}</span>
    </span>
  `;
}

function renderMesh(topo) {
  const graph = topo?.graph;
  const leafs = graph?.leafs ?? [];
  els.meshStatus.textContent = graph ? `${leafs.length + 1} ${t('nodes')}` : '--';
  if (!graph) {
    els.meshList.innerHTML = `<div>${escapeHtml(t('noTopologySample'))}</div>`;
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
      <span>${escapeHtml(node.link_type || t('root'))} · ${escapeHtml(node.onlines ?? 0)} ${escapeHtml(t('online'))}</span>
    </div>
  `).join('');
}

function renderWifi(wifi) {
  const bands = wifi?.info ?? [];
  els.wifiStatus.textContent = bands.length ? `${bands.length} ${t('bands')}` : '--';
  if (!bands.length) {
    els.wifiList.innerHTML = `<div>${escapeHtml(t('noWifiSample'))}</div>`;
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

function emptyChartMessage() {
  const span = currentRangeSeconds();
  const tier = span < 1800 ? 'raw' : span <= 86400 ? '1m' : span < 30 * 86400 ? '1h' : '1d';
  if (isFixedRange() && (tier === 'raw' || tier === '1m')) {
    const retDays = Number(state.summary?.settings?.retentionDetDays) || 7;
    const now = Math.floor(Date.now() / 1000);
    if (state.customTo < now - retDays * 86400) {
      return t('detailDataCleaned').replace('{days}', retDays);
    }
  }
  return t('waitingSamples');
}

function renderChart() {
  const selected = state.clients.find((client) => client.mac === state.selectedMac);
  els.chartTitle.textContent = selected ? selected.name || selected.mac : t('wanTraffic');
  els.chartSubtitle.textContent = selected
    ? `${selected.ip || t('noIp')} · ${selected.mac}`
    : t('downstreamUpstream');

  if (state.chartLoading) {
    els.emptyChart.textContent = t('loading');
    els.emptyChart.classList.add('show');
    return;
  }

  const points = state.series;
  const dailyBars = useDailyStackedBars();
  const minRequired = dailyBars ? 1 : 2;
  const isEmpty = points.length < minRequired;
  els.emptyChart.classList.toggle('show', isEmpty);
  if (isEmpty) {
    els.emptyChart.textContent = emptyChartMessage();
  }

  const canvas = els.chart;
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.floor(rect.width * dpr));
  canvas.height = Math.max(1, Math.floor(rect.height * dpr));
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, rect.width, rect.height);

  const pad = { top: 28, right: 18, bottom: 30, left: 60 };
  const width = rect.width - pad.left - pad.right;
  const height = rect.height - pad.top - pad.bottom;
  state.chartGeometry = null;
  drawGrid(ctx, rect, pad, width, height);
  if (isEmpty) return;
  const maxY = dailyBars
    ? Math.max(1024, ...points.map((p) => (Number(p.down_bytes) || 0) + (Number(p.up_bytes) || 0)))
    : Math.max(minChartRateBytes, ...points.flatMap((p) => [
        Number(p.down_bps) || 0, Number(p.up_bps) || 0,
        ...(state.hasBand ? [Number(p.max_down_bps) || 0, Number(p.max_up_bps) || 0] : [])
      ]));
  const minT = points[0].ts;
  const maxT = points[points.length - 1].ts;

  const x = (ts) => pad.left + ((ts - minT) / Math.max(1, maxT - minT)) * width;
  const y = (value) => pad.top + height - ((Number(value) || 0) / maxY) * height;
  state.chartGeometry = { pad, width, height, maxY, minT, maxT, mode: dailyBars ? 'daily-bars' : 'line' };

  drawAxisLabels(ctx, pad, width, height, maxY, minT, maxT, dailyBars ? 'bytes' : 'rate');
  if (dailyBars) {
    drawStackedBars(ctx, points, x, y, width);
    drawBarHover(ctx, points, x, y, pad, height);
    drawZoomSelection(ctx, pad, height);
    return;
  }
  if (state.hasBand) {
    drawBand(ctx, points, x, y, 'min_down_bps', 'max_down_bps', cssColor('--down'));
    drawBand(ctx, points, x, y, 'min_up_bps', 'max_up_bps', cssColor('--up'));
  }
  drawLine(ctx, points, x, y, 'down_bps', cssColor('--down'));
  drawLine(ctx, points, x, y, 'up_bps', cssColor('--up'));
  drawHover(ctx, points, x, y, pad, height);
  drawZoomSelection(ctx, pad, height);
}

function renderUsageCharts() {
  renderPie({
    canvas: els.usageDownChart,
    legend: els.usageDownLegend,
    total: els.usageDownTotal,
    data: state.usage?.down,
    emptyLabel: t('noDownloadData')
  });
  renderPie({
    canvas: els.usageUpChart,
    legend: els.usageUpLegend,
    total: els.usageUpTotal,
    data: state.usage?.up,
    emptyLabel: t('noUploadData')
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
            <span class="pie-swatch" style="background:${pieColor(index)}"></span>
            <span class="pie-name-wrap">
              <span class="pie-name">${escapeHtml(item.name)}</span>
              <span class="pie-meter">
                <span style="width:${Math.min(100, Math.max(0, percent))}%; background:${pieColor(index)}"></span>
              </span>
            </span>
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
    ctx.fillStyle = cssColor('--surface-2');
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = cssColor('--control');
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.58, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  let start = -Math.PI / 2;
  const segments = [];
  items.forEach((item, index) => {
    const angle = (item.bytes / sum) * Math.PI * 2;
    const color = pieColor(index);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, radius, start, start + angle);
    ctx.closePath();
    ctx.fill();
    segments.push({ item, color, start, end: start + angle, percent: (item.bytes / sum) * 100 });
    start += angle;
  });
  pieHitCache.set(canvas, { segments, cx, cy, radius, innerRadius: radius * 0.58 });

  ctx.fillStyle = cssColor('--control');
  ctx.beginPath();
  ctx.arc(cx, cy, radius * 0.58, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = cssColor('--ink');
  ctx.font = '700 13px Inter, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(formatBytes(sum), cx, cy);
}

function drawGrid(ctx, rect, pad, width, height) {
  ctx.strokeStyle = cssColor('--grid');
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i <= 4; i += 1) {
    const y = pad.top + (height / 4) * i;
    ctx.moveTo(pad.left, y);
    ctx.lineTo(pad.left + width, y);
  }
  ctx.stroke();
  ctx.strokeStyle = cssColor('--line-strong');
  ctx.strokeRect(pad.left, pad.top, width, height);
}

function drawAxisLabels(ctx, pad, width, height, maxY, minT, maxT, mode = 'rate') {
  const scale = mode === 'bytes' ? bytesAxisScale(maxY) : rateAxisScale(maxY);
  ctx.fillStyle = '#7d7065';
  ctx.font = '12px Inter, system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (let i = 0; i <= 4; i += 1) {
    const value = maxY - (maxY / 4) * i;
    ctx.fillText(String(Math.round(value / scale.divisor)), pad.left - 8, pad.top + (height / 4) * i);
  }
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(scale.label, pad.left, 8);
  ctx.textBaseline = 'top';
  ctx.fillText(formatTime(minT), pad.left + 40, pad.top + height + 10);
  ctx.textAlign = 'right';
  ctx.fillText(formatTime(maxT), pad.left + width, pad.top + height + 10);
}

function drawStackedBars(ctx, points, x, y, width) {
  const slot = width / Math.max(1, points.length);
  const barWidth = Math.max(2, Math.min(18, slot * 0.7));
  points.forEach((point) => {
    const down = Number(point.down_bytes) || 0;
    const up = Number(point.up_bytes) || 0;
    const total = down + up;
    if (total <= 0) return;
    const cx = x(point.ts);
    const left = cx - barWidth / 2;
    const baseY = y(0);
    const downY = y(down);
    const totalY = y(total);

    ctx.fillStyle = cssColor('--down');
    ctx.fillRect(left, downY, barWidth, baseY - downY);
    ctx.fillStyle = cssColor('--up');
    ctx.fillRect(left, totalY, barWidth, downY - totalY);
  });
}

function drawBarHover(ctx, points, x, y, pad, height) {
  if (state.hoverIndex === null || !points[state.hoverIndex]) return;
  const point = points[state.hoverIndex];
  const total = (Number(point.down_bytes) || 0) + (Number(point.up_bytes) || 0);
  const px = x(point.ts);
  const topY = y(total);

  ctx.save();
  ctx.strokeStyle = 'rgba(45, 36, 29, 0.3)';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(px, pad.top);
  ctx.lineTo(px, pad.top + height);
  ctx.stroke();
  ctx.setLineDash([]);
  drawPoint(ctx, px, topY, cssColor('--accent-2'));
  ctx.restore();
}

function drawBand(ctx, points, x, y, minKey, maxKey, color) {
  if (points.length < 2) return;
  ctx.save();
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x(points[0].ts), y(Number(points[0][maxKey]) || 0));
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(x(points[i].ts), y(Number(points[i][maxKey]) || 0));
  }
  for (let i = points.length - 1; i >= 0; i--) {
    ctx.lineTo(x(points[i].ts), y(Number(points[i][minKey]) || 0));
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawZoomSelection(ctx, pad, height) {
  if (!state.drag || state.drag.currentX === undefined) return;
  const left = Math.min(state.drag.startX, state.drag.currentX);
  const right = Math.max(state.drag.startX, state.drag.currentX);
  if (right - left < 2) return;
  ctx.save();
  ctx.fillStyle = cssColor('--accent');
  ctx.globalAlpha = 0.08;
  ctx.fillRect(left, pad.top, right - left, height);
  ctx.globalAlpha = 0.5;
  ctx.strokeStyle = cssColor('--accent');
  ctx.lineWidth = 1;
  ctx.strokeRect(left, pad.top, right - left, height);
  ctx.restore();
}

function drawLine(ctx, points, x, y, key, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  let hasStarted = false;
  const maxGapSeconds = Math.max(1, state.seriesBucket || 1) * 2;
  points.forEach((point, index) => {
    if (point[key] === null || point[key] === undefined) {
      hasStarted = false;
      return;
    }
    if (index > 0 && point.ts - points[index - 1].ts > maxGapSeconds) {
      hasStarted = false;
    }
    const px = x(point.ts);
    const py = y(point[key]);
    if (!hasStarted) {
      ctx.moveTo(px, py);
      hasStarted = true;
    }
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
  drawPoint(ctx, px, downY, cssColor('--down'));
  drawPoint(ctx, px, upY, cssColor('--up'));
  ctx.restore();
}

function drawPoint(ctx, x, y, color) {
  ctx.fillStyle = cssColor('--surface');
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

function formatTime(ts) {
  return new Date(ts * 1000).toLocaleString(state.lang === 'zh' ? 'zh-CN' : 'en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatTooltipTime(ts) {
  return new Date(ts * 1000).toLocaleString(state.lang === 'zh' ? 'zh-CN' : 'en-US', {
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
  const { pad, width, height, maxY, minT, maxT, mode } = state.chartGeometry;
  const x = pad.left + ((point.ts - minT) / Math.max(1, maxT - minT)) * width;
  const dailyBars = mode === 'daily-bars';
  const totalBytes = (Number(point.down_bytes) || 0) + (Number(point.up_bytes) || 0);
  const downY = pad.top + height - ((Number(point.down_bps) || 0) / maxY) * height;
  const upY = pad.top + height - ((Number(point.up_bps) || 0) / maxY) * height;
  const barY = pad.top + height - (totalBytes / maxY) * height;
  const y = dailyBars ? barY : Math.min(downY, upY);

  els.chartTooltip.innerHTML = `
    <div class="tooltip-time">${escapeHtml(formatTooltipTime(point.ts))}</div>
    <div class="tooltip-row">
      <span class="tooltip-label down">${escapeHtml(t('down'))}</span>
      <span class="tooltip-value">${escapeHtml(dailyBars ? formatBytes(point.down_bytes) : formatRate(point.down_bps))}</span>
    </div>
    <div class="tooltip-row">
      <span class="tooltip-label up">${escapeHtml(t('up'))}</span>
      <span class="tooltip-value">${escapeHtml(dailyBars ? formatBytes(point.up_bytes) : formatRate(point.up_bps))}</span>
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
  } else {
    state.prevRanges = [];
  }
  syncRangeControls();
  syncZoomOutButton();
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
  state.prevRanges = [];
  state.range = 'custom';
  state.customFrom = from;
  state.customTo = to;
  syncRangeControls();
  syncZoomOutButton();
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
els.clientMetricToggle.addEventListener('click', () => {
  state.clientMetric = state.clientMetric === 'latest' ? 'accumulated' : 'latest';
  saveClientMetricPreference();
  renderClients();
});
els.langToggle.addEventListener('click', () => {
  state.lang = state.lang === 'zh' ? 'en' : 'zh';
  saveLanguagePreference();
  applyLanguage();
  if (state.summary) renderSummary();
  renderClients();
  renderChart();
  renderUsageCharts();
  syncWorkspaceHeights();
});
els.themeSelect.addEventListener('change', () => {
  state.theme = els.themeSelect.value;
  saveThemePreference();
  applyTheme();
  renderChart();
  renderUsageCharts();
  syncWorkspaceHeights();
});
els.refreshButton.addEventListener('click', async () => {
  els.collectorStatus.textContent = t('collecting');
  await getJson('/api/collect', { method: 'POST' });
  await loadAll();
});

els.collectorStatus.addEventListener('click', () => {
  state.liveUpdates = !state.liveUpdates;
  saveLiveUpdatePreference();
  if (state.summary) {
    renderSummary();
  }
});

els.chart.addEventListener('mousedown', (event) => {
  if (!state.chartGeometry || state.series.length < 2) return;
  const rect = els.chart.getBoundingClientRect();
  const mouseX = event.clientX - rect.left;
  const { pad, width, minT, maxT } = state.chartGeometry;
  if (mouseX < pad.left || mouseX > pad.left + width) return;
  const ts = minT + ((mouseX - pad.left) / width) * Math.max(1, maxT - minT);
  state.drag = { startX: mouseX, startTs: ts, currentX: mouseX };
  hideChartTooltip();
  event.preventDefault();
});

els.chart.addEventListener('mousemove', (event) => {
  if (state.drag) {
    const rect = els.chart.getBoundingClientRect();
    state.drag.currentX = event.clientX - rect.left;
    renderChart();
    return;
  }
  updateChartHover(event);
});

document.addEventListener('mouseup', (event) => {
  if (!state.drag) return;
  const { startX, startTs, currentX } = state.drag;
  state.drag = null;
  if (Math.abs(currentX - startX) < 10) {
    renderChart();
    return;
  }
  const { pad, width, minT, maxT } = state.chartGeometry;
  const endTs = minT + ((currentX - pad.left) / width) * Math.max(1, maxT - minT);
  const from = Math.round(Math.min(startTs, endTs));
  const to = Math.round(Math.max(startTs, endTs));
  if (to <= from + 10) {
    renderChart();
    return;
  }
  state.prevRanges.push({ range: state.range, customFrom: state.customFrom, customTo: state.customTo });
  state.range = 'custom';
  state.customFrom = from;
  state.customTo = to;
  syncRangeControls();
  syncZoomOutButton();
  saveRangePreference();
  loadSeries().catch(() => {});
});

els.zoomOutButton.addEventListener('click', () => {
  if (state.prevRanges.length === 0) return;
  const prev = state.prevRanges.pop();
  state.range = prev.range;
  state.customFrom = prev.customFrom;
  state.customTo = prev.customTo;
  syncRangeControls();
  syncZoomOutButton();
  saveRangePreference();
  loadSeries().catch(() => {});
});

els.chart.addEventListener('mouseleave', () => {
  if (state.drag) return;
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
  syncWorkspaceHeights();
});

function hitTestPie(canvas, event) {
  const data = pieHitCache.get(canvas);
  if (!data || !data.segments.length) return null;
  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  const dx = x - data.cx;
  const dy = y - data.cy;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist > data.radius || dist < data.innerRadius) return null;
  let angle = Math.atan2(dy, dx);
  if (angle < -Math.PI / 2) angle += Math.PI * 2;
  return data.segments.find((seg) => angle >= seg.start && angle < seg.end) ?? null;
}

function showPieTooltip(seg, event) {
  els.pieTooltip.innerHTML = `
    <div class="pie-tooltip-name">
      <span class="pie-tooltip-swatch" style="background:${seg.color}"></span>${escapeHtml(seg.item.name)}
    </div>
    <div class="pie-tooltip-row">
      <span>${escapeHtml(formatBytes(seg.item.bytes))}</span>
      <span>${seg.percent.toFixed(seg.percent >= 10 ? 0 : 1)}%</span>
    </div>
  `;
  els.pieTooltip.classList.add('show');
  positionPieTooltip(event);
}

function positionPieTooltip(event) {
  const tip = els.pieTooltip;
  const tw = tip.offsetWidth;
  const th = tip.offsetHeight;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const x = event.clientX + 14 + tw > vw ? event.clientX - tw - 14 : event.clientX + 14;
  const y = Math.min(Math.max(event.clientY - th / 2, 8), vh - th - 8);
  tip.style.left = `${x}px`;
  tip.style.top = `${y}px`;
}

function hidePieTooltip() {
  els.pieTooltip.classList.remove('show');
}

for (const canvas of [els.usageDownChart, els.usageUpChart]) {
  canvas.addEventListener('mousemove', (event) => {
    const seg = hitTestPie(canvas, event);
    if (seg) {
      showPieTooltip(seg, event);
      canvas.style.cursor = 'pointer';
    } else {
      hidePieTooltip();
      canvas.style.cursor = '';
    }
  });
  canvas.addEventListener('mouseleave', () => {
    hidePieTooltip();
    canvas.style.cursor = '';
  });
}

loadAll().catch((error) => {
  els.collectorStatus.textContent = t('error');
  els.collectorStatus.classList.add('error');
  els.collectorStatus.title = error.message;
});
