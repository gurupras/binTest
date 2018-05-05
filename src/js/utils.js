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
  medianFilter (array, windowSize) {
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
  }
}

export default self
