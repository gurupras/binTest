import fs from 'fs'
import path from 'path'
import yaml from 'js-yaml'
import axios from 'axios'
import qs from 'qs'


class FonoAPI {
  constructor (key) {
    this.key = key
  }

  getDeviceName (deviceID) {
    // See if this model has an alias
    var name
    if (deviceID.DeviceName && typeof deviceID.DeviceName !== 'string') {
      name = deviceID.DeviceName.marketName
    } else {
      name = deviceID['Build>MODEL'] || deviceID['Build.MODEL']
    }
    // console.log(`name=${name}`)
    try {
      var modelAliases = yaml.safeLoad(fs.readFileSync(path.join(__dirname, 'model-alias.yaml'), 'utf-8'))
      name = modelAliases[name] || name
    } catch (e) {
      console.error(e)
    }
    // console.log(`final model=${model}`)
    name = name.replace(/()/g, '')
    // console.log(`final name=${name}`)
    return name
  }

  async query (deviceID) {
    const response = await axios.post('https://fonoapi.freshpixl.com/v1/getdevice', qs.stringify({
      device: this.getDeviceName(deviceID),
      token: 'eb66ce55cf59127bf126ad97baefadb824f2690051fa1941',
      limit: 5,
    }))
    return response.data
  }

  async getChipset (deviceID) {
    const deviceInfos = await this.query(deviceID)
    console.log(`infos=${JSON.stringify(deviceInfos)}`)
    return deviceInfos[0].chipset
  }
}

export default FonoAPI
