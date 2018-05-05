<template>
  <div class="row">
    <div class="col s12">
      <div class="info-div">
        <h3> Test My Device </h3>
        <div id="about-test-device-content" style="margin-top: 2em;">
          <div class="info-div">
            <div class="row">
              <div class="col s12 m6">
                <p>The test process involves running a CPU intensive workload to measure the quality of your smartphone CPU. After the workload is done, the test measures the rate at which
                your smartphone is able to cool down.</p>
                <p>Overall, the test is expected to take about {{warmupDurationMinutes + workloadDurationMinutes + cooldownDurationMinutes}}minutes.</p>

                <p>To ensure accurate results, make sure you don't use your device after starting the test and ensure the following conditions are satisfied:</p>
                <ul id="test-prerequisites">
                  <li v-for="(req, $index) in requirements" :key="$index">
                    <p>
                      <label>
                        <input :id="req.id" type="checkbox" disabled :checked="req.checkedCondition()">
                        <span>{{ req.label }}</span>
                      </label>
                    </p>
                  </li>
                </ul>

                <div class="row">
                  <div class="col s12 l6">
                    <div id="status">
                      <h5> <u> Logs </u> </h5>
                      <ul id="status-ul">
                        <li v-for="(log, $index) in logs" :key="$index">{{log}}</li>
                      </ul>
                    </div>
                    <div class="progress" v-show="runningTest">
                      <div id="test-progress" class="determinate" style="width: 0%"></div>
                    </div>
                  </div>
                </div>
                <a class="waves-effect waves-light btn btn-small silver page-option" :class="runningTest ? 'disabled' : ''" @click="runTest">Start Test</a>
                <a class="waves-effect waves-light btn btn-small silver page-option" v-show="runningTest" :class="[interrupting ? 'disabled' : '', runningTest ? '' : 'disabled']" @click="interruptTest">Interrupt Test</a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
/* global AndroidAPI */
import { mapGetters } from 'vuex'
import PiTest from '@/js/pi-test'
import moment from 'moment'

export default {
  name: 'test-device',
  data: function () {
    return {
      logs: [],
      requirements: [
        {
          label: 'Phone not charging',
          id: 'req-phone-not-charging',
          checkedCondition: this.checkIsPluggedIn
        },
        {
          label: 'Battery > 80%',
          id: 'req-battery-gt-80',
          checkedCondition: this.checkBatteryLevel
        }
      ],
      native: false,
      debug: AndroidAPI.isFake || false,
      cooldownFirst: true,
      callbackCode: undefined,
      test: undefined,
      interrupting: undefined,
      runningTest: false,
      testResults: undefined,
      isPluggedIn: false,
      batteryLevel: 1.0,
      warmupDurationMinutes: this.debug ? 0.3 : 3,
      workloadDurationMinutes: this.debug ? 0.3 : 5,
      cooldownDurationMinutes: this.debug ? 0.3 : 10
    }
  },
  computed: {
    ...mapGetters([
      'testIDs'
    ]),
    warmupDuration: function () {
      return this.warmupDurationMinutes * 60 * 1000
    }
  },
  watch: {
    isPluggedIn (v) {
      // this.log(`isPluggedIn=${v}`)
    },
    batteryLevel (v) {
      // this.log(`batteryLevel=${v}`)
    }
  },
  methods: {
    log (msg) {
      console.log(msg)
      this.logs.push(msg)
    },
    checkIsPluggedIn () {
      return !this.isPluggedIn
    },
    checkBatteryLevel () {
      return this.batteryLevel > 0.8
    },
    checkRequisites () {
      // console.log(`Checking requisites ...`)
      this.isPluggedIn = AndroidAPI.isPluggedIn()
      this.batteryLevel = AndroidAPI.getBatteryLevel()
      if (this.isPluggedIn || this.batteryLevel < 0.8) {
        if (this.runningTest && this.test) {
          this.test.setValid(false)
        }
      }
    },
    clear () {
      this.test = undefined
      this.interrupting = undefined
      this.runningTest = undefined
      this.testResults = ''
    },
    interruptTest () {
      var self = this
      this.logs.push('Test interrupted ...')
      this.$on('interrupt-finished', () => {
        self.runningTest = false
        self.test = undefined

        try {
          AndroidAPI.interruptExperiment()
        } catch (e) {
        }
        self.interrupting = undefined
        self.$store.commit('navigationDisabled', false)
        clearInterval(this.progressInterval)
        self.$el.querySelector('#test-progress').style.width = 0
        self.clear()
      })
      this.test.interrupt()
    },
    doCooldown () {
      try {
        this.log('Running cooldown')
        var result = AndroidAPI.sleepForDuration(this.test.getTestObj().cooldownDurationMS)
        this.cooldownData = JSON.parse(result)
      } catch (e) {
        this.log(`Failed cooldown: ${e}`)
      }
    },
    uploadData (str) {
      const MAX_CHUNK_SIZE = 32 * 1024
      var key = AndroidAPI.startUploadData()

      function chunkSubstr (str, size) {
        const numChunks = Math.ceil(str.length / size)
        const chunks = new Array(numChunks)

        for (var i = 0, o = 0; i < numChunks; ++i, o += size) {
          chunks[i] = str.substr(o, size)
        }

        return chunks
      }
      var chunks = chunkSubstr(str, MAX_CHUNK_SIZE)
      for (var idx = 0; idx < chunks.length; idx++) {
        AndroidAPI.upload(key, chunks[idx])
      }
      AndroidAPI.finishUploadData(key)
      return key
    },
    runTest (externalCall, appendToResult) {
      console.log(`Called runTest ...`)
      this.logs = ['Initialized']

      if (!AndroidAPI.isDozeDisabled()) {
        AndroidAPI.showDozeDialog(`Android Doze is known to cause problems with our tests. Please disable Android Doze to run tests.`)
        return
      }

      this.runningTest = true

      this.checkRequisites()
      this.startTest()
    },
    startTest () {
      var self = this
      const test = PiTest(this)
      this.test = test
      test.cooldownDurationMS = this.cooldownDurationMinutes * 60 * 1000
      test.testTimeMS = this.workloadDurationMinutes * 60 * 1000

      this.$store.commit('navigationDisabled', true)
      const start = Date.now()
      const totalMS = this.warmupDuration + ((this.workloadDurationMinutes + this.cooldownDurationMinutes) * 60 * 1000)
      this.progressInterval = setInterval(() => {
        var now = Date.now()
        var pct = ((now - start) / totalMS) * 100
        self.$el.querySelector('#test-progress').style.width = `${pct}%`
      }, 2 * 1000)

      this.checkRequisites()
      this.exptID = AndroidAPI.startExperiment()
      this.log(`Experiment ID: ${this.exptID}`)
      this.$on('test-finished', this.onTestFinished)

      if (this.cooldownFirst) {
        this.log(`Warming up device a little bit ...`)
        AndroidAPI.warmupAsync(this.warmupDuration, `
          window.testComponent.startExperiment()
        `)
      } else {
        this.startExperiment()
      }
    },
    startExperiment () {
      AndroidAPI.log('webview', 'Received start-experiment')
      console.log('Running test')

      // Since this may occur asynchronously, check if interrupted
      if (!this.runningTest) {
        // Interrupted
        return
      }

      if (this.cooldownFirst) {
        this.doCooldown()
      }
      var tempReading = JSON.parse(AndroidAPI.getTemperature())
      this.exptStartTemp = tempReading.temperature
      if (this.native) {
        this.test.startTime = Date.now()
        var resultsStr = AndroidAPI.runWorkloadPi(15000, this.test.testTimeMS)
        this.test.endTime = Date.now()
        var results = JSON.parse(resultsStr)
        this.test.results = results
        this.$emit('test-finished')
      } else {
        this.test.run()
      }
    },
    onTestFinished () {
      if (!this.cooldownFirst) {
        this.doCooldown()
      }

      AndroidAPI.toast('Uploading logs')
      var testResults = this.test.getResult()

      testResults['testType'] = 'test-type-v1'
      testResults['warmupDuration'] = this.warmupDuration
      testResults['ambientTemperature'] = this.temp
      testResults['sweepIteration'] = this.iter
      testResults['startTemperature'] = this.exptStartTemp
      testResults['cooldownData'] = this.cooldownData
      testResults['endTemperature'] = this.cooldownData.last.tempAfterSleep
      // XXX: --- hack ---
      testResults['cooldownDuration'] = 10 * 60 * 1000
      testResults['testTimeMs'] = 5 * 60 * 1000
      // XXX: --- hack ---
      testResults['properties'] = {
        native: this.native,
        debug: this.debug,
        cooldownFirst: this.cooldownFirst,
        isFake: AndroidAPI.isFake || false
      }

      var key = this.uploadData(JSON.stringify(testResults))
      AndroidAPI.uploadExperimentData('http://sweeptest.smartphone.exposed/', 'upload-expt-data', key)
      this.testIDs.data[this.exptID] = {
        experimentID: this.exptID,
        startTime: moment(testResults.startTime)
      }
      this.testIDs.order.unshift(this.exptID)

      // Cleanup
      clearInterval(this.progressInterval)
      this.$el.querySelector('#test-progress').style.width = 0
      // Enable navigation
      this.runningTest = false
      this.$store.commit('navigationDisabled', false)
      if (this.externalCall) {
        this.$emit('results-handled')
      } else {
        this.$store.commit('section', 'test-results')
      }
    }
  },
  beforeDestroy: function () {
    if (this.callbackCode) {
      AndroidAPI.removeChargeStateCallback(this.callbackCode)
    }
    if (this.runningTest) {
      this.interruptTest()
    }
  },
  beforeMount: function () {
    window.testComponent = this
  },
  mounted: function () {
    this.log('Initialized')
    if (this.debug) {
      this.log(`Testing in debug mode`)
    }
    this.callbackCode = AndroidAPI.addChargeStateCallback(`
      window.testComponent.checkRequisites()
    `)
    this.checkRequisites()
  }
}
</script>

<style>
[type="checkbox"]:checked:disabled + span:before {
  color: red;
}
