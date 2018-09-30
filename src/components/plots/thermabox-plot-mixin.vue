<script>
import { mapGetters } from 'vuex'
import TemperatureMixin from '@/components/plots/temperature-mixin'
import TestResultPlotMixin from '@/components/plots/test-result-plot-mixin'

export default {
  mixins: [TemperatureMixin, TestResultPlotMixin],
  data () {
    return {
      thermaboxData: undefined,
      thermaboxPlotOptions: undefined
    }
  },
  computed: {
    ...mapGetters([
      'temperaturePlotDefaultDataset'
    ]),
    thermaboxPlotDatasetOptions () {
      return {
        useDatasetFromProp: true
      }
    },
    hasThermaboxData () {
      return !!this.thermaboxData
    }
  },
  methods: {
    updateThermaboxPlotOptions (exptData) {
      const ret = this.getPlotOptions(exptData)
      const yAxis = ret.scales.yAxes[0]
      yAxis.ticks.beginAtZero = false
      const { rawData: { thermaboxData } } = exptData
      const temperature = thermaboxData.limits.temperature
      const threshold = thermaboxData.limits.threshold
      yAxis.ticks.suggestedMax = temperature + (threshold * 2.0)
      yAxis.ticks.suggestedMin = temperature - (threshold * 2.0)
      ret.layout = {
        padding: {
          left: 22
          // right: 87
        }
      }
      Object.assign(ret, {
        legend: {
          labels: {
            filter (item, chart) {
              return !!item.text
            }
          }
        }
      })
      ret.tooltips.filter = ({ index, xLabel, yLabel, datasetIndex }, data) => {
        return !!yLabel
      }
      this.thermaboxPlotOptions = ret
      return ret
    },
    getThermaboxColorForState (state) {
      switch (state.toUpperCase()) {
        case 'HEATING_UP':
          return '#f00'
        case 'STABLE':
          return '#0f0'
        case 'COOLING_DOWN':
          return '#00f'
      }
    },
    roundupTemperature (temp) {
      return Number(temp.toFixed(1))
    },
    loadThermaboxData (data) {
      if (!data.rawData.thermaboxData) {
        return
      }
      const tboxData = data.rawData.thermaboxData.data

      const datasetMap = {}
      var prevState = tboxData[0].state
      const currentData = {
        timestamps: [],
        temperatures: []
      }

      const addCurrentDataToDataset = () => {
        // State changed
        // Dump the currentData as a dataset and start a new one
        const datasetData = this.fixTemperatureDataForPlot(currentData)
        var firstEntry = false
        if (!datasetMap[prevState]) {
          datasetMap[prevState] = []
          firstEntry = true
        }
        // Create a new dataset entry
        const dataset = JSON.parse(JSON.stringify(this.temperaturePlotDefaultDataset))
        const color = this.getThermaboxColorForState(prevState)
        Object.assign(dataset, {
          label: firstEntry ? prevState : null,
          borderColor: color,
          backgroundColor: color,
          data: datasetData
        })
        datasetMap[prevState].push(dataset)
        // Reset currentData
        Object.assign(currentData, {
          timestamps: [],
          temperatures: []
        })
      }

      tboxData.forEach(({ timestamp, temperature, state }) => {
        if (prevState !== state) {
          addCurrentDataToDataset.bind(this).apply()
          prevState = state
        }
        currentData.timestamps.push(timestamp)
        currentData.temperatures.push(temperature)
      }, this)

      addCurrentDataToDataset.bind(this).apply()

      const thermaboxDatasets = []
      Object.entries(datasetMap).forEach(([state, datasets]) => {
        thermaboxDatasets.push(...datasets)
      })

      // Update plot options before setting thermaboxData
      this.updateThermaboxPlotOptions(data)

      this.thermaboxData = {
        raw: data.rawData.thermaboxData,
        processed: thermaboxDatasets
      }
    },
    modifyThermaboxData (data) {
      // data.datasets[0].label = 'Thermabox Temperature'
    }
  }
}
</script>
