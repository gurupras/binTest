import axios from 'axios'
import qs from 'qs'

describe('fonoapi', () => {
  it('/getdevice', async () => {
    const response = await axios.post('https://fonoapi.freshpixl.com/v1/getdevice', qs.stringify({
      device: 'Nexus 6',
      token: 'eb66ce55cf59127bf126ad97baefadb824f2690051fa1941',
      limit: 5
    }))
    const data = response.data
    expect(data.length).toBeGreaterThan(0)
    const device = data[0]
    expect(device.DeviceName).toEqual('Motorola Nexus 6')
  })
})
