const app = Vue.createApp({
  data() {
    return {
      charts: [],
      chartId: 0,
    };
  },
  mounted() {
    AOS.init({ once: true });
    lucide.createIcons();
    window.addEventListener('resize', this.renderAll);
  },
  methods: {
    addChart() {
      this.charts.push({
        id: this.chartId++,
        title: `報表 ${this.charts.length + 1}`,
        xAxis: ['Q1', 'Q2', 'Q3'],
        series: [{ name: '系列 A', type: 'bar', data: [120, 200, 150] }]
      });

      // 確保可以延遲後展示
      setTimeout(() => {
        this.renderAll();
      }, 50); 
    },
    removeChart(index) {
      this.charts.splice(index, 1);
      setTimeout(() => {
        this.renderAll();
      }, 50);
    },
    clearAll() {
      this.charts = [];
    },
    renderAll() {
      this.charts.forEach((chart, i) => {
        const el = document.getElementById(`chart-${i}`);
        if (!el) return;

        const instance = echarts.init(el);
        instance.setOption({
          animation: false,
          tooltip: {},
          xAxis: { type: 'category', data: chart.xAxis },
          yAxis: { type: 'value' },
          series: chart.series,
          grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true }
        });
         instance.resize();
      });
    }
  }
});

app.component('draggable', vuedraggable);
app.mount('#app');
