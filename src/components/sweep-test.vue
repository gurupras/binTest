<script>
/* global AndroidAPI */
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
      currentAmbientTemperature: undefined,
      iteration: undefined,
      timeDict: undefined
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
    setupEventHandlers () {
      const self = this

      console.log(`Using sweep-test handlers`)

      this.$on('beforeStartTest', () => {
        self.checkRequisites()
        self.startTest()
      })

      this.$on('onTestObjectCreated', (test) => {
      })

      this.$on('onExperimentIDAvailable', (test, experimentID) => {
      })

      this.$on('beforeTest', () => {
        var systemTime = AndroidAPI.systemTime()
        var upTime = AndroidAPI.upTime()
        var jsTime = Date.now()
        self.timeDict = {
          systemTime: systemTime,
          upTime: upTime,
          jsTime: jsTime
        }

        function padDate (val) {
          return ('0' + val).slice(-2)
        }

        var now = new Date()
        // var filename = 'monsoon-' + this.experimentID + '-' + now.getFullYear() + padDate(now.getMonth()) + padDate(now.getDate()) + ' ' + padDate(now.getHours()) + ':' + padDate(now.getMinutes()) + ':' + padDate(now.getSeconds()) + '.gz'
        const filename = `monsoon-${self.exptID}-${now.getFullYear()}${padDate(now.getMonth())}${padDate(now.getDate())} ${padDate(now.getHours())}:${padDate(now.getMinutes())}:${padDate(now.getSeconds())}.gz`
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
        self.startExperiment()
      })

      this.$on('beforeWorkload', () => {
        self.test.run()
      })

      this.$on('onResultAvailable', (testResult) => {
        testResult.testType = 'sweep-test-vue-v1'
        testResult.ambientTemperature = self.currentAmbientTemperature
        testResult.iteration = self.iteration
      })

      this.$on('beforeCleanup', () => {
        self.testCleanup()
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
      const self = this
      var stableStart
      var lastLogTime = Date.now()
      const stablePeriod = updatedLimits ? 3 * 60 * 1000 : 30 * 1000

      const interval = setInterval(function () {
        thermabox.getState().then((state) => {
          console.log('Thermabox: state=' + state)
          if (Date.now() - lastLogTime > 10 * 1000) {
            AndroidAPI.post('http://smartphone.exposed/api/info', JSON.stringify({msg: 'Thermabox state=' + state}))
            lastLogTime = Date.now()
          }
          if (state === 'stable') {
            if (!stableStart) {
              stableStart = Date.now()
            } else {
              var now = Date.now()
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
