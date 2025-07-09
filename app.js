/* app.js */
const api = {
  options: 'http://127.0.0.1:5000/api/options',
  storages: 'http://127.0.0.1:5000/api/filtered-data',
  charts: 'http://127.0.0.1:5000/api/charts'
};

const app = Vue.createApp({
  data() {
    return {
      options: { buildings: [], floors: [], stations: [] },
      storageOptions: [],
      filters: { building: '', floor: '', station: '', storage: '' },
      charts: [],
      chartMap: new Map(),   // <id, echartsInstance>
      colorMap: {
        'L121-C1': '#4caf50',
        'L121-C2': '#2196f3',
        'L122-D1': '#f44336',
        'L123-A3': '#ff9800'
        // 依實際儲格名擴充...
      }
    };
  },


  mounted () {
    this.fetchOptions();
    this.loadSavedCharts();

    // 🎯 全域 resize（含瀏覽器縮放）
    const debounce = (fn, ms = 200) => {
      let tid;
      return (...args) => {
        clearTimeout(tid);
        tid = setTimeout(() => fn(...args), ms);
      };
    };

    const handleResize = debounce(() => {
      this.chartMap.forEach((ins) => ins.resize());
    }, 200);

    window.addEventListener('resize', handleResize);
    AOS.init({ once: true });
  },
methods: {
    /* 三層選單任一改變 → 重新抓儲格清單 */
    async onFilterChange() {
      this.filters.storage = '';       // 清掉舊選擇
      const { building, floor, station } = this.filters;

      // 少任何一層先不查
      if (!building || !floor || !station) {
        this.storageOptions = [];
        return;
      }

      const params = new URLSearchParams({ building, floor, station });
      const res = await fetch(`${api.storages}?${params}`).then(r => r.json());
      this.storageOptions = res.storages;
    },
    async fetchOptions() {
      const res = await fetch(api.options).then(r => r.json());
      this.options = res;
    },
    /* 讀取已存在的圖表設定並渲染 */
    async loadSavedCharts() {
      this.charts = await fetch(api.charts).then(r => r.json());
      this.$nextTick(this.renderAll);
    },

    /* 加入新圖表 */
    async addChart() {
      const { building, floor, station, storage } = this.filters;
      if (!storage) return; // double-check

      const body = {
        棟別: building,
        樓層: floor,
        站點: station,
        儲格: storage
      };

      const res = await fetch(api.charts, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        alert('⚠️ 後端找不到資料或格式錯誤');
        return;
      }

      const chart = await res.json();
      chart.expanded = false;
      this.charts.push(chart);

      this.$nextTick(() => {
        const idx = this.charts.length - 1;
        this.renderChart(idx, chart); // 先畫
        AOS.refresh();                // 再讓 AOS 動畫生效
       });
    },

    /* 刪除單張 */
    async removeChart(idx) {
      const chart = this.charts[idx];
      await fetch(`${api.charts}/${chart.id}`, { method: 'DELETE' });
      this.charts.splice(idx, 1);
      this.chartMap.delete(chart.id);
    },

    /* 清除全部 */
    async clearAll() {
      await fetch(api.charts, { method: 'DELETE' });
      this.charts = [];
      this.chartMap.clear();
    },

    /* 逐張渲染 */
async renderAll() {
  this.charts.forEach((c, i) => this.renderChart(i, c));
  lucide.createIcons();

  // 🧠 將目前的順序與 expanded 狀態送到後端儲存
  await fetch('http://127.0.0.1:5000/api/charts-order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(this.charts.map(c => ({ id: c.id, expanded: c.expanded })))
  });
},
renderChart(index, chart) {
  const dom = document.getElementById(`chart-${chart.id}`);
  if (!dom) return;

  let instance = echarts.getInstanceByDom(dom);
  if (instance) instance.dispose();
  instance = echarts.init(dom);

  instance.setOption({
    tooltip: { trigger: 'axis' },
    animation: false,
    grid: { left: 40, right: 20, top: 30, bottom: 40 },
    xAxis: { type: 'category', data: chart.xAxis },
    yAxis: { type: 'value' },
    series: chart.series.map(s => ({
      ...s,
      type: 'bar',
      itemStyle: {
        color: this.colorMap[chart.儲格] || '#607d8b'
      }
    }))
  });

  this.chartMap.set(chart.id, instance);

  // 💡 resize 保險再補一次
  setTimeout(() => {
    instance.resize({ animation: false });
  }, 500);
},
toggleSize(index) {
  const chart = this.charts[index];
  chart.expanded = !chart.expanded;

  // PATCH 儲存狀態
  fetch(`${api.charts}/${chart.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ expanded: chart.expanded })
  });

  this.$nextTick(() => {
    const tryRender = (retry = 10) => {
      const dom = document.getElementById(`chart-${chart.id}`);
      if (!dom) {
        console.warn(`❌ 找不到 DOM chart-${chart.id}`);
        return;
      }

      if (retry <= 0) {
        console.warn(`⚠️ 無法重繪 chart-${chart.id}`);
        return;
      }

      if (dom.offsetWidth === 0 || dom.offsetHeight === 0) {
        requestAnimationFrame(() => tryRender(retry - 1));
      } else {
        const oldInstance = echarts.getInstanceByDom(dom);
        if (oldInstance) oldInstance.dispose();
        this.renderChart(index, chart);
      }
    };

    setTimeout(() => {
      requestAnimationFrame(() => tryRender());
    }, 1000); // 避開 transition 或 DOM reflow
  });
}

  }
});

app.component('draggable', vuedraggable);
app.mount('#app');
