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
		};
	}
	$('#run-test').on('click', function() {
		var systemTime = Android.systemTime();
		var upTime = Android.upTime();
		var jsTime = Date.now();
		var timeDict = {
			systemTime: systemTime,
			upTime: upTime,
			jsTime: jsTime,
		};

		var ambientTemperature = 33;
		var monsoonHost = '192.168.1.198';
		var monsoonPort = 20400;

		Android.clearLogcat();

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
};

