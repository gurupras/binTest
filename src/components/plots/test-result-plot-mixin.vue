<script>
import { mapGetters } from 'vuex'

export default {
  name: 'test-result-plot-mixin',
  computed: {
    ...mapGetters([
      'temperaturePlotDefaultOptions'
    ])
  },
  methods: {
    getPlotOptions (exptData) {
      var ret = JSON.parse(JSON.stringify(this.temperaturePlotDefaultOptions))
      const xAxis = ret.scales.xAxes[0]
      xAxis.time = {
        unit: 'minute'
      }
      // We need to start all plots from the same timestamp
      xAxis.ticks = xAxis.ticks || {}
      xAxis.ticks.min = exptData.rawData.temperatureData.timestamps[0]
      xAxis.ticks.max = exptData.rawData.temperatureData.timestamps[exptData.rawData.temperatureData.timestamps.length - 1]
      // xAxis.ticks.suggestedMin = xAxis.ticks.min
      // xAxis.ticks.suggestedMax = xAxis.ticks.max
      return ret
    }
  }
}
</script>
