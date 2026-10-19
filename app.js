/**
 * MetalMarket - Main Application Controller
 */

// Application State
const AppState = {
  currency: 'KRW',    // 기본값: KRW (원화 ₩)
  unit: 'oz',         // 'oz', 'g', 'don'
  period: '5d',       // '5d', '1w', '1m', '3m', '1y'
  latestData: null,
  timeframeData: {},
  countdown: 60,
  countdownTimer: null
};

/**
 * Initialize Application
 */
document.addEventListener('DOMContentLoaded', async () => {
  initEventListeners();
  startCountdown();
  await refreshDashboard(true);
  initCalculator();
});

/**
 * Initialize Event Listeners
 */
function initEventListeners() {
  // Currency Toggle Buttons
  document.getElementById('btn-currency-usd').addEventListener('click', () => setCurrency('USD'));
  document.getElementById('btn-currency-krw').addEventListener('click', () => setCurrency('KRW'));

  // Unit Toggle Buttons
  document.getElementById('btn-unit-oz').addEventListener('click', () => setUnit('oz'));
  document.getElementById('btn-unit-g').addEventListener('click', () => setUnit('g'));
  document.getElementById('btn-unit-don').addEventListener('click', () => setUnit('don'));

  // Period Selector Buttons
  const periodBtns = document.querySelectorAll('#period-buttons-group .period-btn');
  periodBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      periodBtns.forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      const period = e.target.getAttribute('data-period');
      setPeriod(period);
    });
  });

  // Manual Refresh Button
  document.getElementById('btn-manual-refresh').addEventListener('click', async () => {
    const btn = document.getElementById('btn-manual-refresh');
    btn.classList.add('spinning');
    await refreshDashboard(true);
    setTimeout(() => btn.classList.remove('spinning'), 800);
    showToast('최신 시세 데이터로 즉시 갱신되었습니다.');
  });

  // Calculator inputs
  document.getElementById('calc-metal-select').addEventListener('change', updateCalculator);
  document.getElementById('calc-weight-input').addEventListener('input', updateCalculator);
  document.getElementById('calc-unit-select').addEventListener('change', updateCalculator);
}

/**
 * Currency Switcher
 */
function setCurrency(currency) {
  if (AppState.currency === currency) return;
  AppState.currency = currency;

  document.getElementById('btn-currency-usd').classList.toggle('active', currency === 'USD');
  document.getElementById('btn-currency-krw').classList.toggle('active', currency === 'KRW');

  updateCardsUI();
  updateAllCharts();
  updateCalculator();
}

/**
 * Unit Switcher
 */
function setUnit(unit) {
  if (AppState.unit === unit) return;
  AppState.unit = unit;

  document.getElementById('btn-unit-oz').classList.toggle('active', unit === 'oz');
  document.getElementById('btn-unit-g').classList.toggle('active', unit === 'g');
  document.getElementById('btn-unit-don').classList.toggle('active', unit === 'don');

  updateCardsUI();
  updateCalculator();
}

/**
 * Period Switcher
 */
async function setPeriod(period) {
  if (AppState.period === period) return;
  AppState.period = period;
  await loadAndRenderCharts();
}

/**
 * Refresh full dashboard data
 */
async function refreshDashboard(force = false) {
  try {
    const data = await MetalApi.fetchLatestPrices(force);
    AppState.latestData = data;

    // Update Status Badge
    const statusText = document.getElementById('api-status-text');
    if (data.isRealApi) {
      statusText.textContent = 'API 실시간 연동됨';
    } else {
      statusText.textContent = '글로벌 벤치마크 모드';
    }

    // Update Timestamp with Real-time FX Rate
    const updateTimeEl = document.getElementById('update-time-text');
    const updateDate = new Date(data.timestamp);
    const timeStr = updateDate.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const formattedKrw = Number(data.krwUsdRate).toLocaleString('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    updateTimeEl.innerHTML = `마지막 갱신: ${timeStr} <span class="fx-rate-tag">실시간 환율: 1 USD = <strong>${formattedKrw} KRW</strong></span>`;

    // Render Top Cards
    updateCardsUI();

    // Render Vertical Charts
    await loadAndRenderCharts();

    // Update Calculator
    updateCalculator();

    // Reset countdown
    AppState.countdown = 60;
  } catch (err) {
    console.error('Error refreshing dashboard:', err);
    showToast('시세 데이터를 불러오는 중 문제가 발생했습니다.');
  }
}

/**
 * Update Top 4 Metal Cards
 */
function updateCardsUI() {
  if (!AppState.latestData) return;

  const { metals, krwUsdRate } = AppState.latestData;
  const currency = AppState.currency;
  const unit = AppState.unit;

  const unitLabels = {
    oz: '/ oz',
    g: '/ g',
    don: '/ 돈 (3.75g)'
  };

  ['XAU', 'XAG', 'XCU', 'XPT'].forEach(symbol => {
    const metal = metals[symbol];
    if (!metal) return;

    const lowerSym = symbol.toLowerCase();
    
    // Converted Price
    const convertedPrice = MetalApi.convertPrice(metal.priceUsd, unit, symbol, krwUsdRate, currency);
    const convertedLow = MetalApi.convertPrice(metal.dayLowUsd, unit, symbol, krwUsdRate, currency);
    const convertedHigh = MetalApi.convertPrice(metal.dayHighUsd, unit, symbol, krwUsdRate, currency);

    // Format display
    document.getElementById(`price-${lowerSym}`).textContent = ChartManager.formatCurrency(convertedPrice, currency);
    
    // Special unit label for copper if industrial lb
    let label = unitLabels[unit];
    if (symbol === 'XCU' && unit === 'oz') {
      label = '/ lb';
    }
    document.getElementById(`unit-label-${lowerSym}`).textContent = label;

    // Update symbol currency tag
    const symbolTag = document.querySelector(`#card-${lowerSym} .symbol-tag`);
    if (symbolTag) {
      symbolTag.textContent = `${symbol} / ${currency}`;
    }

    // Change badge
    const badgeEl = document.getElementById(`change-badge-${lowerSym}`);
    const diffEl = document.getElementById(`diff-xau`) ? document.getElementById(`diff-${lowerSym}`) : null;
    const isUp = metal.changePercent >= 0;
    
    badgeEl.className = `change-badge ${isUp ? 'up' : 'down'}`;
    badgeEl.textContent = `${isUp ? '▲ +' : '▼ '}${metal.changePercent.toFixed(2)}%`;

    if (diffEl) {
      const convertedDiff = MetalApi.convertPrice(Math.abs(metal.changeAmountUsd), unit, symbol, krwUsdRate, currency);
      diffEl.textContent = `(${isUp ? '+' : '-'}${ChartManager.formatCurrency(convertedDiff, currency)})`;
    }

    // Range display
    document.getElementById(`low-${lowerSym}`).textContent = `Low: ${ChartManager.formatCurrency(convertedLow, currency)}`;
    document.getElementById(`high-${lowerSym}`).textContent = `High: ${ChartManager.formatCurrency(convertedHigh, currency)}`;

    // Range bar position calculation
    const rangeSpan = metal.dayHighUsd - metal.dayLowUsd;
    let percentPos = 50;
    if (rangeSpan > 0) {
      percentPos = Math.max(10, Math.min(95, ((metal.priceUsd - metal.dayLowUsd) / rangeSpan) * 100));
    }
    const rangeFill = document.getElementById(`range-fill-${lowerSym}`);
    if (rangeFill) {
      rangeFill.style.width = `${percentPos.toFixed(0)}%`;
    }

    // Render Sparkline
    ChartManager.renderSparkline(`sparkline-${lowerSym}`, metal.sparkline, symbol);
  });
}

/**
 * Load Timeframe Data and Render all 4 Vertical Charts
 */
async function loadAndRenderCharts() {
  const symbols = ['XAU', 'XAG', 'XCU', 'XPT'];
  const period = AppState.period;

  for (const sym of symbols) {
    try {
      const timeframe = await MetalApi.fetchTimeframe(sym, period);
      AppState.timeframeData[sym] = timeframe;
      renderSingleChart(sym, timeframe);
    } catch (e) {
      console.error(`Failed to load timeframe for ${sym}:`, e);
    }
  }
}

/**
 * Render a single vertical chart & update its statistics
 */
function renderSingleChart(symbol, timeframe) {
  const lowerSym = symbol.toLowerCase();
  const canvasId = `chart-canvas-${lowerSym}`;
  const currency = AppState.currency;

  // Render chart
  ChartManager.renderVerticalChart(canvasId, timeframe, symbol, currency);

  // Update summary stats in header
  const lowVal = currency === 'KRW' ? timeframe.minKrw : timeframe.minUsd;
  const highVal = currency === 'KRW' ? timeframe.maxKrw : timeframe.maxUsd;
  const isUp = timeframe.changePercent >= 0;

  const statLowEl = document.getElementById(`chart-stat-low-${lowerSym}`);
  const statHighEl = document.getElementById(`chart-stat-high-${lowerSym}`);
  const statChangeEl = document.getElementById(`chart-stat-change-${lowerSym}`);

  if (statLowEl) statLowEl.textContent = ChartManager.formatCurrency(lowVal, currency);
  if (statHighEl) statHighEl.textContent = ChartManager.formatCurrency(highVal, currency);
  if (statChangeEl) {
    statChangeEl.className = `stat-value ${isUp ? 'highlight-up' : 'highlight-down'}`;
    statChangeEl.textContent = `${isUp ? '▲ +' : '▼ '}${timeframe.changePercent.toFixed(2)}%`;
  }
}

/**
 * Update all charts on currency change without re-fetching
 */
function updateAllCharts() {
  ['XAU', 'XAG', 'XCU', 'XPT'].forEach(symbol => {
    const timeframe = AppState.timeframeData[symbol];
    if (timeframe) {
      renderSingleChart(symbol, timeframe);
    }
  });
}

/**
 * Smooth scroll to specific chart with highlight pulse
 */
function scrollToChart(containerId) {
  const el = document.getElementById(containerId);
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.style.transition = 'box-shadow 0.4s ease, border-color 0.4s ease';
    el.style.borderColor = 'rgba(245, 158, 11, 0.8)';
    el.style.boxShadow = '0 0 35px rgba(245, 158, 11, 0.35)';
    setTimeout(() => {
      el.style.borderColor = '';
      el.style.boxShadow = '';
    }, 1500);
  }
}

/**
 * Quick Metal Calculator
 */
function initCalculator() {
  updateCalculator();
}

function updateCalculator() {
  if (!AppState.latestData) return;

  const metalSelect = document.getElementById('calc-metal-select');
  const weightInput = document.getElementById('calc-weight-input');
  const unitSelect = document.getElementById('calc-unit-select');

  const symbol = metalSelect.value;
  const weight = parseFloat(weightInput.value) || 0;
  const unit = unitSelect.value;

  const metal = AppState.latestData.metals[symbol];
  if (!metal) return;

  const pricePerUnitUsd = MetalApi.convertPrice(metal.priceUsd, unit, symbol, AppState.latestData.krwUsdRate, 'USD');
  const pricePerUnitKrw = MetalApi.convertPrice(metal.priceUsd, unit, symbol, AppState.latestData.krwUsdRate, 'KRW');

  const totalUsd = pricePerUnitUsd * weight;
  const totalKrw = pricePerUnitKrw * weight;

  const resultCurrencyLabel = document.getElementById('calc-result-currency');
  const resultValueLabel = document.getElementById('calc-result-value');

  if (AppState.currency === 'KRW') {
    resultCurrencyLabel.textContent = `KRW (₩) 기준 (${weight}${unitSelect.options[unitSelect.selectedIndex].text})`;
    resultValueLabel.textContent = ChartManager.formatCurrency(totalKrw, 'KRW');
  } else {
    resultCurrencyLabel.textContent = `USD ($) 기준 (${weight}${unitSelect.options[unitSelect.selectedIndex].text})`;
    resultValueLabel.textContent = ChartManager.formatCurrency(totalUsd, 'USD');
  }
}

/**
 * Automatic 60-second Refresh Countdown
 */
function startCountdown() {
  if (AppState.countdownTimer) clearInterval(AppState.countdownTimer);

  const counterEl = document.getElementById('auto-refresh-counter');
  AppState.countdown = 60;

  AppState.countdownTimer = setInterval(async () => {
    AppState.countdown--;
    if (counterEl) {
      counterEl.textContent = `⏳ ${AppState.countdown}s`;
    }

    if (AppState.countdown <= 0) {
      AppState.countdown = 60;
      await refreshDashboard(false);
    }
  }, 1000);
}

/**
 * Simple Toast Notification
 */
function showToast(message) {
  const toast = document.getElementById('toast-notice');
  const msgEl = document.getElementById('toast-message');
  if (!toast || !msgEl) return;

  msgEl.textContent = message;
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3200);
}
