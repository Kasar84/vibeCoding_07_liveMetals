/**
 * MetalMarket - Chart.js Manager
 * Handles sparklines and the 4 vertical independent metal charts
 */

const ChartManager = (() => {
  // Chart instances registry
  const chartInstances = {
    sparklines: {},
    vertical: {}
  };

  // Color configurations for metals
  const THEMES = {
    XAU: {
      borderColor: '#f59e0b',
      fillStart: 'rgba(245, 158, 11, 0.35)',
      fillEnd: 'rgba(245, 158, 11, 0.0)',
      pointBg: '#fbbf24',
      pointBorder: '#78350f'
    },
    XAG: {
      borderColor: '#cbd5e1',
      fillStart: 'rgba(203, 213, 225, 0.3)',
      fillEnd: 'rgba(203, 213, 225, 0.0)',
      pointBg: '#f8fafc',
      pointBorder: '#334155'
    },
    XCU: {
      borderColor: '#f97316',
      fillStart: 'rgba(249, 115, 22, 0.35)',
      fillEnd: 'rgba(249, 115, 22, 0.0)',
      pointBg: '#fb923c',
      pointBorder: '#7c2d12'
    },
    XPT: {
      borderColor: '#06b6d4',
      fillStart: 'rgba(6, 182, 212, 0.35)',
      fillEnd: 'rgba(6, 182, 212, 0.0)',
      pointBg: '#38bdf8',
      pointBorder: '#164e63'
    }
  };

  /**
   * Helper to format numbers with currency
   */
  function formatCurrency(val, currency = 'USD') {
    if (currency === 'KRW') {
      return '₩' + Math.round(val).toLocaleString('ko-KR');
    }
    return '$' + Number(val).toLocaleString('en-US', {
      minimumFractionDigits: val < 10 ? 3 : 2,
      maximumFractionDigits: val < 10 ? 3 : 2
    });
  }

  /**
   * Render or update a mini sparkline chart on a card
   */
  function renderSparkline(canvasId, dataPoints, symbol) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    if (chartInstances.sparklines[canvasId]) {
      chartInstances.sparklines[canvasId].destroy();
    }

    const theme = THEMES[symbol] || THEMES.XAU;
    const isUp = dataPoints[dataPoints.length - 1] >= dataPoints[0];
    const lineColor = isUp ? '#10b981' : '#f43f5e';

    const gradient = ctx.createLinearGradient(0, 0, 0, 50);
    gradient.addColorStop(0, isUp ? 'rgba(16, 185, 129, 0.25)' : 'rgba(244, 63, 94, 0.25)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

    chartInstances.sparklines[canvasId] = new Chart(ctx, {
      type: 'line',
      data: {
        labels: dataPoints.map((_, i) => i + 1),
        datasets: [{
          data: dataPoints,
          borderColor: lineColor,
          borderWidth: 2,
          fill: true,
          backgroundColor: gradient,
          tension: 0.35,
          pointRadius: 0,
          pointHoverRadius: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { enabled: false }
        },
        scales: {
          x: { display: false },
          y: { display: false }
        },
        animation: { duration: 600 }
      }
    });
  }

  /**
   * Render or update one of the main vertical independent charts
   */
  function renderVerticalChart(canvasId, timeframeData, symbol, currency = 'USD') {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    if (chartInstances.vertical[canvasId]) {
      chartInstances.vertical[canvasId].destroy();
    }

    const theme = THEMES[symbol] || THEMES.XAU;
    const dataValues = currency === 'KRW' ? timeframeData.dataKrw : timeframeData.dataUsd;

    // Create height-matched background gradient
    const chartHeight = canvas.parentElement.clientHeight || 340;
    const gradient = ctx.createLinearGradient(0, 0, 0, chartHeight);
    gradient.addColorStop(0, theme.fillStart);
    gradient.addColorStop(0.7, theme.fillEnd);
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

    chartInstances.vertical[canvasId] = new Chart(ctx, {
      type: 'line',
      data: {
        labels: timeframeData.labels,
        datasets: [{
          label: `${symbol} 시세`,
          data: dataValues,
          borderColor: theme.borderColor,
          borderWidth: 2.5,
          fill: true,
          backgroundColor: gradient,
          tension: 0.32,
          pointBackgroundColor: theme.pointBg,
          pointBorderColor: theme.pointBorder,
          pointBorderWidth: 2,
          pointRadius: 3.5,
          pointHoverRadius: 7,
          pointHoverBackgroundColor: '#ffffff',
          pointHoverBorderColor: theme.borderColor,
          pointHoverBorderWidth: 3
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          intersect: false,
          mode: 'index'
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(15, 23, 42, 0.92)',
            titleColor: '#94a3b8',
            bodyColor: '#f8fafc',
            borderColor: 'rgba(255, 255, 255, 0.15)',
            borderWidth: 1,
            padding: 12,
            boxPadding: 6,
            usePointStyle: true,
            cornerRadius: 10,
            callbacks: {
              title: function(items) {
                return items[0].label + ' 일자 시세';
              },
              label: function(context) {
                const val = context.raw;
                return ` ${formatCurrency(val, currency)}`;
              }
            }
          }
        },
        scales: {
          x: {
            grid: {
              color: 'rgba(255, 255, 255, 0.05)',
              drawBorder: false
            },
            ticks: {
              color: '#64748b',
              font: { family: "'Plus Jakarta Sans', sans-serif", size: 11 },
              maxRotation: 0,
              autoSkip: true,
              maxTicksLimit: 8
            }
          },
          y: {
            grid: {
              color: 'rgba(255, 255, 255, 0.05)',
              drawBorder: false
            },
            ticks: {
              color: '#94a3b8',
              font: { family: "'Plus Jakarta Sans', sans-serif", size: 11 },
              callback: function(value) {
                return formatCurrency(value, currency);
              }
            }
          }
        },
        animation: {
          duration: 750,
          easing: 'easeOutQuart'
        }
      }
    });
  }

  return {
    renderSparkline,
    renderVerticalChart,
    formatCurrency
  };
})();
