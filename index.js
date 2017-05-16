var fs = require('fs');
var path = require('path');
var request = require('request');
var express = require('express')
var app = express();
var yaml = require('js-yaml');

var config
try {
	config = yaml.safeLoad(fs.readFileSync('config.yaml', 'utf8'));
} catch (e) {
	console.log('Failed to read config.yaml: ' + e);
	process.exit(-1);
}



function resolveNumCPUs(string) {
	string = string.toLowerCase();
	// Split by '&' to handle big.LITTLE
	var strings = string.split('&');
	var ncpus = 0;	// Track total number of CPUs
	var result = {};
	for(var idx = 0; idx < strings.length; idx++) {
		var cpus = 0;
		if(string.startsWith('quad')) {
			cpus = 4;
		} else if(string.startsWith('dual')) {
			cpus = 2;
		} else {
			cpus = 1;
		}
		// Right now, we only add ncpus.  If we planned on adding frequency
		// information, that would go in here.
		var cpuConfig = {
			'ncpus': cpus,
		};
		result['cluster-' + idx] = cpuConfig;
		// Increment total number of cpus
		ncpus += cpus;
	}
	result['ncpus'] = ncpus;
	return result;
}


app.use('/static', express.static(path.join(__dirname, 'static')))

app.get('/', function (req, res) {
	res.send(fs.readFileSync(__dirname + '/static/html/index.html', 'utf-8'));
});

app.get('/pi-test', function (req, res) {
	res.send(fs.readFileSync(__dirname + '/static/html/pi-test.html', 'utf-8'));
});

app.get('/cpu-config', function (req, res) {
	console.log('Attempting to query fonoapi for "' + req.query.name + '"');
	// Make the HTTP POST request
	request.post(
			'https://fonoapi.freshpixl.com/v1/getdevice',
			{json: {token: config.fonoapi_key, limit: 5, device: req.query.name}},
			function (error, response, body) {
				if (!error && response.statusCode == 200) {
					var cpus = resolveNumCPUs(body[0].cpu);
					res.send(cpus);
				} else {
					console.log('Failed fonoapi query: ' + response);
					res.status(500).send('fonoapi query failed!');
				}
	});
});


app.listen(3000, function () {
	console.log('Example app listening on port 3000!')
});

