// Defaults

function PiTest(rampupRuns, rampupDigits) {
	this.numWebWorkers = 1;
	this.rampupRuns = Number(rampupRuns) || 10;
	this.rampupDigits = Number(rampupDigits) || 30000;
	this.workers = [];
	var test = this;
	// Create workers equal to number of CPU cores
	var cpuConfig = localStorage.getItem('cpu-config');
	if(cpuConfig) {
		this.numWebWorkers = cpuConfig.ncpus;
	}

	function addRampupListener(worker) {
		worker.onmessage = function(e) {
				// Signal that one rampup is done
				$(test.workers).trigger('worker-done', worker);
				worker.timeTaken.push(e.data.timeTaken);
				console.log('Worker-%d done', worker.id);
			}
		worker.onerror = function(e) {
			alert('Error: Line ' + e.lineno + ' in ' + e.filename + ': ' + e.message);
		};
	}

	function setupRampupEventHandlers() {
		$(test.workers).on('worker-done', function() {
			done++;
			if(done === test.numWebWorkers) {
				rampupCount++;
				if(rampupCount < test.rampupRuns) {
					runTest(test.rampupDigits);
				} else {
					times = [];
					for(i = 0; i < test.numWebWorkers; i++) {
						times.push('Worker-' + i + ': ' + workers[i].getTimes());
					}
					document.getElementById("Time").innerHTML = "Time Taken = " + times.join('<br>');
					document.getElementById("testStatus").innerHTML = "Test Status = Test Finished!";
					// Inform that rampup is complete
					$(test).trigger('rampup-complete');
				}
			}
		});
	}

	function runTest(digits) {
		done = 0;
		// Launch number of web workers specified by numWebWorkers
		for(i = 0; i < test.numWebWorkers; i++) {
			//start the worker
			test.workers[i].postMessage({
					'cmd':   'CalculatePi',
					'value': digits,
			});
		}
	}

	function run() {
		// First, we do a rampup, figure out things about our execution environment
		// and then do the actual test.

		document.getElementById("testStatus").innerHTML = "Test Status = Ramping Up";

		$(test).on('rampup-complete', function() {
			// Setup the real test
		});
		var rampupCount = 0;
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

		runTest(digits);
	}

	function startTest() {
		done = 0;
		start_time_ms = Date.now()
			testing = true;
		document.getElementById("testStatus").innerHTML = "Test Status = Testing";

		// Launch number of web workers specified by numWebWorkers
		for(i = 0; i < numWebWorkers; i++) {
			//start the worker
			workers[i].postMessage({
					'cmd':   'CalculatePi',
					'value': test_digits,
			});
		}
	}

	function reportData() {
		var curr_time_ms = Date.now();
		var diff_time_ms = curr_time_ms - start_time_ms;
	}

	function recordTime() {
	}


	return {
		run: run,
	}

};


window.onload = function() {
	$('#run-test').on('click', function() {
		var test = PiTest();
		test.run();
	});
};
