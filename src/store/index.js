/* global AndroidAPI */
import Vue from 'vue'
import Vuex from 'vuex'
import VueAxios from 'vue-axios'
import axios from 'axios'
import moment from 'moment'
import androidAPI from '@/js/android-api'
import utils from '@/js/utils'

import logo from '@/assets/logo.png'
import temperaturePlot from '@/store/modules/temperature-plot.js'
import researchData from '@/store/modules/research-data.js'

// Add in a fake AndroidAPI for desktop
if (!window.AndroidAPI) {
  console.log(`Injecting fake AndroidAPI`)
  window.AndroidAPI = androidAPI
}
global.AndroidAPI = window.AndroidAPI

Vue.use(Vuex)
Vue.use(VueAxios, axios)

const state = {
  navigationDisabled: false,
  isFake: AndroidAPI.isFake,
  deviceID: undefined,
  deviceInfo: undefined,
  section: undefined,
  CPUBinData: undefined,
  testIDs: {},
  mainSections: [
    {
      label: 'Device Info',
      target: 'device-info'
    },
    {
      label: 'CPU Bin Info',
      target: 'bin-info'
    },
    {
      label: 'Test My Device',
      target: 'test-device'
    },
    {
      label: 'Test Results',
      target: 'test-results',
      hide: function () {
        return !state.testIDs || !state.testIDs.order || Object.keys(state.testIDs.order).length === 0
      }
    },
    {
      label: 'Debug',
      target: 'debug',
      hide: function () {
        return true
      }
    },
    {
      label: 'Sweep Test',
      target: 'sweep',
      hide: function () {
        return true
      }
    }
  ]
}

const getters = {
  appURL: () => 'https://play.google.com/store/apps/details?id=edu.buffalo.cse.phonelab.smartphonesexposed',
  logo: () => logo,
  navigationDisabled: state => state.navigationDisabled,
  isFake: state => state.isFake,
  deviceID: state => state.deviceID,
  deviceInfo: state => state.deviceInfo,
  section: state => state.section,
  testIDs: state => state.testIDs,
  mainSections: state => state.mainSections,
  fullDeviceName (state) {
    const deviceID = state.deviceID
    var manufacturer = deviceID['Build.MANUFACTURER']
    if (manufacturer.toLowerCase() === manufacturer) {
      manufacturer = manufacturer[0].toUpperCase() + manufacturer.slice(1)
    }
    var deviceName
    if (deviceID.DeviceName) {
      deviceName = deviceID.DeviceName.deviceName
    } else {
      deviceName = deviceID['Build.MODEL']
    }
    return `${manufacturer} ${deviceName}`
  },
  CPUBinData: state => state.CPUBinData
}

const mutations = {
  navigationDisabled (state, val) {
    state.navigationDisabled = val
  },
  deviceID (state, val) {
    state.deviceID = val
  },
  deviceInfo (state, val) {
    state.deviceInfo = val
  },
  section (state, val) {
    state.section = val
  },
  testIDs (state, val) {
    state.testIDs = val
  },
  CPUBinData (state, val) {
    state.CPUBinData = val
  }
}

const actions = {
  async getDeviceID ({ state, commit }) {
    const data = await utils.asyncAPICallbackFn(AndroidAPI.getDeviceID, AndroidAPI)
    commit('deviceID', data)
  },
  async getDeviceDescription ({ state, commit, dispatch }) {
    var response = await axios.get('/api/device-description', {
      params: {
        deviceID: state.deviceID
      }
    })
    commit('deviceInfo', response.data[0])
  },
  getTemperatureData ({ state, commit, dispatch }, hours) {
    if (!hours) {
      hours = 12
    }
    return new Promise((resolve, reject) => {
      axios.get('/api/temperature-data', {
        params: {
          deviceID: state.deviceID,
          utcOffset: moment().utcOffset(),
          hours: hours
        }
      }).then((response) => {
        resolve(response.data)
      }).catch((err) => {
        reject(new Error(err.response.data.msg))
      })
    })
  },
  getTestIDs ({ state, commit, dispatch }) {
    return new Promise((resolve, reject) => {
      axios.get('/api/device-experiment-ids', {
        params: {
          deviceID: state.deviceID,
          utcOffset: moment().utcOffset()
        }
      }).then((response) => {
        response.data.order.forEach((v) => {
          const exptData = response.data.data[v]
          exptData.startTime = moment(exptData.startTime)
        })
        state.testIDs = response.data
        resolve(response.data)
      })
    })
  },
  async getTestResults ({ state, commit, dispatch }, { deviceID = state.deviceID, experimentID }) {
    const response = await axios.get('/api/experiment-results', {
      params: {
        deviceID,
        utcOffset: moment().utcOffset(),
        experimentID
      }
    })
    const data = response.data
    if (data.error) {
      throw new Error(data.error)
    }
    // TODO: Should we retry?
    return response.data
  },
  async getCPUBinInfo ({ state, commit, dispatch }) {
    const data = await utils.asyncAPICallbackFn(AndroidAPI.getCPUBin, AndroidAPI)
    commit('CPUBinData', data)
    if (data && Object.keys(data).length > 0) {
      // We have something. Send it to the server
      axios.post('/api/upload', {
        type: 'cpu-bin-data',
        data: {
          deviceID: state.deviceID,
          ...data
        },
        headers: {
          'Content-Type': 'application/json'
        }
      })
    }
  },
  async initializeDeviceData ({ state, commit, dispatch }) {
    await dispatch('getDeviceID')
    console.log(`Fetched deviceID`)
    // await dispatch('getCPUBinInfo')
    // console.log(`Fetched CPU bin info`)
    dispatch('getTestIDs')
    console.log(`Fetched test IDs`)
  },
  async getRawExperimentData (experimentID) {
    const response = await axios.get('/api/experiment-data', {
      params: {
        experimentID
      }
    })
    return response.data
  }
}

export default new Vuex.Store({
  state,
  actions,
  mutations,
  getters,
  modules: {
    temperaturePlot,
    researchData
  }
})
