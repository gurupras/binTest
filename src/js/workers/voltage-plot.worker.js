import axios from 'axios'
import utils from '@/js/utils'

const SAMPLING_RATE = 10

async function processVoltageData ({ exptData, defaultDataset }) {
  const { experimentID, temperatureData } = exptData.rawData
  const response = await axios.get('/plot/plot-voltage', {
    params: {
      experimentIDs: [experimentID]
    }
  })
  const voltageData = response.data[experimentID].regulator_data
  temperatureData.timestamps.forEach(() => {})
  const regulators = Object.keys(voltageData)
  const datasets = []
  for (var idx in regulators) {
    const regulator = regulators[idx]
    const dataset = JSON.parse(JSON.stringify(defaultDataset))
    Object.assign(dataset, {
      label: regulator,
      borderColor: utils.colors[idx],
      backgroundColor: utils.colors[idx]
    })
    const entries = voltageData[regulator]
    var finalEntries = entries
    if (entries.length > 5000) {
      // We're going to have to sample this
      finalEntries = entries.filter((x, idx) => idx % SAMPLING_RATE === 0)
    }
    const voltages = await utils.medianFilter(finalEntries.map(entry => entry.new), 51)
    dataset.data = finalEntries.map((entry, idx) => ({x: entry.datetime, y: voltages[idx]}))
    // Extend the last entry until the end of temperatureData's timestamps
    dataset.data.push({
      x: temperatureData.timestamps.slice(-1)[0],
      y: voltages.slice(-1)[0]
    })
    datasets.push(dataset)
  }
  const processedVoltageData = {
    raw: voltageData,
    processed: datasets
  }

  self.postMessage({
    voltageData: processedVoltageData
  })
}

onmessage = function (e) {
  processVoltageData(e.data)
}
