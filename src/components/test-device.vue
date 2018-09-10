<template>
  <div class="row">
    <div class="col s12">
      <slot>
        <div class="info-div">
          <h3> {{title}} </h3>
          <div id="about-test-device-content" style="margin-top: 2em;">
            <div class="info-div">
              <div class="row">
                <div class="col s12 m6">
                  <!-- Show a message if we're unable to run experiments on this device -->
                  <div class="error" v-show="!haveTemperatureSensor">
                    <h4>Error!</h4>
                    <p>We found no accessible temperature sensor on your device. We cannot compare devices without knowing the temperature conditions under which a test was performed.</p>
                    <p v-if="sdkVersion >= 27">Currently, there is no solution to this issue on Android Oreo.</p>
                  </div>

                  <p>The test process involves running a CPU intensive workload to measure the quality of your smartphone CPU. After the workload is done, the test measures the rate at which
                  your smartphone is able to cool down.</p>
                  <p>
                    Overall, the test is expected to take about {{warmupDurationMinutes + workloadDurationMinutes + cooldownDurationMinutes}} minutes.
                    Please make sure you don't use your device after starting the test. The test will chime to let you know that it's done.
                  </p>

                  <p v-if="false">To improve accuracy,make sure you don't use your device after starting the test and ensure the following conditions are satisfied:</p>
                  <p></p>
                  <p> Ensure the following conditions are satisfied:</p>
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
                      <div id="status" v-show="runningTest || test">
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
                  <a class="waves-effect waves-light btn btn-small silver page-option" :class="startTestClasses" @click="runTest">Start Test</a>
                  <a class="waves-effect waves-light btn btn-small silver page-option" v-show="runningTest" :class="[interrupting ? 'disabled' : '', runningTest ? '' : 'disabled', haveTemperatureSensor ? '' : 'disabled']" @click="interruptTest">Interrupt Test</a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </slot>
    </div>
  </div>
</template>

<script>
/* global AndroidAPI */
import { mapGetters } from 'vuex'
import { PiTest, TestPhases } from '@/js/pi-test'
import moment from 'moment'

export default {
  name: 'test-device-mixin',
  data: function () {
    return {
      exportName: 'testComponent',
      title: 'Test My Device',
      logs: [],
      haveTemperatureSensor: undefined,
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
      doWarmupBeforeCooldown: true,
      chargeStateCallbackCode: undefined,
      screenStateCallbackCode: undefined,
      test: undefined,
      interrupting: undefined,
      runningTest: false,
      testResults: undefined,
      isPluggedIn: false,
      batteryLevel: 1.0,
      clockDrift: [],
      phases: []
    }
  },
  computed: {
    ...mapGetters([
      'deviceID',
      'testIDs'
    ]),
    warmupDurationMinutes () {
      return this.debug ? 0.01 : 3
    },
    workloadDurationMinutes () {
      return this.debug ? 0.3 : 5
    },
    cooldownDurationMinutes () {
      return this.debug ? 0.01 : 10
    },
    warmupDuration: function () {
      return this.warmupDurationMinutes * 60 * 1000
    },
    sdkVersion () {
      return this.deviceID['Build.VERSION.SDK_INT'] || 0
    },
    testConditionsSatisfied () {
      return this.checkIsPluggedIn() && this.checkBatteryLevel()
    },
    startTestClasses () {
      if (this.debug) {
        return {}
      }
      return (this.runningTest || !this.haveTemperatureSensor || !this.testConditionsSatisfied) ? 'disabled' : ''
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
      this.checkConnectivityRequisites()
      this.checkScreenRequisites()
    },
    checkConnectivityRequisites () {
      // console.log(`Checking requisites ...`)
      this.isPluggedIn = AndroidAPI.isPluggedIn()
      this.batteryLevel = AndroidAPI.getBatteryLevel()
      if (this.isPluggedIn || this.batteryLevel < 0.8) {
        if (this.runningTest && this.test) {
          this.test.connectivityStateChanges.push({
            isPluggedIn: this.isPluggedIn,
            batteryLevel: this.batteryLevel,
            now: moment().local().valueOf()
          })
          this.test.setValid(false)
          if (this.isPluggedIn) {
            this.test.validityReasons.add('Phone was plugged in')
          }
          if (this.batteryLevel < 0.8) {
            this.test.validityReasons.add('Battery level < 80%')
          }
        }
      }
    },
    updateBackgroundCgroupCPUs () {
      AndroidAPI.updateBackgroundCgroupCPUs(`0-${navigator.hardwareConcurrency - 1}`)
    },
    getClockMap () {
      return JSON.parse(AndroidAPI.mapClocks())
    },
    checkScreenRequisites () {
      const isScreenOn = AndroidAPI.isScreenOn()
      this.isScreenOn = isScreenOn
      if (this.runningTest && this.test) {
        this.test.screenStateChanges.push({
          isScreenOn,
          now: new Date()
        })
      }
    },
    clear () {
      this.test = undefined
      this.interrupting = undefined
      this.runningTest = undefined
      this.clockDrift = []
    },
    interruptTest () {
      var self = this
      this.logs.push('Test interrupted ...')
      this.$on('interrupt-finished', () => {
        self.runningTest = false
        try {
          AndroidAPI.interruptExperiment()
        } catch (e) {
        }
        clearInterval(this.progressInterval)
        this.$el.querySelector('#test-progress').style.width = 0
        // Enable navigation
        this.$store.commit('navigationDisabled', false)
        AndroidAPI.teardownTestProgress(true)
        self.clear()
      })
      this.test.interrupt()
    },
    doCooldown () {
      return AndroidAPI.sleepForDuration(this.test.getTestObj().cooldownDurationMS)
    },
    async runWarmupPhase () {
      this.test.currentPhase = TestPhases.WARMUP
      const start = moment().local().valueOf()
      AndroidAPI.warmupAsync(this.warmupDuration, `
        window.${this.exportName}.$emit('warmup-done')
      `)
      await this.waitForEvent('warmup-done')
      const end = moment().local().valueOf()
      this.phases.push({
        name: 'warmup',
        start,
        end
      })
    },
    runCooldownPhase () {
      try {
        this.log('Running cooldown')
        this.test.currentPhase = TestPhases.COOLDOWN
        this.checkScreenRequisites()
        const start = moment().local().valueOf()
        var result = this.doCooldown()
        const end = moment().local().valueOf()
        this.phases.push({
          name: 'cooldown',
          start,
          end
        })
        this.cooldownData = JSON.parse(result)
        const cooldownStartUpTime = result.startUpTime
        // Now, make sure the uptime hasn't elapsed by too much
        const elapsedUpTime = result.endUpTime - cooldownStartUpTime
        const percentElapsed = (elapsedUpTime / this.test.cooldownDurationMS) * 100
        if (percentElapsed >= 50) {
          this.test.setValid(false)
          this.test.validityReasons.add('Screen was turned on during cooldown phase')
        }
      } catch (e) {
        this.log(`Failed cooldown: ${e}`)
      }
    },
    runWorkloadPhase () {
      if (this.native) {
        this.test.startTime = moment().local().valueOf()
        var resultsStr = AndroidAPI.runWorkloadPi(15000, this.test.workloadDurationMS)
        this.test.endTime = moment().local().valueOf()
        var results = JSON.parse(resultsStr)
        this.test.results = results
        this.$emit('test-finished', this.test.results)
      } else {
        this.$emit('beforeWorkload')
        this.test.run()
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
      this.$emit('beforeStartTest')
      this.startTest()
    },
    startTest () {
      var self = this
      const test = PiTest(this)
      this.test = test
      this.test.currentPhase = TestPhases.STARTED
      test.warmupDurationMS = this.warmupDuration
      test.cooldownDurationMS = this.cooldownDurationMinutes * 60 * 1000
      test.workloadDurationMS = this.workloadDurationMinutes * 60 * 1000
      this.$emit('onTestObjectCreated', test)

      this.$store.commit('navigationDisabled', true)
      const start = moment().local().valueOf()
      const totalMS = this.warmupDuration + ((this.workloadDurationMinutes + this.cooldownDurationMinutes) * 60 * 1000)
      AndroidAPI.setupTestProgress()
      this.progressInterval = setInterval(() => {
        var now = moment().local().valueOf()
        var pct = (((now - start) / totalMS) * 100) >> 0
        AndroidAPI.updateTestProgress(pct)
        self.$el.querySelector('#test-progress').style.width = `${pct}%`
      }, 2 * 1000)

      this.checkRequisites()
      this.exptID = AndroidAPI.startExperiment()
      this.log(`Experiment ID: ${this.exptID}`)
      this.$emit('onExperimentIDAvailable', test, this.exptID)

      this.$on('test-finished', (results = self.test.getResult()) => {
        const start = results.startTime
        const end = results.endTime
        self.phases.push({
          name: 'workload',
          start,
          end
        })
        self.onTestFinished(results)
      })

      this.updateBackgroundCgroupCPUs()
      this.$emit('beforeTest')
      this.clockDrift.push(this.getClockMap())

      console.log(`exportName=${self.exportName}`)
      this.$emit('beforeStartExperiment')
      this.startExperiment()
    },
    async startExperiment () {
      AndroidAPI.log('webview', 'Received start-experiment')
      console.log('Starting experiment')

      // Since this may occur asynchronously, check if interrupted
      if (!this.runningTest) {
        // Interrupted
        return
      }

      if (this.cooldownFirst) {
        if (this.doWarmupBeforeCooldown) {
          this.log(`Warming up device a little bit ...`)
          await this.runWarmupPhase()
        }
        this.runCooldownPhase()
      }
      var tempReading = JSON.parse(AndroidAPI.getTemperature())
      this.exptStartTemp = tempReading.temperature
      this.log(`Running workload`)
      this.runWorkloadPhase()
    },
    onTestFinished (testResults) {
      if (!this.cooldownFirst) {
        this.runCooldownPhase()
      }
      this.test.currentPhase = TestPhases.FINISHED
      this.clockDrift.push(this.getClockMap())
      AndroidAPI.toast('Uploading logs')
      this.testResults = testResults
      testResults['testType'] = 'test-type-v1'
      testResults['startTemperature'] = this.exptStartTemp
      testResults['cooldownData'] = this.cooldownData
      testResults['endTemperature'] = this.cooldownData.last.tempAfterSleep
      testResults['appVersion'] = AndroidAPI.getBuildVersion()
      testResults['clockDrift'] = this.clockDrift
      testResults['properties'] = {
        native: this.native,
        debug: this.debug,
        cooldownFirst: this.cooldownFirst,
        isFake: AndroidAPI.isFake || false
      }
      testResults['phases'] = this.phases
      this.$emit('onResultAvailable', testResults)

      var key = this.uploadData(JSON.stringify(testResults))
      AndroidAPI.uploadExperimentData('http://smartphone.exposed/', 'upload-expt-data', key)
      this.testIDs.data[this.exptID] = {
        experimentID: this.exptID,
        startTime: moment(testResults.startTime)
      }
      this.testIDs.order.unshift(this.exptID)

      this.$emit('beforeCleanup')
      this.testCleanup(this.interrupted)
    },
    setupEventHandlers () {
      const self = this

      console.log(`Using test-device handlers`)

      this.$on('beforeStartTest', () => {
        self.checkRequisites()
      })

      this.$on('onTestObjectCreated', (test) => {
      })

      this.$on('onExperimentIDAvailable', (test, experimentID) => {
      })

      this.$on('beforeStartExperiment', () => {
      })

      this.$on('beforeWorkload', () => {
      })

      this.$on('onResultAvailable', (testResult) => {
      })

      this.$on('beforeCleanup', (wasInterrupted) => {
      })

      this.$on('afterCleanup', () => {
        if (self.externalCall) {
          self.$emit('results-handled')
        } else {
          self.$router.push('/test-results')
        }
      })
    },
    testCleanup (wasInterrupted) {
      // Cleanup
      clearInterval(this.progressInterval)
      this.$el.querySelector('#test-progress').style.width = 0
      AndroidAPI.teardownTestProgress(!!wasInterrupted)
      this.runningTest = false
      this.phases = []
      // Enable navigation
      this.$store.commit('navigationDisabled', false)
      this.$emit('afterCleanup')
    },
    async waitForEvent (evt) {
      const self = this
      return new Promise((resolve, reject) => {
        self.$once(evt, () => {
          resolve()
        })
      })
    }
  },
  beforeDestroy: function () {
    if (this.chargeStateCallbackCode) {
      AndroidAPI.removeChargeStateCallback(this.chargeStateCallbackCode)
    }
    if (this.screenStateCallbackCode) {
      AndroidAPI.removeScreenStateCallback(this.screenStateCallbackCode)
    }
    if (this.runningTest) {
      this.interruptTest()
    }
  },
  beforeMount: function () {
    console.log(`${this.exportName} parent beforeMount`)
    window[`${this.exportName}`] = this
    // Check if we can run experiments
    // Test for temperature
    try {
      const tempData = JSON.parse(AndroidAPI.getTemperature())
      if (!tempData.temperature) {
        throw new Error('No temperature sensor available')
      }
      // We have temperature data. We can run experiments
      this.haveTemperatureSensor = true
    } catch (e) {
      this.haveTemperatureSensor = false
    }
  },
  mounted: function () {
    this.log('Initialized')
    if (this.debug) {
      this.log(`Testing in debug mode`)
    }
    this.chargeStateCallbackCode = AndroidAPI.addChargeStateCallback(`
      window.${this.exportName}.checkConnectivityRequisites()
    `)
    this.screenStateCallbackCode = AndroidAPI.addChargeStateCallback(`
      window.${this.exportName}.checkScreenRequisites()
    `)
    this.checkRequisites()

    this.setupEventHandlers()
  }
}
</script>

<style>
[type="checkbox"]:checked:disabled + span:before {
  color: red;
}
</style>
