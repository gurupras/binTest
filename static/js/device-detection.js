document.addEventListener('onDOMContentLoaded', function() {
	$.getScript('//wurfl.io/wurfl.js', function() {
		console.log('Loaded wurfl');
		// Get the device name
		var deviceName = WURFL.complete_device_name;
		// Send this over to the server to get the number of cores this device uses
		$.get('/cpu-config', {'name': deviceName}, function(result) {
			// Store whatever the server sends back into localStorage
			localStorage.setItem('cpu-config', result);
		});
	});
});
