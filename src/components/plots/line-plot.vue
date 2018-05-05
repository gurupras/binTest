<script>
import { Line } from 'vue-chartjs'
// import merge from 'deepmerge'
// const { reactiveProp } = mixins

export default {
  name: 'temperature-plot',
  extends: Line,
  props: {
    labels: {
      type: Array,
      required: true
    },
    data: {
      type: Object,
      required: true
    },
    options: {
      type: Object,
      default: function () {
        return {
        }
      }
    }
  },
  watch: {
    data (v) {
      this.plot()
    }
  },
  methods: {
    plot () {
      const data = Object.assign({}, this.data)
      data.labels = this.labels
      this.renderChart(data, this.options)
    }
  },
  mounted: function () {
    this.plot()
  }
}
</script>
