<script>
/* global AndroidAPI */
import moment from 'moment'
import URI from 'urijs'
import { mapGetters } from 'vuex'
import TestDevice from '@/components/test-device'
import thermabox from '@/js/thermabox.js'

export default {
  name: 'sweep-test',
  extends: TestDevice,
  data: function () {
    return {
      exportName: 'sweepTest',
      title: 'Sweep Test',
      monsoonHost: '192.168.2.198',
      monsoonPort: 20400,
      url: URI(window.location.href),
      newUrl: undefined,
      startAmbientTemperature: AndroidAPI.getStartTemp(),
      endAmbientTemperature: AndroidAPI.getEndTemp(),
      step: AndroidAPI.getStep(),
      numIterations: AndroidAPI.getNumIterations(),
      cooldownVariant: AndroidAPI.getCooldownVariant(),
      currentAmbientTemperature: undefined,
      iteration: undefined,
      label: AndroidAPI.getLabel(),
      timeMap: undefined
    }
  },
  computed: {
    ...mapGetters([
      'deviceID'
    ])
  },
  methods: {
    getDesiredCPUTemperature () {
      if (this.debug) {
        return this.currentAmbientTemperature + 40
      } else {
        return this.currentAmbientTemperature + 10
      }
    },
    doCooldown () {
      switch (this.cooldownVariant) {
        case 'simple':
          return AndroidAPI.sleepForDuration(this.test.getTestObj().cooldownDurationMS)
        case 'cpu-temp':
          return AndroidAPI.waitUntilAmbientTemperature(this.getDesiredCPUTemperature(), null)
      }
    },
    setupEventHandlers () {
      const self = this

      console.log(`Using sweep-test handlers`)

      this.$on('beforeStartTest', async () => {
        // Tell server to start recording thermabox state
      })

      this.$on('onTestObjectCreated', (test) => {
      })

      this.$on('onExperimentIDAvailable', (test, experimentID) => {
      })

      this.$on('beforeTest', () => {
        self.timeMap = JSON.parse(AndroidAPI.getAllTimes())
        self.timeMap.jsTime = moment().local().valueOf()

        function padDate (val) {
          return val.toString().padStart(2, '0')
        }

        var now = moment().local()
        // var filename = 'monsoon-' + this.experimentID + '-' + now.getFullYear() + padDate(now.getMonth()) + padDate(now.getDate()) + ' ' + padDate(now.getHours()) + ':' + padDate(now.getMinutes()) + ':' + padDate(now.getSeconds()) + '.gz'
        const filename = `monsoon-expt_${self.iteration.toString().padStart(3, '0')}-${self.exptID}-${now.year()}${padDate(now.month())}${padDate(now.date())} ${padDate(now.hours())}:${padDate(now.minutes())}:${padDate(now.seconds())}.gz`
        console.log('Starting monsoon')
        AndroidAPI.startMonsoon(self.monsoonHost, self.monsoonPort, JSON.stringify({
          size: 1,
          filepath: '/home/guru/workspace/smartphones.exposed/logs/' + filename
        }))
        if (!self.debug) {
          console.log('Running powersync')
          AndroidAPI.runPowerSync()
        }
      })

      this.$on('beforeStartExperiment', () => {
        AndroidAPI.post('http://smartphone.exposed/api/info', JSON.stringify({msg: `Starting experiment`}))
      })

      this.$on('beforeWorkload', () => {
        AndroidAPI.updateThermaboxRecorder('start')
      })

      this.$on('onResultAvailable', async (testResult) => {
        if (self.label) {
          testResult.label = self.label
        }
        testResult.testType = 'sweep-test-vue-v2'
        testResult.thermaboxData = JSON.parse(AndroidAPI.updateThermaboxRecorder('stop'))
        testResult.ambientTemperature = self.currentAmbientTemperature
        testResult.iteration = self.iteration
        testResult.timeMap = self.timeMap
      })

      this.$on('beforeCleanup', () => {
      })

      this.$on('afterCleanup', () => {
        if (self.externalCall) {
          self.$emit('results-handled')
        } else {
          // We're doing sweep-test. Navigate somewhere else and then come back
          setTimeout(() => {
            AndroidAPI.setURL(self.newUrl.toString())
          }, 1000)

          self.$router.push('/device-info')
          AndroidAPI.stopMonsoon(this.monsoonHost, this.monsoonPort)
        }
      })
    },
    checkThermaboxStability (updatedLimits) {
      if (this.debug) {
        return this.$emit('thermabox-stable')
      }

      const self = this
      var stableStart
      var lastLogTime = moment().local().valueOf()
      const stablePeriod = updatedLimits ? 3 * 60 * 1000 : 30 * 1000

      const interval = setInterval(function () {
        thermabox.getState().then((state) => {
          console.log('Thermabox: state=' + state)
          if (moment().local().valueOf() - lastLogTime > 10 * 1000) {
            AndroidAPI.post('http://smartphone.exposed/api/info', JSON.stringify({msg: 'Thermabox state=' + state}))
            lastLogTime = moment().local().valueOf()
          }
          if (state === 'stable') {
            if (!stableStart) {
              stableStart = moment().local().valueOf()
            } else {
              var now = moment().local().valueOf()
              if ((now - stableStart) > stablePeriod) {
                clearInterval(interval)
                self.$emit('thermabox-stable')
              }
            }
          } else {
            stableStart = undefined
          }
        })
      }, 1000)
    }
  },
  beforeMount () {
    console.log(`sweep-test child beforeMount`)
    const query = this.url.query(true)
    this.currentAmbientTemperature = Number(query.ambientTemperature)
    this.iteration = Number(query.iteration)
    if (this.currentAmbientTemperature > this.endAmbientTemperature) {
      window.location.href = 'about:blank'
    }

    if (this.cooldownVariant === 'cpu-temp') {
      // this.doWarmupBeforeCooldown = false
    }

    const newQuery = Object.assign({}, query)
    if (this.iteration === this.numIterations - 1) {
      newQuery.ambientTemperature = this.currentAmbientTemperature + this.step
      newQuery.iteration = 0
    } else {
      newQuery.iteration++
    }
    this.newUrl = URI(this.url).removeQuery(query).addQuery(newQuery)
    console.log(JSON.stringify({
      currentURL: this.url.toString(),
      newURL: this.newUrl.toString()
    }))
  },
  mounted () {
    const self = this
    this.$on('thermabox-stable', this.runTest)
    window.thermabox = thermabox

    console.log(`Target ambient temperature: ${this.currentAmbientTemperature}`)
    console.log('Attempting to check thermabox limits & stability')

    thermabox.getLimits().then((data) => {
      const json = data
      console.log('thermabox: limits: ' + JSON.stringify(json))
      if (json.temperature !== self.currentAmbientTemperature) {
        var limits = {
          temperature: self.currentAmbientTemperature,
          threshold: 0.5
        }
        console.log('Setting limits: ' + JSON.stringify(limits))
        thermabox.setLimits(self.currentAmbientTemperature, 0.5).then(() => {
          // Start checking after 1s
          setTimeout(function () {
            self.checkThermaboxStability(true)
          }, 1000)
        })
      } else {
        self.checkThermaboxStability()
      }
    })
  }
}
</script>
