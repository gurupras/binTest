var axios = require('axios')
var qs = require('qs')

class fonoAPI {
  constructor (key) {
    this.key = key
  }

  async query (device) {
    const response = await axios.post('https://fonoapi.freshpixl.com/v1/getdevice', qs.stringify({
      device: device,
      token: 'eb66ce55cf59127bf126ad97baefadb824f2690051fa1941',
      limit: 5,
    }))
    return response.data
  }
}

module.exports = fonoAPI
