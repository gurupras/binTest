var ARRINIT = 2000
var SCALE = 10000

var ramp_digits = 1000
var test_digits = 100000

Number.prototype.pad = function(size) {
  var s = String(this)
  while (s.length < (size)) {
    s = '0' + s
  }
  return s
}

function CalculatePi (digits, shouldLoop) {
	var arrOrig = []
	for (var i = 0; i <= digits; i++) {
		arrOrig[i] = ARRINIT
	}
  do {
    var Pi = ''
		var arr = arrOrig.slice(0)
    var carry = 0
    var i, j, sum

    var start = Date.now()

    for (i = digits; i > 0; i -= 14) {
      sum = 0
      for (j = i; j > 0; --j) {
        sum = sum * j + SCALE * arr[j]
        arr[j] = sum % (j * 2 - 1)
        sum /= j * 2 - 1
      }
      Pi += (carry + sum / SCALE).pad(4)
      carry = sum % SCALE
    }
    var end = Date.now()
    var timeTaken = end - start

    self.postMessage({
			type: 'result',
      'PiValue': Pi,
      startTime: start,
      endTime: end,
      timeTaken: timeTaken,
      'digits': digits
    })
  } while (shouldLoop)
}

//wait for the start 'CalculatePi' message
//e is the event and e.data contains the JSON object
self.onmessage = function (e) {
	self.postMessage({
		type: 'log',
		msg: `shouldLoop=${e.data.shouldLoop}`
	})
  CalculatePi(e.data.value, e.data.shouldLoop)
}
