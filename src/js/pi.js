function CalculatePi (digits) {
  // We cannot use String.prototype.padStart because older devices
  // don't support it
  function pad (str, size) {
    var s = String(str)
    while (s.length < (size)) {
      s = '0' + s
    }
    return s
  }

  const ARRINIT = 2000
  const SCALE = 10000

  let Pi = ''

  var carry = 0
  var arr = []
  var i, j, sum

  for (i = 0; i <= digits; i++) {
    arr[i] = ARRINIT
  }

  var start = Date.now()

  for (i = digits; i > 0; i -= 14) {
    sum = 0
    for (j = i; j > 0; --j) {
      sum = sum * j + SCALE * arr[j]
      arr[j] = sum % (j * 2 - 1)
      sum = (sum / (j * 2 - 1)) >> 0
    }
    const _digits = (carry + sum / SCALE) >> 0
    Pi += pad(_digits, 4)
    carry = sum % SCALE
  }
  var end = Date.now()
  var timeTaken = end - start

  self.postMessage({
    'PiValue': Pi,
    timeTaken: timeTaken,
    endTime: end,
    'digits': digits
  })
}

export default CalculatePi
// wait for the start 'CalculatePi' message
// e is the event and e.data contains the JSON object
