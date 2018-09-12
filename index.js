require = require('esm')(module)
const fs = require('fs')
const path = require('path')
const request = require('request')
const express = require('express')
const bodyParser = require('body-parser')
const moment = require('moment')
const compression = require('compression')
const morgan = require('morgan')
const util = require('util')
const cors = require('cors')
const httpRewrite = require('http-rewrite-middleware')
const RateLimit = require('express-rate-limit')

const http = require('http')
const https = require('https')
const yaml = require('js-yaml')
const MongoDB = require('./mongo').default
const FonoAPI = require('./fonoapi').default
const config = require('./appconfig').default
const thermabox = require('./src/js/thermabox.js').default
const PeriodicTask = require('./periodic-task').default

var app = express()
app.enable('trust-proxy')
app.use(compression())
app.use(bodyParser.json({limit: '200mb'}))
app.use(cors())
app.use(httpRewrite.getMiddleware([
  // Strip '/api' from any incoming request
  {
    from: '^/api/(.*)$',
    to: '/$1'
  }
]))

var httpServer
var httpsServer

httpServer = http.createServer(app)

var HTTPS_PORT = 8112
var HTTP_PORT = HTTPS_PORT + 100

if (config.https) {
  httpsServer = https.createServer(config.https, app)
}

const mongo = new MongoDB(config.mongodb.url, config.mongodb.database)
const fonoapi = new FonoAPI(config.fonoapi_key)

var temperatureKeys
try {
  temperatureKeys = yaml.safeLoad(fs.readFileSync('./temperature-keys.yaml', 'utf8'))
} catch (e) {
  console.log(e)
  temperatureKeys = {}
}

morgan.token('x-real-ip', function (req) {
  // console.log('headers:\n' + JSON.stringify(req.headers) + '\n');
  return req.headers['x-real-ip']
})

if (process.env.NODE_ENV === 'test') {
  app.use(morgan('combined', {
    skip: function (req, res) { return true }
  }))
} else {
  app.use(morgan(':x-real-ip - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent"', {
    skip: (req, res) => {
      if (req.url.includes('/thermabox/')) {
        return true
      }
    }
  }))
}

function generateDeviceQuery (deviceID, extras) {
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

app.get('/apk', (req, res) => {
  res.download(`${__dirname}/static/assets/smartphones-exposed.apk`, 'smartphones-exposed.apk')
})

function extractFromQueryAsJSON(v) {
  if (typeof v === 'string') {
    return JSON.parse(v)
  } else if (typeof v === 'object') {
    return v
  } else {
    throw new Error(`Unexpected type='${typeof v}'..was expecting 'string' or 'object'`)
  }
}

app.get('/device-description', (req, res) => {
  var qs = req.query
  var deviceID = extractFromQueryAsJSON(qs.deviceID)
  // console.log(`deviceID=${JSON.stringify(deviceID)}`)

  fonoapi.query(deviceID).then((result) => {
    res.send(result)
  }).catch((err) => {
    console.log(JSON.stringify(err))
    res.send(JSON.parse(JSON.stringify(err)))
  })
})

function sendError (code, msg, res) {
  res.status(code).send(JSON.stringify({
    msg: msg
  }))
}

function sanitizeTemperatures (json) {
  return new Promise((resolve, reject) => {
    request.post({
      url: 'http://localhost:10070/sanitize-temperatures',
      body: JSON.stringify(json),
      gzip: true
    }, function (err, _res, body) {
      // console.log(JSON.stringify(_res));
      if (err) {
        // console.log(`[temperature-plot]: Error: ${err}`)
        reject(new Error(JSON.stringify(err)))
      } else if (_res.statusCode !== 200) {
        // console.log(`[temperature-plot]: Error: ${_res.body}`)
        reject(new Error(_res.body))
      } else {
        // console.log(`[temperature-plot]: Success!`)
        resolve(body)
      }
    })
  })
}
app.get('/temperature-data', (req, res) => {
  var qs = req.query
  // TODO: Get last 12 hours of data from mongoDB
  // for this deviceID and ship it over to python to plot
  var hours = Number(qs.hours)
  var utcOffset = Number(qs.utcOffset)
  var deviceID = extractFromQueryAsJSON(qs.deviceID)
  var now = Date.now()
  var since = now - (hours * 60 * 60 * 1000)
  // console.log(`${JSON.stringify(deviceID)}`);
  var mongoDBQuery = generateDeviceQuery(deviceID, {
    type: 'temperature-data',
    lastTimestamp: {$gt: since}
  })
  console.log(`${JSON.stringify(mongoDBQuery)}`)
  mongo.query(mongoDBQuery).then((result) => {
    result.sort({lastTimestamp: 1}).toArray((err, docs) => {
      if (err) {
        console.log(err && err.stack)
        res.status(500).send(err.message)
        return
      }

      var timestamps = []
      var temperatures = []
      console.log(`docs=${docs.length}`)
      for (var idx = 0; idx < docs.length; idx++) {
        timestamps.push.apply(timestamps, docs[idx]['timestamps'])
        temperatures.push.apply(temperatures, docs[idx]['temperatures'])
      }
      console.log(`timestamps=${timestamps.length} temperatures=${temperatures.length}`)
      if (timestamps.length === 0) {
        sendError(500, 'No temperature data available for the specified duration. Please try again with a larger duration.', res)
        return
      }

      var json = {
        deviceID: deviceID,
        utcOffset: utcOffset,
        timestamps: timestamps,
        temperatures: temperatures
      }
      sanitizeTemperatures(json).then((data) => {
        res.status(200).send(data)
      }).catch((err) => {
        sendError(500, err.message, res)
      })
    })
  })
})

app.get('/generate-temperature-plot', (req, res) => {
  var qs = req.query
  // TODO: Get last 12 hours of data from mongoDB
  // for this deviceID and ship it over to python to plot
  var hours = qs.hours
  var utcOffset = qs.utcOffset
  var deviceID = extractFromQueryAsJSON(qs.deviceID)
  var now = Date.now()
  var since = now - (hours * 60 * 60 * 1000)
  // console.log(`${JSON.stringify(deviceID)}`);
  var mongoDBQuery = generateDeviceQuery(deviceID, {
    type: 'temperature-data',
    lastTimestamp: {$gt: since}
  })
  console.log(`${JSON.stringify(mongoDBQuery)}`)
  mongo.query(mongoDBQuery).then((result) => {
    result.sort({lastTimestamp: 1}).toArray((err, docs) => {
      if (err) {
        console.log(err && err.stack)
        res.status(500).send(err.message)
        return
      }
      var timestamps = []
      var temperatures = []
      console.log(`docs=${docs.length}`)
      for (var idx = 0; idx < docs.length; idx++) {
        timestamps.push.apply(timestamps, docs[idx]['timestamps'])
        temperatures.push.apply(temperatures, docs[idx]['temperatures'])
      }
      console.log(`timestamps=${timestamps.length} temperatures=${temperatures.length}`)
      if (timestamps.length === 0) {
        sendError(500, 'No temperature data collected yet. Please wait a while and try again.', res)
        return
      }
      var json = {
        deviceID: deviceID,
        utcOffset: utcOffset,
        timestamps: timestamps,
        temperatures: temperatures
      }
      console.log('Making temperature-plot request ...')
      request.post({
        url: 'http://localhost:10070/temperature-plot',
        body: JSON.stringify(json),
        gzip: true
      }, function (err, _res, body) {
        // console.log(JSON.stringify(_res));
        if (err) {
          console.log(`[temperature-plot]: Error: ${err}`)
          sendError(500, JSON.stringify(err), res)
        } else if (_res.statusCode !== 200) {
          console.log(`[temperature-plot]: Error: ${_res.body}`)
          sendError(500, _res.body, res)
        } else {
          console.log(`[temperature-plot]: Success!`)
          res.status(200).send(body)
        }
      })
    })
  })
})

var lastExptUploadTime
async function upload (json) {
  // console.log(JSON.stringify(json));
  if (!config.upload_types.includes(json.type)) {
    console.log(`Invalid data type: ${json.type}! Valid types: ${JSON.stringify(config.upload_types)}`)
    res.status(400).send('Invalid data type')
    return
  }
  switch (json.type) {
    case 'expt-data':
      lastExptUploadTime = moment().local().format()
      break
    case 'tracing-data':
      // Incoming data is all essentially strings.
      // Process this data with python
      json = JSON.parse(await post({
        url: 'http://localhost:10070/parse-trace',
        body: JSON.stringify(json),
        gzip: true
      }))
      break
  }
  // TODO: Check for fields
  return mongo.insertDocument(json)
}

app.post('/upload', async (req, res) => {
  console.log(`Received upload POST: type=${req.body.type}`)
  var json = req.body
  try {
    await upload(json)
    res.send('OK')
  } catch (err) {
    res.send('Failed to upload: ' + err + '\n' + err.stack)
  }
})

function post (opts) {
  return new Promise((resolve, reject) => {
    request.post(opts, function (err, _res, body) {
      if (err) {
        return reject(err)
      } else if (_res.statusCode !== 200) {
        return reject(body)
      } else {
        resolve(body)
      }
    })
  })
}

app.get('/experiment-data', async (req, res) => {
  const { query } = req
  const { experimentID } = req.query

  var mongoDBQuery = generateDeviceQuery({}, {
    type: 'expt-data',
    experimentID
  })
  const result = await mongo.query(mongoDBQuery)
  result.toArray((err, docs) => {
    if (err) {
      console.log(err && err.stack)
      res.status(500).send(err.message)
      return
    }
    // TODO: Format test data into 3 components
    // testInfo, testScore and testPlot and send it back
    console.log(`docs.length=${docs.length}`)
    if (docs.length === 0) {
      console.log(`ExperimentID: ${experimentID} not found!`)
      res.send(JSON.stringify({
        error: 'Test not found. If you just completed the experiment, retry in some time as the logs may not have been uploaded yet'
      }))
      return
    }

    var result = JSON.parse(JSON.stringify(docs[0]))
    delete result._id
    res.send(result)
  })
})
app.get('/experiment-results', (req, res) => {
  var deviceID = extractFromQueryAsJSON(req.query.deviceID)
  const experimentID = req.query.experimentID
  const utcOffset = 0 //req.query.utcOffset
  const query = {
    deviceID,
    experimentID,
    utcOffset
  }

  var mongoDBQuery = generateDeviceQuery({}, {
    type: 'expt-data',
    experimentID
  })
  mongo.query(mongoDBQuery).then((result) => {
    result.toArray((err, docs) => {
      if (err) {
        console.log(err && err.stack)
        res.status(500).send(err.message)
        return
      }
      // TODO: Format test data into 3 components
      // testInfo, testScore and testPlot and send it back
      console.log(`docs.length=${docs.length}`)
      if (docs.length === 0) {
        console.log(`ExperimentID: ${experimentID} not found!`)
        res.send(JSON.stringify({
          error: 'Test not found. If you just completed the experiment, retry in some time as the logs may not have been uploaded yet'
        }))
        return
      }

      var result = JSON.parse(JSON.stringify(docs[0]))
      delete result._id

      // We don't really use incoming deviceID and we shouldn't rely on it
      // Instead, we use the result's deviceID, but fix the keys since
      // dots were replaced with > while inserting into MongoDB
      const fixedDeviceID = {}
      Object.keys(result.deviceID).forEach(key => {
        const fixedKey = key.replace('>', '.')
        fixedDeviceID[fixedKey] = result.deviceID[key]
      })
      deviceID = fixedDeviceID
      var plotInput = Object.assign(result, {deviceID})

      var testResults = {}
      var failed = false
      var exptPlotPromise = post({
        url: 'http://localhost:10070/experiment-plot',
        body: JSON.stringify(plotInput),
        gzip: true
      }).then((body) => {
        Object.assign(testResults, JSON.parse(body))
      })

      var exptRankingPromise = post({
        url: 'http://localhost:10070/experiment-ranking',
        body: JSON.stringify({
          deviceID,
          experimentID
        }),
        gzip: true
      }).then((rank) => {
        testResults['rankingData'] = JSON.parse(rank)
      }).catch((err) => {
        testResults['rankingData'] = JSON.parse(err)
      })

      var sanitizePromise = sanitizeTemperatures({
        deviceID,
        utcOffset,
        timestamps: result.temperatureData.timestamps,
        temperatures: result.temperatureData.temperatures
      }).then((body) => {
        var ttData = JSON.parse(body)
        testResults.rawData = result
        Object.assign(testResults.rawData.temperatureData, ttData)
      })

      Promise.all([exptPlotPromise, exptRankingPromise, sanitizePromise]).then(() => {
        Object.assign(testResults, {
          valid: result.valid,
          validityReasons: result.validityReasons
        })
        res.send(JSON.stringify(testResults))
      }).catch((e) => {
        console.error(e)
        res.status(500).send('Server failed: ' + err)
      })
    })
  })
})

app.get('/device-experiment-ids', (req, res) => {
  var deviceID = extractFromQueryAsJSON(req.query.deviceID)
  console.log(`Got request for device-experiment-ids: deviceID=${JSON.stringify(deviceID)}`)
  if (!deviceID['Build.HARDWARE']) {
    // Something strange is going on
    return res.send({
      data: {},
      order: []
    })
  }

  var mongoDBQuery = generateDeviceQuery(deviceID, {
    type: 'expt-data',
  })
  mongo.query(mongoDBQuery, {
    projection: {
      experimentID: 1,
      startTime: 1
    },
    sort: {
      $natural: -1
    }
  }).then((result) => {
    result.toArray((err, docs) => {
      if (err) {
        console.log(err && err.stack)
        res.status(500).send(err.message)
        return
      }
      var results = {
        data: {},
        order: []
      }
      var exptSet = new Set()
      for (var idx = 0; idx < docs.length; idx++) {
        var doc = docs[idx]
        results.data[doc.experimentID] = {
          experimentID: doc.experimentID,
          startTime: doc.startTime
        },
        exptSet.add(doc.experimentID)
      }
      results.order.push(...Array.from(exptSet))
      console.log(`Found ${results.order.length} experiments for device=${deviceID['Settings.Secure.ANDROID_ID']}`)
      res.send(JSON.stringify(results))
    })
  })
})
app.get('/device-rank', function (req, res) {
  const deviceID = extractFromQueryAsJSON(req.query.deviceID)
  const model = deviceID['BUILD.MODEL']
  request.post({
    url: 'http://localhost:10070/',
    body: JSON.stringify(json),
    gzip: true
  }, function (err, _res, body) {
    if (err) {
      console.log(`[temperature-plot]: Error: ${err}`)
      res.status(500).send('' + err)
    } else {
      console.log(`[temperature-plot]: Success!`)
      res.status(200).send(body)
    }
  })
})


async function isExperimentValid (exptID) {
  const query = {
    experimentID: exptID,
  }
  console.log(`[is-experiment-valid]: experimentID=${exptID}`)

  var mongoDBQuery = generateDeviceQuery({}, {
    type: 'expt-data',
    experimentID: exptID
  })

  const result = await mongo.query(mongoDBQuery)
  return new Promise((resolve, reject) => {
    result.toArray((err, docs) => {
      if (err) {
        console.log(err && err.stack)
        return reject(err)
      }
      console.log(`docs.length=${docs.length}`)
      if (docs.length === 0) {
        return reject(new Error(`Invalid experimentID`))
      }
      const doc = docs[0]
      var result = {
        experimentID: doc.experimentID,
        valid: doc.valid,
        validityReasons: doc.validityReasons
      }
      resolve(result)
    })
  })
}

var exptValidRateLimiter = new RateLimit({
  windowMs: 15*60*1000,
  max: 20,
  delayMs: 0
})

app.get('/is-experiment-valid', exptValidRateLimiter, (req, res) => {
  const exptID = req.query.experimentID

  isExperimentValid(exptID).then((result) => {
    res.send(JSON.stringify(result))
  }).catch((err) => {
    res.status(500).send(JSON.stringify({
      error: err.message
    }))
  })
})

app.get('/thermabox/query', async (req, res) => {
  const { query } = req
  // TODO: Get last 12 hours of data from mongoDB
  // for this deviceID and ship it over to python to plot
  if (!query.start || !query.end) {
    return res.status(400).send('Bad Request. Missing start/end query parameters')
  }
  const start = Number(query.start)
  const end = Number(query.end)

  var utcOffset = Number(query.utcOffset)

  // console.log(`${JSON.stringify(deviceID)}`);
  var mongoDBQuery = {
    type: 'thermabox-data',
    timestamp: {
      $gte: start,
      $lt: end
    }
  }
  const result = await mongo.query(mongoDBQuery)
  try {
    const docs = await mongo.getResultAsArray(result.sort({$natural: 1}))
    const data = docs.map(doc => ({state: doc.state, timestamp: doc.timestamp, temperature: doc.temperature}))
    res.send(data)
  } catch (err) {
    console.log(err && err.stack)
    return res.status(500).send(err.message)
  }
})

app.post('/thermabox/update-state', async (req, res) => {
  const state = req.body
  state.type = 'thermabox-data'
  try {
    await upload(state)
    res.send('OK')
  } catch (e) {
    res.status(500).send(`Failed to upload thermabox state: ${JSON.stringify(e)}`)
  }
})

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

var rawData = []

function nowDateStr () {
  var now = moment().local()
  var dateStr = now.format('YYYY-MM-DD HH:mm:ss')
  return dateStr
}

app.post('/harness-upload', function (req, res) {
  var id = req.get('device-id')
  var exptId = req.get('expt-id')
  function pad (num, size) { return ('000000000' + num).substr(-size) }

  if (!id) {
    console.log(JSON.stringify(req.headers, null, '  '))
  }
  console.log('Receiving upload: %s ...', id)
  /*
	var dateString = new Date().toISOString().
	  replace(/T/, ' ').      // replace T with a space
	  replace(/\..+/, '');     // delete the dot and everything after
	*/
  var dateString = nowDateStr()

  var fileName = id + '-expt_' + pad(exptId, 3) + '-' + dateString
  var data = req.rawBody + '\n' + rawData.join('\n')
  fs.writeFileSync('logs/' + fileName, data)
  rawData = []
  res.send('OK')
})

var lastInfoTime
app.post('/info', function (req, res) {
  lastInfoTime = moment().local().format()
  var body = req.rawBody || req.body
  console.log(JSON.stringify(body))
  res.send('OK')
})

app.get('/last-info', function (req, res) {
  res.send(lastInfoTime)
})
app.get('/last-expt-upload', function (req, res) {
  res.send(lastExptUploadTime)
})
app.post('/raw-data', function (req, res) {
  // Anything uploaded to raw-data gets appended to the next uploaded file
  console.log('Got raw-data')
  rawData.push(req.rawBody)
  res.send('OK')
})

app.get('/cpu-config', function (req, res) {
  var fullName = req.query.name
  fullName = 'Google Nexus 6'
  console.log('Attempting to query fonoapi for "' + fullName + '"')
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
        console.log('Response: ' + JSON.stringify(body))
        try {
          var cpus = fonoapi.resolveNumCPUs(body[0].cpu)
          res.send({
            'status': 'OK',
            'result': cpus
          })
        } catch (e) {
          res.sendStatus(500)
        }
      } else {
        // We failed to find the device using the full name. Try ignoring the first word which could be the brand
        var model = fullName.substr(fullName.indexOf(' ') + 1)
        request.post(
          'https://fonoapi.freshpixl.com/v1/getdevice',
          {json: {token: config.fonoapi_key, limit: 5, device: model}},
          function (error, response, body) {
            if (!error && response.statusCode == 200 && body.status !== 'error') {
              console.log('Response: ' + JSON.stringify(body))
              try {
                var cpus = fonoapi.resolveNumCPUs(body[0].cpu)
                res.send({
                  'status': 'OK',
                  'result': cpus
                })
              } catch (e) {
                res.sendStatus(500)
              }
            } else {
              // We could not find a device
              console.log('Could not find info on "%s" or "%s"', fullName, model)
              res.sendStatus(500)
            }
          }
        )
      }
    }
  )
})

var crowdsourceSubmissionRateLimiter = new RateLimit({
  windowMs: 15*60*1000,
  max: 20,
  delayMs: 0
})

app.post('/crowdsource', crowdsourceSubmissionRateLimiter, (req, res) => {
  const data = req.body
  const mongoData = {
    type: 'crowdsource-data',
    experimentID: data.experimentID.split(','),
    emailID: data.emailID,
    'learnt-something-new': data['learnt-something-new'],
    'interested-in-rank': data['interested-in-rank']
  }

  const promises = mongoData.experimentID.map(async (exptID) => {
    try {
      return await isExperimentValid(exptID)
    } catch (e) {
      return undefined
    }
  })
  let successResponse = ['Thank you for your participation.']
  let promise
  Promise.all(promises).then((data) => {
    validExperiments = data.filter(e => !!e && e.valid).map(e => e.experimentID)
    console.log(`ValidExperiments: ${JSON.stringify(validExperiments)}`)
    mongoData.experimentID = validExperiments
    if (validExperiments.length === 0) {
      successResponse.push('Unfortunately, none of the entered experiment IDs were valid.')
    }
    if (validExperiments.length > 0) {
      promise = mongo.insertDocument(mongoData)
    } else {
      promise = new Promise((resolve, reject) => {
        resolve()
      })
    }
    promise.then(() => {
      res.send(successResponse.join('<br>'))
    }).catch((e) => {
      res.status(500).send(`Failed: ${e}`)
    })
  })
})

app.get('/timestamp', (req, res) => {
    res.send({timestamp: moment().local().valueOf()})
})

const thermaboxData = {}
const thermaboxIntervals = {}
app.get('/record-thermabox', async (req, res) => {
  const qs = req.query
  const { experimentID, event } = qs
  if (!experimentID || !event) {
    return res.status(400).send('Bad Request')
  }
  var task
  var result
  switch (event) {
    case 'start':
      thermaboxData[experimentID] = {}
      thermaboxData[experimentID].limits = await thermabox.getLimits()
      thermaboxData[experimentID].data = []

      task = new PeriodicTask(async () => {
        const temperature = await thermabox.getTemperature()
        const state = await thermabox.getState()
        thermaboxData[experimentID].data.push({
          timestamp: moment().local().valueOf(),
          temperature,
          state
        })
      }, 300)
      thermaboxIntervals[experimentID] = task
      task.start()
      result = {status: 'OK'}
      break
    case 'stop':
      task = thermaboxIntervals[experimentID]
      task && task.stop()
      result = thermaboxData[experimentID]
      delete thermaboxIntervals[experimentID]
      delete thermaboxData[experimentID]
      break
  }
  res.send(result)
})

httpServer.listen(HTTP_PORT, function () {
  console.log('smartphones.exposed core-app listening for HTTP on port %d', HTTP_PORT)
})

if (httpsServer) {
  httpsServer.listen(HTTPS_PORT, function () {
    console.log('smartphones.exposed core-app listening for HTTPS on port %d', HTTPS_PORT)
  })
}
