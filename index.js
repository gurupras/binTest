var fs = require('fs');
var path = require('path');
var request = require('request');
var express = require('express');
var bodyParser = require('body-parser');
var moment = require('moment');
var compression = require('compression');
var morgan = require('morgan');
var util = require('util');

var app = express();
app.use(compression());
app.use(bodyParser.json({limit: '200mb'}));

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

var mongo = require('./mongo.js')(config.mongodb.url);

var fonoapi = require('./fonoapi.js')(config.fonoapi_key);

var temperatureKeys;
try {
  temperatureKeys = yaml.safeLoad(fs.readFileSync('./temperature-keys.yaml', 'utf8'));
} catch (e) {
  console.log(e);
	temperatureKeys = {};
}

morgan.token('x-real-ip', function(req) {
	//console.log('headers:\n' + JSON.stringify(req.headers) + '\n');
	return req.headers['x-real-ip'];
});

if(process.env.NODE_ENV === 'test') {
	app.use(morgan('combined', {
		skip: function(req, res) { return true; }
	}));
} else {
	app.use(morgan(':x-real-ip - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent"'));
}

function generateDeviceQuery(deviceID, extras) {
	var $or = []

	if (deviceID.ICCID) {
		$or.push({'deviceID.ICCID': deviceID.ICCID})
	}
	if (deviceID.IMEI) {
		$or.push({'deviceID.IMEI': deviceID.IMEI})
	}
	if (deviceID['Build.SERIAL']) {
		$or.push({'deviceID.Build>SERIAL': deviceID['Build.SERIAL']})
	}

	var basicQuery = {}
	if ($or.length > 0) {
		basicQuery.$or = $or
	}
	var result = Object.assign(basicQuery, extras)
	console.log(`deviceID: ${JSON.stringify(deviceID)}`)
	console.log(`query: ${JSON.stringify(result)}`)
	return result
}


app.use('/static', express.static(path.join(__dirname, 'static')));

app.get('/', (req, res) => {
	res.send(fs.readFileSync(__dirname + '/static/html/index.html', 'utf-8'));
});

app.get('/apk', (req, res) => {
	res.download(`${__dirname}/static/assets/smartphones-exposed.apk`, 'smartphones-exposed.apk');
});

app.get('/device-description', (req, res) => {
	var qs = req.query;
	var deviceID = qs.deviceID;

	// See if this model has an alias
	var model = deviceID['DeviceName'] || deviceID['Build.MODEL'];
	try {
		var modelAliases = yaml.safeLoad(fs.readFileSync('model-alias.yaml', 'utf-8'));
		model = modelAliases[model] || model;
	} catch(e) {
	}

	fonoapi.query(model).then((result) => {
		res.send(JSON.stringify(result));
	}).catch((err) => {
		console.log(JSON.stringify(err));
		res.send(JSON.stringify(err));
	});
});

function sendError(code, msg, res) {
	res.status(code).send(JSON.stringify({
		msg: msg,
	}));
}

app.get('/generate-temperature-plot', (req, res) => {
	var qs = req.query;
	// TODO: Get last 12 hours of data from mongoDB
	// for this deviceID and ship it over to python to plot
	var hours = qs.hours;
	var utcOffset = qs.utcOffset;
	var deviceID = qs.deviceID;
	var now = Date.now();
	var since = now - (hours * 60 * 60 * 1000);
	//console.log(`${JSON.stringify(deviceID)}`);
	var mongoDBQuery = generateDeviceQuery(deviceID, {
		type: 'temperature-data',
		lastTimestamp: {$gt: since},
	});
	console.log(`${JSON.stringify(mongoDBQuery)}`);
	mongo.query(mongoDBQuery).then((result) => {
		result.sort({lastTimestamp: 1}).toArray((err, docs) => {
			if(err) {
				console.log(err && err.stack);
				res.status(500).send(err.message);
				return;
			}
			var timestamps = [];
			var temperatures = [];
			console.log(`docs=${docs.length}`);
			for(var idx = 0; idx < docs.length; idx++) {
				timestamps.push.apply(timestamps, docs[idx]['timestamps']);
				temperatures.push.apply(temperatures, docs[idx]['temperatures']);
			}
			console.log(`timestamps=${timestamps.length} temperatures=${temperatures.length}`);
			if(timestamps.length === 0) {
				sendError(500, 'No temperature data collected yet. Please wait a while and try again.', res);
				return;
			}
			var json = {
				deviceID: deviceID,
				utcOffset: utcOffset,
				timestamps: timestamps,
				temperatures: temperatures,
			};
			console.log('Making temperature-plot request ...');
			request.post({
				url: 'http://localhost:10070/temperature-plot',
				body: JSON.stringify(json),
				gzip: true,
			}, function(err, _res, body) {
				//console.log(JSON.stringify(_res));
				if(err) {
					console.log(`[temperature-plot]: Error: ${err}`);
					sendError(500, JSON.stringify(err), res);
				} else if(_res.statusCode !== 200) {
					console.log(`[temperature-plot]: Error: ${_res.body}`);
					sendError(500, _res.body, res);
				} else {
					console.log(`[temperature-plot]: Success!`);
					res.status(200).send(body);
				}
			});
		});
	});
});

var lastExptUploadTime
app.post('/upload', function(req, res) {
	console.log(`Received upload POST: type=${req.body.type}`);
	var json = req.body;
	//console.log(JSON.stringify(json));
	if(!config.upload_types.includes(json.type)) {
		console.log(`Invalid data type: ${json.type}! Valid types: ${JSON.stringify(config.upload_types)}`);
		res.status(400).send('Invalid data type');
		return;
	}
	if (json.type === 'expt-data') {
		lastExptUploadTime = moment().local().format()
	}
	// TODO: Check for fields
	mongo.insertDocument(json).then((result) => {
		res.send('OK');
	}).catch((err) => {
		res.status(500).send('Failed to upload: ' + err + '\n' + err.stack);
	});;
});

function post(opts) {
	return new Promise((resolve, reject) => {
		request.post(opts, function(err, _res, body) {
			if(err) {
				reject(err);
			} else {
				resolve(body);
			}
		});
	});
}

app.get('/experiment-results', (req, res) => {
	var deviceID = req.query.deviceID;
	var exptID = req.query.experimentID;

	var mongoDBQuery = generateDeviceQuery({}, {
		type: 'expt-data',
		experimentID: exptID,
	});
	mongo.query(mongoDBQuery).then((result) => {
		result.toArray((err, docs) => {
			if(err) {
				console.log(err && err.stack);
				res.status(500).send(err.message);
				return;
			}
			// TODO: Format test data into 3 components
			// testInfo, testScore and testPlot and send it back
			console.log(`docs.length=${docs.length}`);
			if(docs.length === 0) {
				console.log(`ExperimentID: ${exptID} not found!`);
				res.send(JSON.stringify({
					error: 'Test not found. If you just completed the experiment, retry in some time as the logs may not have been uploaded yet',
				}));
				return;
			}
			var result = JSON.parse(JSON.stringify(docs[0]));
			delete result._id;

			var plotInput = Object.assign(result, {deviceID: deviceID});

			var exptPlotPromise = post({
				url: 'http://localhost:10070/experiment-plot',
				body: JSON.stringify(plotInput),
				gzip: true,
			})

			var exptRankingPromise = post({
				url: 'http://localhost:10070/experiment-ranking',
				body: JSON.stringify({
					experimentID: exptID
				}),
				gzip: true
			})

			exptPlotPromise.then((body) => {
				const testResults = JSON.parse(body);
				exptRankingPromise.then((rankingResult) => {
					testResults['rank'] = rankingResult
					res.send(JSON.stringify(testResults));
				})
			}).catch((err) => {
				res.status(500).send('' + err);
			});
		});
	});
});

app.get('/device-experiment-ids', (req, res) => {
	var deviceID = req.query.deviceID;
	var mongoDBQuery = generateDeviceQuery(deviceID, {
		type: 'expt-data',
	});
	mongo.query(mongoDBQuery).then((result) => {
		result.toArray((err, docs) => {
			if(err) {
				console.log(err && err.stack);
				res.status(500).send(err.message);
				return;
			}
			var experimentIDs = [];
			for(var idx = 0; idx < docs.length; idx++) {
				var doc = docs[idx];
				experimentIDs.push(doc.experimentID);
			}
			console.log(`Found ${experimentIDs.length} experiments for device=${deviceID['Settings.Secure.ANDROID_ID']}`);
			res.send(JSON.stringify(experimentIDs));
		});
	});
});
app.get('/device-rank', function(req, res) {
	var deviceID = req.query.deviceID;
	var model = deviceID['BUILD.MODEL'];
	request.post({
		url: 'http://localhost:10070/',
		body: JSON.stringify(json),
		gzip: true,
	}, function(err, _res, body) {
		if(err) {
			console.log(`[temperature-plot]: Error: ${err}`);
			res.status(500).send('' + err);
		} else {
			console.log(`[temperature-plot]: Success!`);
			res.status(200).send(body);
		}
	});
});

var lastThermaboxSetLimits
var thermaboxLimits
app.post('/thermabox-set-limits', function (req, res) {
	var body = req.body
	thermaboxLimits = body
	console.log(JSON.stringify(`thermaboxLimits=${JSON.stringify(thermaboxLimits)}`))
	lastThermaboxSetLimits = Date.now()
	res.send('OK')
})
app.get('/thermabox-last-temperature', function (req, res) {
	var now = Date.now()
	if (now - lastThermaboxSetLimits < 4 * 60 * 60 * 1000) {
		res.send(`${thermaboxLimits.temperature}`)
	} else {
		res.send('')
	}
})
app.get('/thermabox-last-threshold', function (req, res) {
	var now = Date.now()
	if (now - lastThermaboxSetLimits < 4 * 60 * 60 * 1000) {
		res.send(`${thermaboxLimits.threshold}`)
	} else {
		res.send('')
	}
})

app.get('/pi-test', function (req, res) {
	res.send(fs.readFileSync(__dirname + '/static/html/pi-test.html', 'utf-8'));
});

app.get('/pi-test-auto', function (req, res) {
	res.send(fs.readFileSync(__dirname + '/static/html/pi-test-auto.html', 'utf-8'));
});

app.get('/sweep-cooldown', function (req, res) {
	res.send(fs.readFileSync(__dirname + '/static/html/sweep-cooldown.html', 'utf-8'));
});

app.get('/canvas-test', function (req, res) {
	res.send(fs.readFileSync(__dirname + '/static/html/canvas-test.html', 'utf-8'))
})


var rawData = [];

function nowDateStr() {
	var now = moment().local();
	var dateStr = now.format('YYYY-MM-DD HH:mm:ss');
	return dateStr;
}

app.post('/harness-upload', function(req, res) {
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

var lastInfoTime;
app.post('/info', function(req, res) {
	lastInfoTime = moment().local().format();
	var body = req.rawBody || req.body;
	console.log(JSON.stringify(body));
	res.send('OK');
});

app.get('/last-info', function (req, res) {
	res.send(lastInfoTime)
})
app.get('/last-expt-upload', function (req, res) {
	res.send(lastExptUploadTime)
})
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
					var cpus = fonoapi.resolveNumCPUs(body[0].cpu);
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
									var cpus = fonoapi.resolveNumCPUs(body[0].cpu);
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
