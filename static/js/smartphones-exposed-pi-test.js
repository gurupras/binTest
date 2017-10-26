function createPiWebWorker() {
		var worker = new Worker('static/dist/pi.js');
		worker.timeTaken = [];
		worker.getTimes = function() {
			return JSON.stringify(worker.timeTaken);
		}
		return worker;
}


function PiTest(digits) {
	var test = {};
  test.COOLDOWN_DURATION_MS = 5 * 60 * 1000;
  test.numWebWorkers = navigator.hardwareConcurrency;
  test.digits = digits || 15000;
  test.workers = [];
  test.testTimeMs = 7 * 60 * 1000;
  test.zeroTime = Date.now();
  test.startTime = undefined;
  test.done = undefined;
  test.valid = true;
  test.interrupted = false;
  // Create workers equal to number of CPU cores

  __log('# webworkers = ' + test.numWebWorkers);

  test.getResult = function() {
    return {
      digits: test.digits,
      startTime: test.startTime,
      iterations: test.results,
      testTimeMs: test.testTimeMs,
      valid: test.valid,
    };
  };

  function __log(str, logToAndroid) {
    logToAndroid = logToAndroid || false;
    if(logToAndroid) {
      AndroidAPI.log('smartphones-exposed-pi-test.js', str);
    }
    console.log(str);
  }


  /* Real functions */
  function addRealListener(worker) {
    worker.onmessage = function(e) {
      var data = e.data;
      var now = Date.now();
      test.results.push({
        ft: round((now-test.zeroTime)/1e3, 2),
        tt: round(data.timeTaken/1e3, 2)
      });

      // A worker just finished. So decrement count
      test.started--;

      if(test.interrupted) {
        if(test.started === 0) {
          // Interrupt is complete
          $(window).trigger('interrupt-finished');
        }
        // Test is interrupted. Just return
        return;
      }

      // XXX: Right now, we just run the test for test.realTimeMs duration
      if(!test.startTime) {
        test.realEnd = Date.now();
        test.startTime = Date.now();
      } else {
        if(!test.startTime || (!test.done && ((Date.now()-test.startTime) < test.testTimeMs))) {
          test.started++;
          //console.log('Starting another iteration');
          worker.postMessage({
            'cmd':   'CalculatePi',
            'value': data.digits,
          });
        }
      }

      if(test.startTime && (Date.now()-test.startTime) > test.testTimeMs) {
        test.done = true;
        console.log('Finishing test..remaining: ' + test.started);
        //__log(JSON.stringify(getResult()));
        if(test.started == 0) {
          // This is the end of the test
          console.log('Done!');
          $(window).trigger('test-finished');
        }
      }
      // Signal that one real worker is done
      $(test.workers).trigger('worker-done', [e.data, worker]);
    };
    worker.onerror = function(e) {
      alert('Error: Line ' + e.lineno + ' in ' + e.filename + ': ' + e.message);
    };
  }

  function mean(list) {
    var sum = 0.0;
    for(var i = 0; i < list.length; i++) {
      sum += list[i];
    }
    return sum / list.length;
  }

  function median(list) {
    //list.sort((a, b) => a - b);
    list.sort();
    var lowMiddle = Math.floor((list.length - 1) / 2);
    var highMiddle = Math.ceil((list.length - 1) / 2);
    var median = (list[lowMiddle] + list[highMiddle]) / 2;
    return median;
  }

  function round(value, exp) {
    if (typeof exp === 'undefined' || +exp === 0)
      return Math.round(value);

    value = +value;
    exp = +exp;

    if (isNaN(value) || !(typeof exp === 'number' && exp % 1 === 0))
      return NaN;

    // Shift
    value = value.toString().split('e');
    value = Math.round(+(value[0] + 'e' + (value[1] ? (+value[1] + exp) : exp)));

    // Shift back
    value = value.toString().split('e');
    return +(value[0] + 'e' + (value[1] ? (+value[1] - exp) : -exp));
  }

  // This is the core function that is exposed externally
  test.run = function() {
    test.results = [];
    test.startTime = Date.now();

    //_run(addRealListener, setupRealEventHandlers, test.digits);
    for(var i = 0; i < test.numWebWorkers; i++) {
      var worker = createPiWebWorker();
      worker.id = `worker-${i}`;
      addRealListener(worker);
      test.workers[i] = worker;
    }

    __log('Running test');
    test.started = 0;
    // Launch number of web workers specified by numWebWorkers
    for(var i = 0; i < test.numWebWorkers; i++) {
      //start the worker
      test.started++;
      test.workers[i].postMessage({
        cmd: 'CalculatePi',
        value: test.digits,
      });
    }
  }

  test.interrupt = function() {
    test.interrupted = true;
  };

  test.setValid = function(bool) {
    test.valid = bool;
  };

  test.getTestObj = function() {
    return test;
  };

	console.log('Ran PiTest');
  return test;
};
