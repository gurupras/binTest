<script>
import axios from 'axios'
import { Bar } from 'vue-chartjs'
import KellyColors from '@/components/common/kelly-colors-mixin'

export default {
  name: 'stacked-frequency-plot',
  extends: Bar,
  mixins: [KellyColors],
  props: {
    experimentIds: {
      type: Array,
      default () {
        return []
      }
    },
    cpus: {
      type: [String, Array],
      default: 'all'
    }
  },
  watch: {
    experimentIds () {
      this.forceRefresh()
    },
    cpus () {
      this.plot()
    }
  },
  data () {
    return {
      experimentData: undefined
    }
  },
  methods: {
    async forceRefresh () {
      this.experimentData = await this.getStackedFrequencyData()
      this.plot()
    },
    shortExperimentID (experimentID) {
      return experimentID.substr(0, 4)
    },
    async getStackedFrequencyData () {
      const response = await axios.get('/plot/plot-frequency-comparison', {
        params: {
          experimentIDs: this.experimentIds
        }
      })
      return response.data
    },
    plot () {
      var cpus
      if (this.cpus === 'all') {
        // We're going to assume that the number of CPUs is equal in all experiments
        cpus = Object.keys(this.experimentData[this.experimentIds[0]].freqData)
      } else {
        // We have specific number of CPUs
        cpus = this.cpus
      }

      /* Pseudo-code
      Iterate over e1-c0
      Treat each frequency as a dataset
      Iterate over e1-c2
      Treat each frequency as a dataset, however, if a frequency already
      exists in the dataset, re-use it
      Do the same for all other experiment-cpu combination
      */
      const allFrequencies = new Set()
      const labels = []
      for (const experimentID of this.experimentIds) {
        for (const cpu of cpus) {
          labels.push(`${this.shortExperimentID(experimentID)}-cpu${cpu}`)
          const { freqData } = this.experimentData[experimentID]
          const frequencies = Object.keys(freqData[cpu])
          frequencies.forEach(freq => allFrequencies.add(freq))
        }
      }

      var datasets = []
      const frequencies = Array.from(allFrequencies)
      frequencies.sort((a, b) => Number(b) - Number(a))
      frequencies.forEach((frequency, idx) => {
        const dataset = {
          label: frequency,
          // stack: cpu,
          backgroundColor: this.colors[idx],
          data: []
        }
        for (const experimentID of this.experimentIds) {
          const { freqData } = this.experimentData[experimentID]
          for (const cpu of cpus) {
            const timeSpent = freqData[cpu][frequency] || 0
            dataset.data.push(timeSpent)
          }
        }
        datasets.push(dataset)
      }, this)

      datasets = datasets.filter(dataset => dataset.data.find(x => x > 0))
      this.renderChart({
        labels,
        datasets
      }, {
        title: {
          display: true,
          text: 'Stacked Frequency Comparison'
        },
        legend: {
          display: false
        },
        barPercentage: 0.1,
        categoryPercentage: 1.0,
        tooltips: {
          mode: 'index',
          intersect: false,
          filter (tooltipItem, data) {
            const datasetIndex = tooltipItem.datasetIndex
            const dataIndex = tooltipItem.index
            return data.datasets[datasetIndex].data[dataIndex] !== 0
          }
        },
        responsive: true,
        scales: {
          xAxes: [{
            stacked: true
          }],
          yAxes: [{
            stacked: true
          }]
        }
      })
    }
  },
  async mounted () {
    console.log(`Being remounted`)
    await this.forceRefresh()
  }
}
</script>
