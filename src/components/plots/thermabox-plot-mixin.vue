<script>
export default {
  data () {
    return {
      hasThermaboxData: false,
      thermaboxData: undefined
    }
  },
  computed: {
    thermaboxPlotOptions () {
      const ret = this.temperaturePlotOptions
      const yAxis = ret.scales.yAxes[0]
      yAxis.ticks.beginAtZero = false
      const thermaboxData = this.thermaboxData.raw
      const temperature = thermaboxData.limits.temperature
      const threshold = thermaboxData.limits.threshold
      yAxis.ticks.suggestedMax = temperature + (threshold * 2.0)
      yAxis.ticks.suggestedMin = temperature - (threshold * 2.0)
      // We need to start both plots from the same timestamp
      const xAxis = ret.scales.xAxes[0]
      xAxis.ticks = xAxis.ticks || {}
      xAxis.ticks.min = this.testResult.rawData.temperatureData.timestamps[0]
      xAxis.ticks.max = this.testResult.rawData.temperatureData.timestamps[this.testResult.rawData.temperatureData.timestamps.length - 1]
      xAxis.ticks.suggestedMin = xAxis.ticks.min
      xAxis.ticks.suggestedMax = xAxis.ticks.max
      return ret
    }
  },
  methods: {
    roundupTemperature (temp) {
      return Number(temp.toFixed(1))
    },
    loadThermaboxData (data) {
      const self = this
      if (data.rawData.thermaboxData) {
        self.hasThermaboxData = true
        const tboxData = data.rawData.thermaboxData.data
        // We only have thermabox data for the workload phase
        // But, the other plot starts from earlier
        // So, we add the first timestamp of the other plot into thermabox data
        const tboxTimestamps = [data.rawData.temperatureData.timestamps[0]]
        const tboxTemperatures = [self.roundupTemperature(tboxData[0].temperature)]
        tboxData.forEach(entry => {
          tboxTimestamps.push(entry.timestamp)
          tboxTemperatures.push(self.roundupTemperature(entry.temperature))
        })
        self.thermaboxData = {
          raw: data.rawData.thermaboxData,
          processed: self.fixTemperatureDataForPlot({
            timestamps: tboxTimestamps,
            temperatures: tboxTemperatures
          })
        }
      }
    },
    modifyThermaboxData (data) {
      data.datasets[0].label = 'Thermabox Temperature'
    }
  }
}
</script>
