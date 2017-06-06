// Defaults

function PiTest(rampupRuns, rampupDigits) {
	this.numWebWorkers = 1;
	this.rampupRuns = Number(rampupRuns) || 5;
	this.rampupDigits = Number(rampupDigits) || 30000;
	this.digits = this.rampupDigits;
	this.workers = [];
	this.rampupResults = [];
	var test = this;
	// Create workers equal to number of CPU cores
	try {
		var cpuConfig = JSON.parse(localStorage.getItem('cpu-config'));
		if(cpuConfig && cpuConfig.ncpus) {
			this.numWebWorkers = cpuConfig.ncpus;
			$('#ncpus').text('' + cpuConfig.ncpus);
		}
	} catch(e) {
		__log(e);
	}
	this.numWebWorkers = 16;
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

	function __log(str) {
		var msg = $('<div>');
		msg.text(str);
		$('#logsDiv').append(msg);
		var logsDiv = document.getElementById('logsDiv');
		var isScrolledToBottom = logsDiv.scrollHeight - logsDiv.clientHeight <= logsDiv.scrollTop + 1;
		if(isScrolledToBottom)
			logsDiv.scrollTop = logsDiv.scrollHeight - logsDiv.clientHeight;
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
				// Signal that one real worker is done
				$(test.workers).trigger('worker-done', [e.data, worker]);
		};
		worker.onerror = function(e) {
			alert('Error: Line ' + e.lineno + ' in ' + e.filename + ': ' + e.message);
		};
	}

	function setupRealEventHandlers() {
		var done = 0;
		var finishStart = null;
		$(test.workers).on('worker-done', function(e, data, worker) {
			done++;
			if(done % 100 == 0) {
				//__log('Worker-' + worker.id + ' done');
			}

			test.realTimes.push(data.timeTaken);

			// Check if data.timeTaken falls within certain bounds of the median of
			// the data measured during rampup.
			// If yes, then just restart the worker
			// If no, then stop and report time taken to cause thermal throttling
			var timeTaken = data.timeTaken;
			var med = test.rampupMedian;
			var diffPercent = Math.abs(((timeTaken-med) * 100) / med);
			var threshold = test.threshold || 70;
			if(diffPercent > threshold && !finishStart) {
				test.realEnd = Date.now();
				//__log('Error=' + diffPercent + '%. TimeTaken=' + timeTaken + ' Median=' + med);
				setStatus("THROTTLED!! " + (test.realEnd - test.realStart));
				console.log('THROTTLED!!!');
				finishStart = Date.now();
			} else {
				// Just reschedule if not stopped
				if(done % 10 == 0) {
					//__log('Threshold: ' + diffPercent);
				}
				var now = Date.now();
				if(!finishStart || ((now-finishStart) < 1*60*1000)) {
					test.started++;
					worker.postMessage({
							'cmd':   'CalculatePi',
							'value': data.digits,
					});
				}
			}
			if(finishStart) {
				test.throttledResults.push({
					'type': 'worker-done',
					'id': worker.id,
					'timeTaken': data.timeTaken,
					'diffPercent': diffPercent,
				});
			}
			// A worker just finished. So decrement count
			test.started--;
			if(finishStart && test.started == 0) {
				// This is the end of the test
				$(test).trigger('throttle-test-done');
			}
			/*
			console.log(JSON.stringify({
			}));
			*/
		});
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
		document.getElementById("testStatus").innerHTML = str;
	}
	function run() {
		// First, we do a rampup, figure out things about our execution environment
		// and then do the actual test.


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
			});
			_run(addRealListener, setupRealEventHandlers, test.digits);
		});

		setStatus("Ramping Up");

		test.rampupCount = 0;
		_run(addRampupListener, setupRampupEventHandlers, test.rampupDigits);

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
	}

};


window.onload = function() {
	$('#run-test').on('click', function() {
		$('#run-test').prop('disabled', true);
		var test = PiTest();
		test.run();
	});
};
