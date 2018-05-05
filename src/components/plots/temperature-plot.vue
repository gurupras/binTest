<script>
import { mapGetters } from 'vuex'
import { Line } from 'vue-chartjs'
// import merge from 'deepmerge'
// const { reactiveProp } = mixins

export default {
  name: 'temperature-plot',
  extends: Line,
  props: {
    temperatureData: {
      type: Object,
      required: true
    },
    options: {
      type: Object,
      default: function () {
        return this.$store.getters.temperaturePlotDefaultOptions
      }
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
      data.labels = this.temperatureData.labels
      data.datasets[0].data = this.temperatureData.data
      this.renderChart(data, this.options)
    }
  },
  mounted: function () {
    this.plot()
  }
}
</script>
