// Defaults

function PiTest(rampupRuns, rampupDigits) {
	this.numWebWorkers = 1;
	this.rampupRuns = Number(rampupRuns) || 10;
	this.rampupDigits = Number(rampupDigits) || 15000;
	this.digits = this.rampupDigits;
	this.workers = [];
	this.rampupResults = [];
	this.realTestTimeMs = 7 * 60 * 1000;
	var test = this;
	this.zeroTime = Date.now();
	this.finishStart = undefined;
	this.done = undefined;
	// Create workers equal to number of CPU cores
	try {
		var cpuConfig = JSON.parse(localStorage.getItem('cpu-config'));
		if(cpuConfig && cpuConfig.ncpus) {
			this.numWebWorkers = cpuConfig.ncpus;
			$('#ncpus').text('' + cpuConfig.ncpus);
		}
	} catch(e) {
		//__log(e);
	}
	this.numWebWorkers = 4;
	__log('# webworkers = ' + this.numWebWorkers);

	/* Rampup functions */
	function addRampupListener(worker) {
		worker.onmessage = function(e) {
			// Signal that one rampup is done
			$(test.workers).trigger('worker-done', [e.data, worker]);
		};
		worker.onerror = function(e) {
			alert('Error: Line ' + e.lineno + ' in ' + e.filename + ': ' + e.message);
		};
	}

	this.getResult = function() {
		return {
			digits: test.digits,
			rampup: test.rampupResults,
			startTime: realStart,
			iterations: test.realTimes,
			throttleTime: test.finishStart,
			iterationsCompleted: test.throttledResults.length,
			realTestTimeMs: test.realTestTimeMs,
		};
	};
	function __log(str, postToScreen) {
		try {
			Android.log(msg);
		} catch(e) {}

		if(postToScreen === undefined) {
			postToScreen = true;
		}
		if(postToScreen) {
			var msg = $('<div>');
			msg.text(str);
			$('#logsDiv').append(msg);
			var logsDiv = document.getElementById('logsDiv');
			var isScrolledToBottom = logsDiv.scrollHeight - logsDiv.clientHeight <= logsDiv.scrollTop + 1;
			if(isScrolledToBottom) {
				logsDiv.scrollTop = logsDiv.scrollHeight - logsDiv.clientHeight;
			}
		}
		console.log(str);
	}

	/*
	(function() {
		setInterval(function() {
				// allow 1px inaccuracy by adding 1
				//console.log(logsDiv.scrollHeight - logsDiv.clientHeight,  logsDiv.scrollTop + 1);
				// scroll to bottom if isScrolledToBotto
		}, 300);
	})();
	*/

	function setupRampupEventHandlers() {
		$(test.workers).on('worker-done', function(e, data, worker) {
			//__log('Worker-' + worker.id + ' done');
			worker.timeTaken.push(data.timeTaken);
			test.rampupResults.push(data.timeTaken);

			done++;
			if(done === test.numWebWorkers) {
				test.rampupCount++;
				if(test.rampupCount < test.rampupRuns) {
					runTest(test.rampupDigits);
				} else {
					var times = [];
					for(i = 0; i < test.numWebWorkers; i++) {
						times.push('Worker-' + i + ': ' + workers[i].getTimes());
					}
					//$('#times').text(times.join('<br>'));
					var med = median(test.rampupResults);
					$('#times').text('Median: ' + med + 'ms');
					__log(JSON.stringify({results: test.rampupResults, median: med}));
					test.rampupMedian = med;
					// Inform that rampup is complete
					$(test).trigger('rampup-complete');
				}
			}
		});
	}



	/* Real functions */
	function addRealListener(worker) {
		worker.onmessage = function(e) {
			var data = e.data;
			var now = Date.now();
			test.realTimes.push({
				ft: round((now-test.zeroTime)/1e3, 2),
				tt: round(data.timeTaken/1e3, 2)
			});

			/*
			// Check if data.timeTaken falls within certain bounds of the median of
			// the data measured during rampup.
			// If yes, then just restart the worker
			// If no, then stop and report time taken to cause thermal throttling
			var timeTaken = data.timeTaken;
			var med = test.rampupMedian;
			var diffPercent = Math.abs(((timeTaken-med) * 100) / med);
			var threshold = test.threshold || 90;
			if(diffPercent > threshold && !finishStart) {
			*/
			// XXX: Right now, we just run the test for ~10minutes
			if(!test.finishStart) {
				test.realEnd = Date.now();
				//__log('Error=' + diffPercent + '%. TimeTaken=' + timeTaken + ' Median=' + med);
				setStatus('THROTTLED!! ' + (test.realEnd - test.realStart));
				console.log('THROTTLED!!!');
				test.finishStart = Date.now();
			} else {
				// Just reschedule if not stopped
				if(done % 10 == 0) {
					//__log('Threshold: ' + diffPercent);
					;
				}
				if(!test.finishStart || (!test.done && ((Date.now()-test.finishStart) < test.realTestTimeMs))) {
					test.started++;
					//console.log('Starting another iteration');
					worker.postMessage({
						'cmd':   'CalculatePi',
						'value': data.digits,
					});
				}
			}
			/*
			if(test.finishStart) {
				test.throttledResults.push({
					'type': 'worker-done',
					'id': worker.id,
					'timeTaken': data.timeTaken,
					//'diffPercent': diffPercent,
				});
			}
			*/
			// A worker just finished. So decrement count
			test.started--;
			if(test.finishStart && (Date.now()-test.finishStart) > test.realTestTimeMs) {
				test.done = true;
				console.log('Finishing test..remaining: ' + test.started);
				//__log(JSON.stringify(getResult()));
				if(test.started == 0) {
					// This is the end of the test
					console.log('Done!');
					$(test).trigger('throttle-test-done');
				}
			}
			// Signal that one real worker is done
			$(test.workers).trigger('worker-done', [e.data, worker]);
		};
		worker.onerror = function(e) {
			alert('Error: Line ' + e.lineno + ' in ' + e.filename + ': ' + e.message);
		};
	}

	function setupRealEventHandlers() {
	}

	function mean(list) {
		var sum = 0.0;
		for(i = 0; i < list.length; i++) {
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
	function runTest(digits) {
		done = 0;
		test.started = 0;
		// Launch number of web workers specified by numWebWorkers
		for(i = 0; i < test.numWebWorkers; i++) {
			//start the worker
			test.started++;
			test.workers[i].postMessage({
				'cmd':   'CalculatePi',
				'value': digits,
			});
		}
	}

	function setStatus(str) {
		document.getElementById('testStatus').innerHTML = str;
	}

	// This is the core function that is exposed externally
	function run() {
		// First, we do a rampup, figure out things about our execution environment

		$(test).on('rampup-complete', function() {
			// Setup the real test
			__log('Rampup complete!');
			__log('Running throttle test');
			test.realTimes = [];
			test.realStart = Date.now();
			test.throttledResults = [];
			setStatus('Running real test');
			$(test).on('throttle-test-done', function() {
				setStatus('FINISHED');
				$('#run-test').prop('disabled', false);
				$(window).trigger('test-finished');
			});
			_run(addRealListener, setupRealEventHandlers, test.digits);
		});

		setStatus('Ramping Up');

		test.rampupCount = 0;
		// XXX: Don't run rampup
		// Just do the real test
		$(test).trigger('rampup-complete');
		//_run(addRampupListener, setupRampupEventHandlers, test.rampupDigits);

	}

	function _run(listenerFn, eventSetupFn, digits) {
		for(i = 0; i < test.numWebWorkers; i++) {
			worker = createPiWebWorker();
			worker.id = i;
			listenerFn(worker);
			test.workers[i] = worker;
		}
		eventSetupFn();

		__log('Running test');
		runTest(digits);
	}

	return {
		run: run,
		getResult: getResult,
	};

};


window.onload = function() {
	$('#run-test').on('click', function() {
		$('#run-test').prop('disabled', true);
		var test = PiTest();
		test.run();
	});
};