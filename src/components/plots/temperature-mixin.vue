<script>
import { mapGetters } from 'vuex'
import utils from '@/js/utils'
export default {
  computed: {
    ...mapGetters([
      'temperaturePlotDefaultOptions'
    ])
  },
  data () {
    return {
    }
  },
  methods: {
    temperaturePlotDataset (exptData) {
      return [{
        data: this.fixTemperatureDataForPlot(exptData.rawData.temperatureData)
      }]
    },
    fixTemperatureDataForPlot (data) {
      const datasetData = []
      if (data.timestamps.length !== data.temperatures.length) {
        throw new Error('Number of timestamps !== number of temperatures')
      }
      const temperatures = utils.customMedianFilter(data.temperatures, 9)
      data.timestamps.forEach((x, idx) => {
        const y = temperatures[idx]
        datasetData.push({x, y})
      })
      return datasetData
    }
  }
}
</script>
