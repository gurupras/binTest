var fs = require('fs');
var path = require('path');
var request = require('request');
var express = require('express');
var bodyparser = require('body-parser');
var moment = require('moment');

var app = express();
app.use(bodyparser.text({limit: '200mb'}));

var http = require('http').createServer(app);
var yaml = require('js-yaml');

var HTTPS_PORT = 8112;
var HTTP_PORT = HTTPS_PORT+100;

var config;
try {
	config = yaml.safeLoad(fs.readFileSync('config.yaml', 'utf8'));
} catch (e) {
	console.log('Failed to read config.yaml: ' + e);
	process.exit(-1);
}

var httpsConfig;
if(config.https) {
	httpsConfig = {
		key: fs.readFileSync(config.https.key),
		cert: fs.readFileSync(config.https.cert),
	};
	var https = require('https').createServer(httpsConfig, app);
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


app.use('/static', express.static(path.join(__dirname, 'static')));

app.use(function(req, res, next) {
	var data = '';
	req.on('data', function(chunk) {
		data += chunk;
	});
	req.on('end', function() {
		req.rawBody = data;
		next();
	});
});

app.get('/', function (req, res) {
	res.send(fs.readFileSync(__dirname + '/static/html/index.html', 'utf-8'));
});

app.get('/pi-test', function (req, res) {
	res.send(fs.readFileSync(__dirname + '/static/html/pi-test.html', 'utf-8'));
});

app.get('/pi-test-auto', function (req, res) {
	res.send(fs.readFileSync(__dirname + '/static/html/pi-test-auto.html', 'utf-8'));
});

app.get('/sweep-cooldown', function (req, res) {
	res.send(fs.readFileSync(__dirname + '/static/html/sweep-cooldown.html', 'utf-8'));
});


var rawData = [];

function nowDateStr() {
	var now = moment().local();
	var dateStr = now.format('YYYY-MM-DD HH:mm:ss');
	return dateStr;
}
app.post('/upload', function(req, res) {
	var id = req.get('device-id');
	var exptId = req.get('expt-id');
	function pad(num, size){ return ('000000000' + num).substr(-size); }

	if(!id) {
		console.log(JSON.stringify(req.headers, null, '  '));
	}
	console.log('Receiving upload: %s ...', id);
	/*
	var dateString = new Date().toISOString().
	  replace(/T/, ' ').      // replace T with a space
	  replace(/\..+/, '');     // delete the dot and everything after
	*/
	var dateString = nowDateStr();

	var fileName = id + '-expt_' + pad(exptId, 3) + '-' + dateString;
	var data = req.rawBody + '\n' + rawData.join('\n');
	fs.writeFileSync('logs/' + fileName, data);
	rawData = [];
	res.send('OK');
});

app.post('/info', function(req, res) {
	console.log(req.rawBody);
	res.send('OK');
});

app.post('/raw-data', function(req, res) {
	// Anything uploaded to raw-data gets appended to the next uploaded file
	console.log('Got raw-data');
	rawData.push(req.rawBody);
	res.send('OK');
});

app.get('/cpu-config', function (req, res) {
	var fullName = req.query.name;
	fullName = 'Google Nexus 6';
	console.log('Attempting to query fonoapi for "' + fullName + '"');
	// Make the HTTP POST request
	// FIXME: Rewrite this HUGE mess The logic we're trying to implement here is
	// fairly simple: First, try the full name as acquired from the client.  If
	// this fails, then discard the first word from the name (possibly the brand
	// name) and try with the remaining. If this also fails, then bail. We don't
	// know how to handle this name.
	request.post(
		'https://fonoapi.freshpixl.com/v1/getdevice',
		{json: {token: config.fonoapi_key, limit: 5, device: fullName}},
		function (error, response, body) {
			if (!error && response.statusCode == 200 && body.status !== 'error') {
				console.log('Response: ' + JSON.stringify(body));
				try {
					var cpus = resolveNumCPUs(body[0].cpu);
					res.send({
						'status': 'OK',
						'result': cpus,
					});
				} catch(e) {
					res.sendStatus(500);
				}
			} else {
				// We failed to find the device using the full name. Try ignoring the first word which could be the brand
				var model = fullName.substr(fullName.indexOf(' ')+1);
				request.post(
						'https://fonoapi.freshpixl.com/v1/getdevice',
						{json: {token: config.fonoapi_key, limit: 5, device: model}},
						function (error, response, body) {
							if (!error && response.statusCode == 200 && body.status !== 'error') {
								console.log('Response: ' + JSON.stringify(body));
								try {
									var cpus = resolveNumCPUs(body[0].cpu);
									res.send({
										'status': 'OK',
										'result': cpus
									});
								} catch(e) {
									res.sendStatus(500);
								}
							} else {
								// We could not find a device
								console.log('Could not find info on "%s" or "%s"', fullName, model);
								res.sendStatus(500);
							}
						}
				);
			}
		}
	);
});


http.listen(HTTP_PORT, function () {
	console.log('smartphones.exposed core-app listening for HTTP on port %d', HTTP_PORT);
});

if(https) {
	https.listen(HTTPS_PORT, function() {
		console.log('smartphones.exposed core-app listening for HTTPS on port %d', HTTPS_PORT);
	});
}
