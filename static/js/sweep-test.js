/* eslint-env jquery */
// TODO: Fix this to work with arguments
// console.log = function (str) {
//   AndroidAPI.log('chromium', `[INFO:CONSOLE(43)] "${str}", source: undefined (43)`)
// }

$(document).on('angular-ready', function (e, app) {
  app.controller('sweepTestController', ['$scope', '$window', function ($scope, $window) {
    console.log('Running sweepTestController')
    // Start experiment to acquire wakelock
    var exptID = AndroidAPI.startExperiment()

    $scope.monsoonHost = '192.168.2.178'
    $scope.monsoonPort = 20400

    $scope.native = false
    $scope.debug = false

    $scope.WARMUP_DURATION = $scope.debug ? 10 * 1000 : 60 * 1000

    $scope.workloadDurationMinutes = 7
    $scope.cooldownDurationMinutes = 10

    var uri = URI(window.location.href)
    var q = uri.query(true)

    $scope.startTemp = AndroidAPI.getStartTemp()
    $scope.endTemp = AndroidAPI.getEndTemp()
    $scope.step = AndroidAPI.getStep()
    $scope.numIterations = AndroidAPI.getNumIterations()
    $scope.temp = Number(q.temp)
    $scope.iter = Number(q.iter)

    // Termination condition
    if ($scope.temp >= $scope.endTemp) {
      window.location.href = 'about:blank'
    }

    var newQ = $.extend({}, {}, q)
    if ($scope.iter === $scope.numIterations - 1) {
      newQ.temp = $scope.temp + $scope.step
      newQ.iter = 0
    } else {
      newQ.iter++
    }
    var newURL = URI(uri).removeQuery(q).addQuery(newQ)
    console.log(JSON.stringify({
      currentURL: uri.toString(),
      newURL: newURL.toString()
    }))

    function getDesiredCPUTemperature () {
      if ($scope.debug) {
        return $scope.temp + 40
      } else {
        return $scope.temp + 10
      }
    }

    function doCooldown () {
      try {
        console.log('test finished. Attempting cooldown ...')
        $scope.cooldownData = JSON.parse(AndroidAPI.sleepForDuration($scope.test.getTestObj().COOLDOWN_DURATION_MS))
      } catch (e) {
        console.log('Failed cooldown: ' + e)
      }
    }

    function uploadData (str) {
      var key = AndroidAPI.startUploadData()

      var MAX_CHUNK_SIZE = 32 * 1024
      function chunkSubstr (str, size) {
        var numChunks = Math.ceil(str.length / size)
        var chunks = new Array(numChunks)

        for (var i = 0, o = 0; i < numChunks; ++i, o += size) {
          chunks[i] = str.substr(o, size)
        }

        return chunks
      }
      var chunks = chunkSubstr(str, MAX_CHUNK_SIZE)
      for (var idx = 0; idx < chunks.length; idx++) {
        AndroidAPI.upload(key, chunks[idx])
      }
      AndroidAPI.finishUploadData(key)
      return key
    }

    $(window).on('test-finished', function () {
      doCooldown()

      AndroidAPI.toast('Uploading logs')
      var testResults = $scope.test.getResult()

      testResults['testType'] = 'tengine-study'
      testResults['ambientTemperature'] = $scope.temp
      testResults['sweepIteration'] = $scope.iter
      testResults['startTemperature'] = $scope.exptStartTemp
      testResults['cooldownData'] = $scope.cooldownData
      var key = uploadData(JSON.stringify(testResults))
      AndroidAPI.uploadExperimentData('http://sweeptest.smartphone.exposed/', 'upload-expt-data', key)
      $scope.$root.testResults.push(exptID)

      // Cleanup
      clearInterval($scope.progressInterval)
      $('#test-progress').css('width', '0%')
      // Enable navigation
      $scope.$root.$broadcast('enable-navigation')
      AndroidAPI.stopMonsoon($scope.monsoonHost, $scope.monsoonPort)
      AndroidAPI.setURL(newURL.toString())
    })

    $scope.startTest = function () {
      $scope.test = PiTest()
      $scope.test.COOLDOWN_DURATION_MS = $scope.cooldownDurationMinutes * 60 * 1000
      $scope.test.testTimeMs = $scope.workloadDurationMinutes * 60 * 1000

      // Disable navigation
      $scope.$root.$broadcast('disable-navigation')
      var start = Date.now()
      var totalMs = ($scope.workloadDurationMinutes + $scope.cooldownDurationMinutes) * 60 * 1000
      $scope.progressInterval = setInterval(function () {
        var now = Date.now()
        var pct = ((now - start) / totalMs) * 100
        $('#test-progress').css('width', pct + '%')
      }, 2 * 1000)

      var systemTime = AndroidAPI.systemTime()
      var upTime = AndroidAPI.upTime()
      var jsTime = Date.now()
      var timeDict = {
        systemTime: systemTime,
        upTime: upTime,
        jsTime: jsTime
      }

      var cpuTemperature = getDesiredCPUTemperature()

      function padDate (val) {
        return ('0' + val).slice(-2)
      }

      var now = new Date()
      var filename = 'monsoon-' + exptID + '-' + now.getFullYear() + padDate(now.getMonth()) + padDate(now.getDate()) + ' ' + padDate(now.getHours()) + ':' + padDate(now.getMinutes()) + ':' + padDate(now.getSeconds()) + '.gz'
      console.log('Starting monsoon')
      AndroidAPI.startMonsoon($scope.monsoonHost, $scope.monsoonPort, JSON.stringify({
        size: 1,
        filepath: '/home/guru/workspace/smartphones.exposed/logs/' + filename
      }))
      if (!$scope.debug) {
        console.log('Running powersync')
        AndroidAPI.runPowerSync()
      }

      console.log(`Warming up device a little bit ...`)
      AndroidAPI.warmup($scope.WARMUP_DURATION)

      // Set temperature
      console.log(`Waiting for phone temperature: ${cpuTemperature}`)
      AndroidAPI.waitUntilAmbientTemperature(cpuTemperature, 'http://sweeptest.smartphone.exposed/info')

      AndroidAPI.post('http://sweeptest.smartphone.exposed/info', JSON.stringify({msg: `Starting experiment`}))

      var tempReading = JSON.parse(AndroidAPI.getTemperature())
      $scope.exptStartTemp = tempReading.temperature

      if ($scope.native) {
        var resultsStr = AndroidAPI.runOrigWorkloadPi(0, $scope.test.testTimeMs, "")
        var results = JSON.parse(resultsStr)
        $scope.test.startTime = results.startTime
        $scope.test.endTime = results.endTime
        $scope.test.results = results.iterations
        $(window).trigger('test-finished')
      } else {
        $scope.test.run()
      }
    }

    $scope.$on('$viewContentLoaded', function () {
      console.log('sweepTestController: $viewContentLoaded')
      $(document).on('thermabox-stable', function () {
        $scope.startTest()
      })

      // Setup thermabox
      function checkStability () {
        var stableStart
        var lastLogTime = Date.now()
        var interval = setInterval(function () {
          thermabox.getState(function (state) {
            console.log('Thermabox: state=' + state)
            if (Date.now() - lastLogTime > 10 * 1000) {
              AndroidAPI.post('http://sweeptest.smartphone.exposed/info', JSON.stringify({msg: 'Thermabox state=' + state}))
              lastLogTime = Date.now()
            }
            if (state === 'stable') {
              if (!stableStart) {
                stableStart = Date.now()
              } else {
                var now = Date.now()
                if ((now - stableStart) > 30 * 1000) {
                  clearInterval(interval)
                  $(document).trigger('thermabox-stable')
                }
              }
            } else {
              stableStart = undefined
            }
          })
        }, 1000)
      }

      console.log(`Target ambient temperature: ${$scope.temp}`)
      console.log('Attempting to check thermabox limits & stability')

      thermabox.getLimits(function (data) {
        var json = JSON.parse(data)
        console.log('thermabox: limits: ' + JSON.stringify(json))
        if (json.temperature !== $scope.temp) {
          var limits = {
            temperature: $scope.temp,
            threshold: 0.5
          }
          console.log('Setting limits: ' + JSON.stringify(limits))
          thermabox.setLimits($scope.temp, 0.5, function () {
            // Start checking after 1s
            setTimeout(checkStability, 1000)
          })
        } else {
          checkStability()
        }
      })
      // $(document).trigger('thermabox-stable')
    })
  }])
})
