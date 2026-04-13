const { performance } = require('perf_hooks');

class LatencyMonitor {
  constructor() {
    this.requests = [];
  }

  trackRequest(duration) {
    this.requests.push(duration);
    if (this.requests.length > 100) this.requests.shift(); // Mantém últimos 100 registros
  }

  getP95() {
    if (this.requests.length === 0) return 0;
    const sorted = [...this.requests].sort((a, b) => a - b);
    const index = Math.ceil(0.95 * sorted.length) - 1;
    return sorted[index];
  }
}

module.exports = LatencyMonitor;
