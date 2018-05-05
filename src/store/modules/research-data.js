class Device {
  constructor () {
    this.longTermPerformance = {}
    this.longTermEnergy = {}
    this.longTermThermal = {}
    this.shortTermPerformance = {}
    this.shortTermEnergy = {}
  }
}

const nexus5 = new Device()
nexus5.longTermEnergy = {
  0: 736194,
  1: 735599,
  2: 778821,
  3: 808029,
  4: 906458
}
nexus5.longTermPerformance = {
  0: 272233,
  1: 256253,
  2: 324994,
  3: 319453,
  4: 340471
}

const state = {

}

const getters = {}
const mutations = {}

Object.keys(state).forEach((key) => {
  getters[key] = state => state[key]
  mutations[key] = (state, val) => {
    state[key] = val
  }
})

export default {
  state,
  getters,
  mutations
}
