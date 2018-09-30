<script>
import { mapGetters } from 'vuex'
import { Scatter } from 'vue-chartjs'
import TemperatureMixin from '@/components/plots/temperature-mixin'
import TestResultPlotMixin from '@/components/plots/test-result-plot-mixin'
import utils from '@/js/utils'
import is from 'is_js'

// import moment from 'moment'
// const { reactiveProp } = mixins

export default {
  name: 'experiment-plot',
  mixins: [TemperatureMixin, TestResultPlotMixin],
  extends: Scatter,
  props: {
    experimentData: {
      type: Object,
      required: true
    },
    temperatureDataset: {
      type: Array,
      required: true
    }
  },
  data () {
    return {
      processedExperimentData: undefined,
      annotationStyle: {
        fillStyle: 'rgba(183, 28, 28, 0.8)',
        strokeStyle: 'rgba(183, 28, 28, 0.6)',
        fontSize: is.mobile() ? '0.6em' : '1em',
        font: `"'Helvetica Neue', 'Helvetica', Arial', sans-serif"`
      }
    }
  },
  computed: {
    ...mapGetters([
      'temperaturePlotDefaultOptions',
      'temperaturePlotDefaultData'
    ])
  },
  watch: {
    chartData: function (v) {
      this.plot()
    }
  },
  methods: {
    plotData () {
      const data = JSON.parse(JSON.stringify(this.temperaturePlotDefaultData))

      const tempDataset = data.datasets[0]
      tempDataset.yAxisID = 'tempData'
      tempDataset.data = this.temperatureDataset[0].data
      tempDataset.borderWidth = 1.4

      const exptTimestamps = Object.keys(this.processedExperimentData).map(x => Number(x))
      const exptPerformance = exptTimestamps.map(t => this.processedExperimentData[t], this)
      const filteredExptPerformance = utils.customMedianFilter(exptPerformance, 9)
      const exptData = exptTimestamps.map((t, idx) => ({x: t, y: filteredExptPerformance[idx]}))

      const exptDataset = {
        label: 'Performance',
        yAxisID: 'exptData',
        fill: false,
        lineTension: 0,
        showLine: true,
        spanGaps: true,
        pointRadius: 0,
        data: exptData,
        borderWidth: 1.4,
        borderColor: 'rgba(128, 100, 100, 0.6)',
        backgroundColor: 'rgba(128, 100, 100, 0.6)'
      }

      data.datasets.push(exptDataset)
      return data
    },
    plotOptions (exptData) {
      const opts = this.getPlotOptions(exptData)

      // Fix the temp y axis for dual-y axes
      // Temperature goes on the right
      const tempYAxis = opts.scales.yAxes[0]
      tempYAxis.position = 'left'
      tempYAxis.id = 'tempData'
      tempYAxis.ticks.stepSize = 20.0
      tempYAxis.ticks.fontcolor = 'rgba(0, 153, 255, 0.9)'
      tempYAxis.scaleLabel.fontColor = 'rgba(0, 153, 255, 0.9)'

      // First y-axis is performance..not temperature
      // So insert the new y-axis before the existing one
      const exptYAxis = {
        position: 'right',
        id: 'exptData',
        ticks: {
          beginAtZero: true,
          min: 0
        },
        scaleLabel: {
          display: true,
          labelString: 'Time/Iteration (ms)',
          fontColor: 'rgba(128, 100, 100, 0.6)'
        }
      }
      // Add the exptYAxis in
      opts.scales.yAxes.unshift(exptYAxis)

      // Filter tooltip since performance won't exist everywhere
      Object.assign(opts.tooltips, {
        filter ({ xLabel, yLabel, datasetIndex, index, x, y }, data) {
          const { data: datasetData, yAxisID } = data.datasets[datasetIndex]
          switch (yAxisID) {
            case 'tempData':
              this.ttX = datasetData[index].x // eslint-disable-line vue/no-side-effects-in-computed-properties
              break
            case 'exptData':
            // Find closest performance point. If it's too far, then bail
              const closestTo = this.ttX
              if (!closestTo) {
                console.error('closestTo was undefined')
              }
              delete this.ttX
              const closestPoint = datasetData.reduce((prev, curr) => {
              // return Math.abs(curr.x - closestTo) <= (Math.abs(prev.x - closestTo) ? curr : prev)
                const currDistance = Math.abs(curr.x - closestTo)
                const prevDistance = Math.abs(prev.x - closestTo)
                return currDistance <= prevDistance ? curr : prev
              }, datasetData[0])
              if (Math.abs(closestPoint.x - closestTo) > 2 * 1000) { // Greater than 2 seconds
                return false
              }
              break
          }
          return true
        }
      })

      return opts
    },
    plot () {
      const plotData = this.plotData(this.experimentData)
      const plotOptions = this.plotOptions(this.experimentData)
      this.renderChart(plotData, plotOptions)
    },
    processExptData () {
      var self = this
      const data = this.experimentData.rawData
      this.processedExperimentData = {}
      data.iterations.forEach((entry) => {
        self.processedExperimentData[entry.ft] = entry.tt * 1000 // in ms
      })
      this.plot(data)
    },
    addAnnotation (text, startIndexInLabel, endIndexInLabel, opts) {
      opts = opts || {}

      const chart = this.$data._chart
      const ctx = chart.chart.ctx

      const scales = chart.scales
      const tempYScale = scales['tempData']

      const style = this.annotationStyle
      const fontSize = opts.fontSize || style.fontSize
      // Y is 5% from bottom
      var yOffset = opts.yOffset || (0.05 * (tempYScale.top - tempYScale.bottom))
      const skipLeft = opts.skipLeft
      const skipRight = opts.skipRight
      const drawArrows = opts.drawArrows || true

      // Find the views of these two points
      const elements = chart.getDatasetMeta(1).data
      const startView = elements[startIndexInLabel]._view
      const endView = elements[endIndexInLabel]._view

      ctx.fillStyle = style.fillStyle
      ctx.font = `${fontSize} ${style.font}`
      const textMeasurements = ctx.measureText(text)
      const textWidth = textMeasurements.width
      const availableWidth = endView.x - startView.x
      // Total available space to add this text is endView.x - startView.x
      // Width of text is textWidth and we want to center it
      // So.. |---<text>---|
      // Or, in other words, textWidth + 2x = availableWidth
      // ==> x = (availableWidth - textWidth) / 2
      const paddingSize = (availableWidth - textWidth) / 2.0
      const textStartX = startView.x + paddingSize

      const textStartY = tempYScale.bottom + yOffset
      ctx.fillText(text, textStartX, textStartY)

      // Now draw the boundaries around this annotation
      ctx.strokeStyle = style.strokeStyle
      if (!skipLeft) {
        ctx.beginPath()
        ctx.moveTo(startView.x, tempYScale.top)
        ctx.lineTo(startView.x, tempYScale.bottom)
        ctx.stroke()
      }

      if (!skipRight) {
        ctx.beginPath()
        ctx.moveTo(endView.x, tempYScale.top)
        ctx.lineTo(endView.x, tempYScale.bottom)
        ctx.stroke()
      }

      if (drawArrows) {
        this.drawArrow(textStartX - 1, textStartY, startView.x, textStartY)
        this.drawArrow(textStartX + textWidth + 1, textStartY + 2, endView.x, textStartY + 2)
      }
      ctx.fill()
    },
    drawArrow (fromx, fromy, tox, toy) {
      // variables to be used when creating the arrow
      const chart = this.$data._chart
      const ctx = chart.chart.ctx
      var headlen = 5

      var angle = Math.atan2(toy - fromy, tox - fromx)

      // starting path of the arrow from the start square to the end square and drawing the stroke
      ctx.beginPath()
      ctx.moveTo(fromx, fromy)
      ctx.lineTo(tox, toy)
      ctx.lineWidth = 1
      ctx.stroke()

      // starting a new path from the head of the arrow to one of the sides of the point
      ctx.beginPath()
      ctx.moveTo(tox, toy)
      ctx.lineTo(tox - headlen * Math.cos(angle - Math.PI / 7), toy - headlen * Math.sin(angle - Math.PI / 7))

      // path from the side point of the arrow, to the other side point
      ctx.lineTo(tox - headlen * Math.cos(angle + Math.PI / 7), toy - headlen * Math.sin(angle + Math.PI / 7))

      // path from the side point back to the tip of the arrow, and then again to the opposite side point
      ctx.lineTo(tox, toy)
      ctx.lineTo(tox - headlen * Math.cos(angle - Math.PI / 7), toy - headlen * Math.sin(angle - Math.PI / 7))

      // draws the paths created above
      ctx.lineWidth = 1
      ctx.stroke()
      ctx.fill()
    },
    afterDraw (chart) {
      var self = this
      const ctx = chart.chart.ctx
      const data = chart.config.data
      const labels = data.labels
      // We're going to use experimentData.rawData fields to mark places
      // based on where elements in the temperature dataset appear
      ctx.save()
      const rawData = self.experimentData.rawData

      const phases = rawData.phases
      phases.forEach(phase => {
        const closestStartIndex = utils.closest(phase.start, labels).index
        const closestEndIndex = utils.closest(phase.end, labels).index
        const phaseLabel = `${phase.name.charAt(0).toUpperCase() + phase.name.slice(1)} Phase`
        self.addAnnotation(phaseLabel, closestStartIndex, closestEndIndex)
      })
      ctx.restore()
    }
  },
  mounted () {
    const self = this
    // this.addPlugin({
    //   id: 'addAnnotations',
    //   afterDraw: self.afterDraw
    // })
    self.processExptData()
    window.expt = this
  }
}
</script>
