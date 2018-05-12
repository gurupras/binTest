/* global moment */
import axios from 'axios'
import fakeDevices from '@/js/fake-devices'

(function () {
  function concat () { // eslint-disable-line no-unused-vars
    var args = Array.prototype.slice.call(arguments)
    for (var idx = 0; idx < args.length; idx++) {
      if (args[idx] !== null && typeof args[idx] === 'object') {
        args[idx] = JSON.stringify(args[idx])
      }
    }
    return args.join(' ')
  }

  var old = console.log
  console.log = function () {
    // var str = concat.apply(this, arguments)
    // AndroidAPI.log('chromium', `[INFO:CONSOLE(43)] "${str}", source: undefined (43)`)
    old.apply(this, arguments)
  }
})()

function generateTemperatureData () {
  var hours = 1 + Math.floor((Math.random() * 0))
  var startTime = moment(Date.now() - (hours * 60 * 60 * 1000))
  var now = startTime
  var endTime = moment()

  var results = []
  while (endTime.diff(now, 'milliseconds') > 0) {
    now.add(100 + ((250 - 100) * Math.random()), 'ms')
    var temp = 30 + (30 * Math.random())

    results.push({
      timestamp: Number(now.format('x')),
      temperature: temp
    })
  }
  return results
}

var currentExperimentID
// This variable is used by AndroidAPI.*[uU]pload* functions
const uploadData = {}

const AndroidAPI = {
  isFake: true,
  stockResponse: function () {
    return new Error('Please install the smartphone.exposed app from the PlayStore')
  },
  getDeviceID: function () {
    return JSON.stringify(fakeDevices.nexus5)
  },
  getDeviceInfo: function () {
    return JSON.stringify({
      cpus: navigator.hardwareConcurrency
    })
  },
  getCPUBin: function () {
    return this.stockResponse()
  },
  getTemperatureData: function () {
    // return '[]';
    return JSON.stringify(generateTemperatureData())
  },
  toast: function (msg) {
    console.log('TOAST: ' + msg)
  },
  isRootAvailable: function () {
    return false
  },
  isPluggedIn: function () {
    // return false;
    return Math.random() > 0.2
  },
  getBatteryLevel: function () {
    // return 1.0;
    return Math.min(1, 0.7 + Math.random())
  },
  getTemperature: function () {
    return JSON.stringify({
      temperature: 25.0,
      timestamp: Date.now()
    })
  },
  clearLogcat: function () {

  },
  log: function (msg) {
    console.log('AndroidAPI: ' + msg)
  },
  systemTime: function () {
    return Date.now()
  },
  upTime: function () {
    return 1000.0
  },
  sleepForDuration: function (duration) {
    return JSON.stringify({
      last: {
        tempafterSleep: -1
      }
    })
  },
  addChargeStateCallback: function (content) {
    window.csc = setInterval(function () {
      eval(content) // eslint-disable-line no-eval
    }, 1000)
  },
  removeChargeStateCallback: function () {
    if (window.csc) {
      clearInterval(window.csc)
    };
  },
  waitUntilAmbientTemperature: function () {
  },
  startMonsoon: function () {
  },

  startExperiment: function () {
    const uuid = ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, c =>
      (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16))
    currentExperimentID = uuid
    return uuid
  },
  getStartTemp: function () {
    return 20
  },
  getEndTemp: function () {
    return 32
  },
  getStep: function () {
    return 2
  },
  getNumIterations: function () {
    return 3
  },
  stopMonsoon: function () {
  },
  setURL: function (url) {
    // window.location.href = url
  },
  startUploadData: function () {
    uploadData[currentExperimentID] = ''
    return currentExperimentID
  },
  upload: function (key, chunk) {
    uploadData[key] += chunk
  },
  finishUploadData: function (key) {
  },
  uploadExperimentData: function (origin, endpoint, key) {
    const exptData = JSON.parse(uploadData[key])
    delete uploadData[key]
    exptData.experimentID = currentExperimentID
    exptData.temperatureData = []
    // From DataTrackerService.submit()
    exptData.type = 'expt-data'
    exptData.deviceID = this.getDeviceID()
    axios.post('https://smartphone.exposed/api/upload', JSON.stringify(exptData), {
      headers: {
        'Content-Type': 'application/json'
      }
    }).then(() => {
      console.log(`Upload complete`)
    })
  },
  warmup: function () {
  },
  warmupAsync: function (duration, code) {
    setTimeout(() => {
      eval(code) // eslint-disable-line no-eval
    }, duration)
  },
  isDozeDisabled: function () {
    return true
  },
  showDozeDialog: function () {
  }
}

export default AndroidAPI
