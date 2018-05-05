<template>
  <div class="row info-div">
    <div class="col s12 center">
      <div>
        <h3>Test Results</h3>
      </div>
      <div class="row">
        <div class="col s12">

          <div class="input-field col offset-s4 s8 offset-m9 m3" v-if="Object.keys(testIDs).length > 0">
            <select @change="updateTestID">
              <option value="" disabled selected>Choose an experiment</option>
              <option v-for="testID in sortedTestIDs" :value="'' + testID" :key="testID">{{ getTestString(testID) }}</option>
            </select>
            <label>Experiment</label>
          </div>

          <div class="progress-preloader" v-if="loading">
            <div class="progress">
              <div class="indeterminate"></div>
            </div>
          </div>
          <div id="test-results-error" v-if="error">
            <span>{{error}}</span>
          </div>
          <div id="test-results" v-if="testInfo">
            <div id="test-info" v-if="testInfo.length > 0">
              <h5>Test Info</h5>
              <ul>
                <li v-for="info in testInfo" :key="info.label">
                  <div class="test-info-entry row" style="margin: 0.2em 0;">
                    <div class="col s6 l3 test-info-label">
                      <span>{{info.label}}</span>
                    </div>
                    <div class="col s6 l3 test-info-value">
                      <span>{{info.value}}</span>
                    </div>
                  </div>
                </li>
              </ul>
            </div>
            <div id="test-score">
              <h5>Test Score</h5>
              <div>
                <div v-if="!testRank">
                  <p>
                    We're working on crunching test results across devices down to a simple, meaningful score.
                  </p>
                </div>
                <div v-else>
                  <p> Your device ranks at {{testRank.rank}} percentile </p>
                  <p> We compared your device against {{testRank.numDevices}} other <b>{{fullDeviceName}}</b>s
                    across <b>{{testRank.numExperiments}}</b> experiments
                  </p>
                </div>
              </div>
            </div>
            <div id="test-plot">
              <h5>Test Breakdown</h5>
              <div class="row">
                <div class="col s12 offset-l3 l6">
                  <experiment-plot :height="plotSize" v-if="testResult" :temperature-data="temperaturePlotData" :experiment-data="experimentData"/>
                  <!-- <temperature-plot :height="100" v-if="temperaturePlotData" :temperature-data="temperaturePlotData" :options="temperaturePlotOptions"/> -->
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
    <div id="large-device" class="show-on-med-and-up"></div>
  </div>
</template>

<script>
import { mapGetters, mapActions } from 'vuex'
import ExperimentPlot from '@/components/plots/experiment-plot'
import TemperaturePlot from '@/components/plots/temperature-plot'
import TemperatureMixin from '@/components/plots/temperature-mixin'
import moment from 'moment'

export default {
  name: 'test-results',
  components: {
    TemperaturePlot,
    ExperimentPlot
  },
  mixins: [TemperatureMixin],
  computed: {
    ...mapGetters([
      'deviceID',
      'fullDeviceName',
      'testIDs',
      'temperaturePlotDefaultOptions'
    ]),
    plotSize () {
      return this.$el.querySelector('#large-device').style.display === 'none' ? 100 : 200
    },
    temperaturePlotOptions () {
      var ret = Object.assign({}, this.temperaturePlotDefaultOptions)
      ret.scales.xAxes[0].time = {
        unit: 'minute'
      }
      return ret
    },
    temperaturePlotData () {
      return this.fixTemperatureDataForPlot(this.testResult.rawData.temperatureData)
    },
    experimentData () {
      return this.testResult
    },
    sortedTestIDs () {
      const ret = Array.from(this.testIDs.order)
      // ret.reverse()
      return ret
    }
  },
  data: function () {
    return {
      currentTestID: '',
      testResult: undefined,
      testInfo: undefined,
      testRank: undefined,
      error: undefined,
      loading: false
      // temperaturePlotData: undefined
    }
  },
  watch: {
    currentTestID (v) {
      this.loadExperimentResults(this.currentTestID)
    },
    testIDs (v) {
      this.initializeSelect()
    }
  },
  methods: {
    ...mapActions([
      'getTestResults'
    ]),
    getTestString (testID) {
      const startTime = this.testIDs.data[testID].startTime
      const timeStr = startTime.format('YYYY-MM-DD HH:mm:ss')
      return `${testID.substr(0, testID.indexOf('-'))} (${timeStr})`
    },
    updateTestID (e) {
      this.currentTestID = undefined
      this.testResult = undefined
      this.testRank = undefined
      this.testInfo = undefined
      this.currentTestID = e.target.value
    },
    loadExperimentResults (experimentID) {
      this.loading = true
      this.error = undefined
      var self = this
      this.getTestResults(experimentID).then((data) => {
        self.updateTestInfo(data.testInfo)
        self.updateTestRank(data.rankingData)
        self.testResult = data
      }).catch((err) => {
        self.error = err.message
      }).finally(() => {
        this.loading = false
      })
    },
    updateTestInfo (testInfo) {
      this.testInfo = []

      // ----- BEGIN: Special field handling -----
      // Sanitize time
      testInfo.startTime = moment(testInfo.startTime).toString()
      // Convert temperature to degC
      if (testInfo.startTemperature) {
        testInfo.startTemperature = testInfo.startTemperature + '°C'
      }
      // ----- END: Special field handling -------

      var keyLabelDict = {
        experimentID: 'Experiment ID',
        digits: 'Pi-digits/Iteration',
        startTime: 'Experiment Start Time',
        testTimeMs: 'Total Experiment Duration (ms)',
        iterationsCompleted: '# Iterations Completed',
        startTemperature: 'Initial Device Temperature'
      }
      var keys = Object.keys(keyLabelDict)
      for (var idx = 0; idx < keys.length; idx++) {
        var key = keys[idx]
        var label = keyLabelDict[key]
        this.testInfo.push({
          label: label,
          value: testInfo[key] || 'NA'
        })
      }
    },
    updateTestRank (rank) {
      this.testRank = rank
    },
    initializeSelect () {
      const selectEl = this.$el.querySelector('select')
      window.M.FormSelect.init(selectEl)
    }
  },
  beforeMount () {
    if (Object.keys(this.testIDs).length === 0) {
      this.initPromise = this.$store.dispatch('getTestIDs')
    } else {
      this.initPromise = new Promise((resolve, reject) => {
        resolve()
      })
    }
  },
  mounted () {
    var self = this
    this.initPromise.then(() => {
      self.currentTestID = self.sortedTestIDs[0]
      self.initializeSelect()
    })
    window.testResults = this
  }
}
</script>

<style>
.plot {
  height: 100px !important;
}
</style>
