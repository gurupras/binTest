<script>
export default {
  methods: {
    fixTemperatureDataForPlot (data) {
      const chartjsData = {
        labels: [],
        data: []
      }
      chartjsData.labels = data.timestamps
      chartjsData.data = data.temperatures
      return chartjsData
    }
  }
}
</script>
