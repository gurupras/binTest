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
