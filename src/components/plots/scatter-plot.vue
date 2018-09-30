<script>
import { mapGetters } from 'vuex'
import { Scatter } from 'vue-chartjs'
// import merge from 'deepmerge'
// const { reactiveProp } = mixins

export default {
  name: 'scatter-plot',
  extends: Scatter,
  props: {
    dataset: {
      type: Array,
      required: true
    },
    options: {
      type: Object,
      default: function () {
        return this.$store.getters.temperaturePlotDefaultOptions
      }
    },
    datasetOptions: {
      type: Object,
      default () {
        return {
          useDatasetFromProp: false // If fase, uses datasets[0].data instead
        }
      }
    },
    beforePlotCallback: {
      type: Function,
      default: undefined
    }
  },
  computed: {
    ...mapGetters([
      'temperaturePlotDefaultData',
      'temperaturePlotDefaultOptions'
    ])
  },
  // mixins: [reactiveProp],
  data: function () {
    return {
    }
  },
  watch: {
    temperatureData: function (v) {
      this.plot()
    }
  },
  methods: {
    plot () {
      const data = Object.assign({}, this.temperaturePlotDefaultData)
      if (this.datasetOptions.useDatasetFromProp) {
        data.datasets = this.dataset
      } else {
        data.datasets[0].data = this.dataset[0].data
      }

      if (this.beforePlotCallback) {
        this.beforePlotCallback(data)
      }
      this.renderChart(data, this.options)
    }
  },
  mounted: function () {
    this.plot()
  }
}
</script>
