window.onload = function() {
	if(!window.Android) {
		window.Android = {
			clearLogcat: function() {},
			startMonsoon: function() {},
			stopMonsoon: function() {},
			runPowerSync: function() {},
			setAmbientTemperature: function() {},
			systemTime: function() { return 0;},
			upTime: function() { return 0;},
			toast: function() {},
			start: function() {},
			finish: Android.finish || function() {},
			post: function() {},
			log: function() {},
			getStartTemp: function() { return 10; },
			getEndTemp: function() { return 12; },
			getStep: function() { return 1; },
			getNumIterations: function() { return 2; },
			setURL: function() {},
		};
	}

	Android.clearLogcat();

	window.thermabox = {
		setLimits: function(temp, threshold, cb) {
			$.post('http://192.168.1.178:8080/set-limits', {
				temperature: temp,
				threshold: threshold,
			}, cb);
		},
		getLimits: function(cb) {
			$.get('http://192.168.1.178:8080/get-limits', cb);
		},
		getTemperature: function(cb) {
			$.get('http://192.168.1.178:8080/get-temperature', cb);
		},
		getState: function(cb) {
			$.get('http://192.168.1.178:8080/get-state', cb);
		},
	};

	var uri = URI(window.location.href);
	var q = uri.query(true);

	window.startTemp = Android.getStartTemp();
	window.endTemp = Android.getEndTemp();
	window.step = Android.getStep();
	window.numIterations = Android.getNumIterations();
	window.temp = Number(q.temp);
	window.iter = Number(q.iter);

	var newQ = $.extend({}, {}, q);
	if(window.iter === window.numIterations-1) {
		newQ.temp = window.temp + window.step;
		newQ.iter = 0;
	} else {
		newQ.iter++;
	}
	var newURL = URI(uri).removeQuery(q).addQuery(newQ);
	console.log(JSON.stringify({
		currentURL: uri.toString(),
		newURL: newURL.toString(),
	}));


	$(document).on('thermabox-stable', function() {
		$('#run-test').on('click', function() {
			var systemTime = Android.systemTime();
			var upTime = Android.upTime();
			var jsTime = Date.now();
			var timeDict = {
				systemTime: systemTime,
				upTime: upTime,
				jsTime: jsTime,
			};

			var ambientTemperature = window.temp + 10;
			var monsoonHost = '192.168.1.198';
			var monsoonPort = 20400;

			// Run powersync
			function padDate(val) {
				return ('0'+val).slice(-2);
			}

			var now = new Date();
			var filename = 'monsoon-' + now.getFullYear() + padDate(now.getMonth()) + padDate(now.getDate()) + ' ' + padDate(now.getHours()) + ':' + padDate(now.getMinutes()) + ':' + padDate(now.getSeconds()) + '.gz';
			console.log('Starting monsoon');
			Android.startMonsoon(monsoonHost, monsoonPort, JSON.stringify({
				size: 1,
				filepath: '/home/guru/workspace/smartphone.exposed/logs/' + filename,
			}));
			console.log('Running powersync');
			Android.runPowerSync();

			// Set temperature
			Android.setAmbientTemperature(ambientTemperature);
			Android.start();
			console.log(JSON.stringify(timeDict));

			Android.toast('Running test');
			$('#run-test').prop('disabled', true);

			$(window).on('test-finished', function() {
				var cooldownData = null;
				try {
					console.log('test finished. Attempting cooldown ...');
					cooldownData = JSON.parse(Android.waitUntilAmbientTemperature(ambientTemperature));
					;
				} catch(e) {
					console.log('Failed cooldown: ' + e);
				}
				Android.toast('Uploading logs');
				var testResults = test.getResult();
				testResults['cooldownData'] = cooldownData;
				Android.post('162.243.227.41', 8212, 'raw-data', JSON.stringify(testResults));
				console.log('Calling finish');
				Android.stopMonsoon(monsoonHost, monsoonPort);
				Android.setURL(newURL.toString());
				Android.finish();
			});

			var test = PiTest();
			test.run();
			// Uncomment this if you want to test just upload
			/*
			setTimeout(function() {
				Android.toast('Finishing test ...');
				$(window).trigger('test-finished');
			}, 3000);
			*/
		});
		setTimeout(function() {
			$('#run-test').trigger('click');
		}, 3000);
	});

	// Setup thermabox
	function checkStability() {
		var interval = setInterval(function() {
			thermabox.getState(function(state) {
				console.log('Thermabox: state=' + state);
				if(state === 'stable') {
					clearInterval(interval);
					$(document).trigger('thermabox-stable');
				}
			});
		}, 1000);
	}

	thermabox.getLimits(function(data) {
		var json = JSON.parse(data);
		console.log('thermabox: limits: ' + JSON.stringify(json));
		if(json.temperature !== window.temp) {
			var limits = {
				temperature: window.temp,
				threshold: 0.5,
			};
			console.log('Setting limits: ' + JSON.stringify(limits));
			thermabox.setLimits(window.temp, 0.5, checkStability);
		} else {
			checkStability();
		}
	});
};

