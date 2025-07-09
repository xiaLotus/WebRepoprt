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
      charts: []
    };
  },

  mounted() {
    this.fetchOptions();
    this.loadSavedCharts();
    AOS.init({ once: true }); 
  },

  methods: {
    /* 取得三層選單 */
    async fetchOptions() {
      const res = await fetch(api.options).then(r => r.json());
      this.options = res;
    },

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
    },

    /* 清除全部 */
    async clearAll() {
      await fetch(api.charts, { method: 'DELETE' });
      this.charts = [];
    },

    /* 逐張渲染 */
    renderAll() {
      this.charts.forEach((c, i) => this.renderChart(i, c));
      lucide.createIcons();
    },

    renderChart (index, chart) {
      const dom = document.getElementById(`chart-${index}`);
      if (!dom) return;

      let ins = echarts.getInstanceByDom(dom);
      if (!ins) ins = echarts.init(dom);

      ins.setOption({
        tooltip: { trigger: 'axis' },
        animation: false,
        grid: { left: 40, right: 20, top: 30, bottom: 40 },
        xAxis: { type: 'category', data: chart.xAxis },
        yAxis: { type: 'value' },
        series: chart.series
      });

      /* ⭐ 關鍵：排進版面後再 resize，確保寬度 > 0 */
      requestAnimationFrame(() => ins.resize());
    }
  }
});

app.component('draggable', vuedraggable);
app.mount('#app');
