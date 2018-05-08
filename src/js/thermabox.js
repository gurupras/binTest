import axios from 'axios'
import qs from 'qs'

const ADDR = 'thermabox.smartphone.exposed'
const PORT = 9443

export default {
  async setLimits (temp, threshold) {
    const response = await axios.post(`https://${ADDR}:${PORT}/set-limits`, qs.stringify({
      temperature: temp,
      threshold: threshold
    }))
    return response.data
  },
  async getLimits () {
    const response = await axios.get(`https://${ADDR}:${PORT}/get-limits`)
    return response.data
  },
  async getTemperature () {
    const response = await axios.get(`https://${ADDR}:${PORT}/get-temperature`)
    return response.data
  },
  async getState () {
    const response = await axios.get(`https://${ADDR}:${PORT}/get-state`)
    return response.data
  }
}
