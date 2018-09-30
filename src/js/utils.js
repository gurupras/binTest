import { EventEmitter } from 'events'
import axios from 'axios'

var self = {
  mean (numbers) {
    var total = 0
    var i
    for (i = 0; i < numbers.length; i += 1) {
      total += numbers[i]
    }
    return total / (numbers.length * 1.0)
  },
  median (array) {
    var numbers = array.slice()
    // median of [3, 5, 4, 4, 1, 1, 2, 3] = 3
    var median = 0
    var numsLen = numbers.length
    numbers.sort()

    if (numsLen % 2 === 0) {
      // average of two middle numbers
      median = (numbers[numsLen / 2 - 1] + numbers[numsLen / 2]) / 2
    } else { // is odd
      // middle number only
      median = numbers[(numsLen - 1) / 2]
    }
    return median
  },
  async medianFilter (array, windowSize = 3) {
    const response = await axios.post('/plot/median-filter', {
      array,
      windowSize
    })
    return response.data
  },
  customMedianFilter (array, windowSize = 3) {
    var subArrayStartIdx = 0
    const replaceOffset = Math.floor(windowSize / 2)
    var subArray = []
    var ret = []
    array.forEach((val, idx) => {
      if (subArray.length < windowSize) {
        ret[idx] = val
      }
      subArray.push(val)
      if (subArray.length === windowSize) {
        ret[subArrayStartIdx + replaceOffset] = self.median(subArray)
        subArrayStartIdx++
        subArray.shift()
      }
    })
    return ret
  },
  closest (num, arr, key) {
    function getVal (idx) {
      if (key) {
        return arr[idx].key
      } else {
        return arr[idx]
      }
    }
    var currIdx = 0
    var curr = getVal(currIdx)
    var diff = Math.abs(num - curr)
    for (var idx = 0; idx < arr.length; idx++) {
      var newdiff = Math.abs(num - arr[idx])
      if (newdiff < diff) {
        diff = newdiff
        curr = arr[idx]
        currIdx = idx
      }
    }
    return {
      index: currIdx,
      value: curr
    }
  },
  makeid (length) {
    var text = ''
    var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'

    for (var i = 0; i < length; i++) { text += possible.charAt(Math.floor(Math.random() * possible.length)) }

    return text
  },
  asyncAPICallbackFn (fn, api) {
    return new Promise((resolve, reject) => {
      const ee = new EventEmitter()
      var evtName = self.makeid(16)
      var windowVarName = `Var${self.makeid(16)}`
      window[windowVarName] = ee
      ee.on(evtName, (data) => {
        delete window[windowVarName]
        resolve(data)
      })
      const str = `window['${windowVarName}'].emit('${evtName}', {{data}})`
      fn.call(api, str)
    })
  },
  colors: [
    '#FFB300', // Vivid Yellow
    '#803E75', // Strong Purple
    '#FF6800', // Vivid Orange
    '#A6BDD7', // Very Light Blue
    '#C10020', // Vivid Red
    '#CEA262', // Grayish Yellow
    '#817066', // Medium Gray
    '#007D34', // Vivid Green
    '#F6768E', // Strong Purplish Pink
    '#00538A', // Strong Blue
    '#FF7A5C', // Strong Yellowish Pink
    '#53377A', // Strong Violet
    '#FF8E00', // Vivid Orange Yellow
    '#B32851', // Strong Purplish Red
    '#F4C800', // Vivid Greenish Yellow
    '#7F180D', // Strong Reddish Brown
    '#93AA00', // Vivid Yellowish Green
    '#593315', // Deep Yellowish Brown
    '#F13A13', // Vivid Reddish Orange
    '#232C16' // Dark Olive Green
  ]
}

export default self
