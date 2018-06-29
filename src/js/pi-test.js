/* global AndroidAPI */
function createPiWebWorker () {
  var worker = new Worker('static/pi.js')
  worker.timeTaken = []
  worker.getTimes = function () {
    return JSON.stringify(worker.timeTaken)
  }
  return worker
}

const TestPhases = Object.freeze({
  NOT_STARTED: -1,
  STARTED: 0,
  WARMUP: 1,
  COOLDOWN: 2,
  WORKLOAD: 3,
  INTERRUPTED: 4,
  FINISHED: 5
})

function PiTest (component, digits) { // eslint-disable-line no-unused-vars
  var test = {}
  test.warmupDurationMS = 3 * 60 * 1000
  test.cooldownDurationMS = 10 * 60 * 1000
  test.workloadDurationMS = 5 * 60 * 1000
  test.numWebWorkers = navigator.hardwareConcurrency
  test.digits = digits || 15000
  test.workers = []
  test.zeroTime = Date.now()
  test.isRunning = false
  test.startTime = undefined
  test.done = undefined
  test.valid = true
  test.interrupted = false
  test.started = 0
  test.connectivityStateChanges = []
  test.screenStateChanges = []
  test.validityReasons = new Set()
  test.currentPhase = TestPhases.NOT_STARTED
  test.component = component
  // Create workers equal to number of CPU cores

  test.logParameters = function () {
    console.log(JSON.stringify({
      warmupDurationMS: test.warmupDurationMS,
      cooldownDurationMS: test.cooldownDurationMS,
      workloadDurationMS: test.workloadDurationMS,
      numWebWorkers: test.numWebWorkers,
      digits: test.digits,
      zeroTime: test.zeroTime,
      done: test.done,
      valid: test.valid,
      interrupted: test.interrupted,
      started: test.started
    }))
  }
  __log('# webworkers = ' + test.numWebWorkers)

  test.getResult = function () {
    return {
      digits: test.digits,
      startTime: test.startTime,
      endTime: test.endTime,
      iterations: test.results,
      warmupDurationMS: test.warmupDurationMS,
      workloadDurationMS: test.workloadDurationMS,
      cooldownDurationMS: test.cooldownDurationMS,
      numWebWorkers: test.numWebWorkers,
      connectivityStateChanges: test.connectivityStateChanges,
      screenStateChanges: test.screenStateChanges,
      valid: test.valid,
      validityReasons: Array.from(test.validityReasons)
    }
  }

  function __log (str, logToAndroid) {
    logToAndroid = logToAndroid || false
    if (logToAndroid) {
      AndroidAPI.log('smartphone-exposed-pi-test.js', str)
    }
    console.log(str)
  }

  /* Real functions */
  function addRealListener (worker) {
    worker.onmessage = function (e) {
      if (e.data.type === 'log') {
        console.log(`worker posted message: ${JSON.stringify(e.data)}`)
        return
      }
      // One runner finished
      test.started--

      var data = e.data
      test.results.push({
        ft: data.endTime,
        tt: round(data.timeTaken / 1e3, 2),
        tid: worker.id
      })

      if (test.interrupted) {
        for (var idx = 0; idx < test.workers.length; idx++) {
          var w = test.workers[idx]
          w.terminate()
        }
        test.component.$emit('interrupt-finished')
        // Test is interrupted. Just return
        return
      }

      // XXX: Right now, we just run the test for test.realTimeMS duration

      var timeElapsed = Date.now() - test.startTime
      if (!test.done && timeElapsed < test.workloadDurationMS) {
        test.started++
        // console.log('Starting another iteration');
        worker.postMessage({
          cmd: 'CalculatePi',
          value: data.digits
        })
      }

      // Signal that one real worker is done
      // $(test.workers).trigger('worker-done', [e.data, worker])
    }
    worker.onerror = function (e) {
      alert('Error: Line ' + e.lineno + ' in ' + e.filename + ': ' + e.message)
    }
  }

  function mean (list) { // eslint-disable-line no-unused-vars
    var sum = 0.0
    for (var i = 0; i < list.length; i++) {
      sum += list[i]
    }
    return sum / list.length
  }

  function median (list) { // eslint-disable-line no-unused-vars
    // list.sort((a, b) => a - b);
    list.sort()
    var lowMiddle = Math.floor((list.length - 1) / 2)
    var highMiddle = Math.ceil((list.length - 1) / 2)
    var median = (list[lowMiddle] + list[highMiddle]) / 2
    return median
  }

  function round (value, exp) {
    if (typeof exp === 'undefined' || +exp === 0) { return Math.round(value) }

    value = +value
    exp = +exp

    if (isNaN(value) || !(typeof exp === 'number' && exp % 1 === 0)) { return NaN }

    // Shift
    value = value.toString().split('e')
    value = Math.round(+(value[0] + 'e' + (value[1] ? (+value[1] + exp) : exp)))

    // Shift back
    value = value.toString().split('e')
    return +(value[0] + 'e' + (value[1] ? (+value[1] - exp) : -exp))
  }

  // This is the core function that is exposed externally
  test.run = function () {
    test.isRunning = true
    test.results = []
    test.startTime = Date.now()

    // _run(addRealListener, setupRealEventHandlers, test.digits);
    for (var i = 0; i < test.numWebWorkers; i++) {
      var worker = createPiWebWorker()
      worker.id = i
      addRealListener(worker)
      test.workers[i] = worker
    }

    __log('Running test')
    test.started = 0
    // Launch number of web workers specified by numWebWorkers
    for (i = 0; i < test.numWebWorkers; i++) {
      // start the worker
      test.started++
      test.workers[i].postMessage({
        cmd: 'CalculatePi',
        value: test.digits
      })
    }

    var interval = setInterval(function () {
      var now = Date.now()
      var timeElapsed = now - test.startTime
      if (timeElapsed > test.workloadDurationMS) {
        // console.log(`timeElapsed(${timeElapsed}) >  test.workloadDurationMS(${test.workloadDurationMS})`)
        test.done = true
        test.endTime = Date.now()
        console.log('Finishing test..remaining: ' + test.started)
        // __log(JSON.stringify(getResult()));
        for (var idx = 0; idx < test.workers.length; idx++) {
          var w = test.workers[idx]
          w.terminate()
        }
        // This is the end of the test
        console.log('Done!')
        test.component.$emit('test-finished')
        clearInterval(interval)
      }
    }, 300)
  }

  test.interrupt = function () {
    if (test.isRunning) {
      test.interrupted = true
      test.currentPhase = TestPhases.INTERRUPTED
    } else {
      // The test isn't running yet. Just fire interrupt-finished
      test.component.$emit('interrupt-finished')
    }
  }

  test.setValid = function (bool) {
    test.valid = bool
  }

  test.getTestObj = function () {
    return test
  }

  return test
}

export {PiTest, TestPhases}
