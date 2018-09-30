<script>
import { mapGetters } from 'vuex'

import KellyColorsMixin from '@/components/common/kelly-colors-mixin'
import VoltagePlotWorker from '@/js/workers/voltage-plot.worker'
import TestResultPlotMixin from '@/components/plots/test-result-plot-mixin'

export default {
  mixins: [KellyColorsMixin, TestResultPlotMixin],
  computed: {
    ...mapGetters([
      'temperaturePlotDefaultOptions',
      'temperaturePlotDefaultDataset'
    ]),
    voltagePlotDatasetOptions () {
      return {
        useDatasetFromProp: true
      }
    },
    hasVoltageData () {
      return !!this.voltageData
    }
  },
  data () {
    return {
      voltageData: undefined,
      voltagePlotData: undefined,
      voltagePlotOptions: undefined
    }
  },
  methods: {
    updateVoltagePlotOptions (exptData) {
      const options = this.getPlotOptions(exptData)
      options.scales.yAxes[0].ticks.beginAtZero = false
      this.voltagePlotOptions = options
      return options
    },
    async loadVoltageData (data) {
      const self = this
      this.updateVoltagePlotOptions(data)

      const worker = new VoltagePlotWorker()
      return new Promise((resolve, reject) => {
        worker.onmessage = ({ data: { voltageData } }) => {
          self.voltageData = voltageData
          resolve(voltageData)
        }
        worker.postMessage({
          exptData: data,
          defaultDataset: JSON.parse(JSON.stringify(this.temperaturePlotDefaultDataset))
        })
      })
    }
  }
}
</script>
