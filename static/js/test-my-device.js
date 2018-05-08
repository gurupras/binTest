$(document).on('angular-ready', function (e, app) {
  app.controller('testMyDeviceController', ['$scope', '$window', function ($scope, $window) {
    console.log('Running testMyDeviceController')
    $scope.logs = ['Initialized']

    $scope.native = false
    $scope.debug = false
    $scope.cooldownFirst = true

    $scope.warmupDurationMinutes = $scope.debug ? 0.1 : 3
    $scope.workloadDurationMinutes = $scope.debug ? 0.3 : 5
    $scope.cooldownDurationMinutes = $scope.debug ? 0.3 : 10

    $scope.WARMUP_DURATION = $scope.warmupDurationMinutes * 60 * 1000

    $scope.callbackCode = AndroidAPI.addChargeStateCallback(`(function() {
      var $scope = angular.element($('#test-prerequisites')[0]).scope();
      $scope.$apply(function() {
        $scope.checkRequisites();
      });
    })()
    `)

    $scope.$on('$destroy', function () {
      if ($scope.callbackCode) {
        AndroidAPI.removeChargeStateCallback($scope.callbackCode)
      }
    })

    addRequirements($scope)
    $scope.checkRequisites()

    // TODO: Add code to check requisites
    $scope.startTest = function () {
      setTimeout(function () {
        runTest($scope)
      }, 100)
    }
  }])
})

function addRequirements ($scope) {
  $scope.requirements = [
    {
      label: 'Phone not charging',
      id: 'req-not-charging',
      checkedCondition: 'isPluggedIn === false'
    },
    {
      label: 'Battery > 80%',
      id: 'req-battery-level',
      checkedCondition: 'batteryLevel > 0.8'
    }
    // {
    //   label: 'Screen off',
    //   id: 'req-screen-off',
    // },
  ]

  $scope.checkRequisites = function () {
    $scope.isPluggedIn = AndroidAPI.isPluggedIn()
    $scope.batteryLevel = AndroidAPI.getBatteryLevel()
    if ($scope.isPluggedIn || $scope.batteryLevel < 0.8) {
      if ($scope.runningTest && $scope.test) {
        $scope.test.setValid(false)
      }
    }
  }
}

function runTest ($scope, externalCall, appendToResult) {
  console.log(`Called runTest ...`)
  $scope.logs.length = 1

  if (!AndroidAPI.isDozeDisabled()) {
    AndroidAPI.showDozeDialog("Android Doze is known to cause problems with our tests. Please disable Android Doze to run tests.")
    return
  }

  $scope.runningTest = true

  if (!$scope.requirements) {
    addRequirements($scope)
  }

  function uploadData (str) {
    var key = AndroidAPI.startUploadData()

    const MAX_CHUNK_SIZE = 32 * 1024
    function chunkSubstr (str, size) {
      const numChunks = Math.ceil(str.length / size)
      const chunks = new Array(numChunks)

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

  function doCooldown () {
    try {
      console.log('Attempting cooldown ...')
      $scope.$apply(() => {
        $scope.logs.push('Running cooldown')
      })
      $scope.cooldownData = JSON.parse(AndroidAPI.sleepForDuration($scope.test.getTestObj().COOLDOWN_DURATION_MS))
    } catch (e) {
      console.log('Failed cooldown: ' + e)
    }
  }

  function clear () {
    // $scope.runningTest = undefined
    $scope.test = undefined
    $scope.interrupting = undefined
    $scope.testResults = ''
  }
  clear()

  $scope.checkRequisites()

  $scope.$on('$destroy', function () {
    if ($scope.runningTest) {
      $scope.interruptTest()
    }
  })

  function startTest () {
    $scope.test = PiTest()
    $scope.test.COOLDOWN_DURATION_MS = $scope.cooldownDurationMinutes * 60 * 1000
    $scope.test.testTimeMs = $scope.workloadDurationMinutes * 60 * 1000

    // Disable navigation
    $scope.$root.$broadcast('disable-navigation')
    var start = Date.now()
    var totalMs = $scope.WARMUP_DURATION + ($scope.workloadDurationMinutes + $scope.cooldownDurationMinutes) * 60 * 1000
    $scope.progressInterval = setInterval(function () {
      var now = Date.now()
      var pct = ((now - start) / totalMs) * 100
      $('#test-progress').css('width', `${pct}%`)
    }, 2 * 1000)

    $scope.checkRequisites()
    var exptID = AndroidAPI.startExperiment()
    $scope.$apply(() => {
      $scope.logs.push(`Experiment ID: ${exptID}`)
    })

    $(window).one('test-finished', function () {
      if (!$scope.cooldownFirst) {
        doCooldown()
      }

      AndroidAPI.toast('Uploading logs')
      var testResults = $scope.test.getResult()

      testResults['testType'] = 'test-device-v1'
      testResults['warmupDuration'] = $scope.WARMUP_DURATION
      testResults['ambientTemperature'] = $scope.temp
      testResults['sweepIteration'] = $scope.iter
      testResults['startTemperature'] = $scope.exptStartTemp
      testResults['cooldownData'] = $scope.cooldownData
      testResults['endTemperature'] = $scope.cooldownData.last.tempAfterSleep
      // XXX: --- hack ---
      testResults['cooldownDuration'] = 10 * 60 * 1000
      testResults['testTimeMs'] = 5 * 60 * 1000
      // XXX: --- hack ---
      testResults['properties'] = {
        native: $scope.native,
        debug: $scope.debug,
        cooldownFirst: $scope.cooldownFirst
      }

      var key = uploadData(JSON.stringify(testResults))
      AndroidAPI.uploadExperimentData('http://sweeptest.smartphone.exposed/', 'upload-expt-data', key)
      $scope.$root.testResults.push(exptID)

      // Cleanup
      clearInterval($scope.progressInterval)
      $('#test-progress').css('width', '0%')
      // Enable navigation
      $scope.runningTest = false
      $scope.$root.$broadcast('enable-navigation')
      if (!externalCall) {
        $scope.$apply(function () {
          $scope.$root.changeSection('test-results')
        })
      } else {
        $(window).trigger('results-handled')
      }
    })

    $(window).on('start-experiment', function () {
      AndroidAPI.log('webview', 'Received start-experiment')
      console.log('Running test')

      if ($scope.cooldownFirst) {
        doCooldown()
      }
      var tempReading = JSON.parse(AndroidAPI.getTemperature())
      $scope.exptStartTemp = tempReading.temperature
      if ($scope.native) {
        $scope.test.startTime = Date.now()
        var resultsStr = AndroidAPI.runWorkloadPi(15000, $scope.test.testTimeMs)
        $scope.test.endTime = Date.now()
        var results = JSON.parse(resultsStr)
        $scope.test.results = results
        $(window).trigger('test-finished')
      } else {
        $scope.test.run()
      }
    })

    if ($scope.cooldownFirst) {
      console.log(`Warming up device a little bit ...`)
      $scope.$apply(function () {
        $scope.logs.push(`Warming up device a little bit ...`)
      })
      AndroidAPI.warmupAsync($scope.WARMUP_DURATION, `
        $(window).trigger('start-experiment')
      `)
    } else {
      $(window).trigger('start-experiment')
    }
  }

  $scope.interruptTest = function () {
    $scope.logs.push(`Interrupted`)
    $(window).one('interrupt-finished', function () {
      $scope.runningTest = false
      $scope.test = undefined

      try {
        AndroidAPI.interruptExperiment()
      } catch (e) {
      }
      $scope.interrupting = undefined
      setTimeout(() => {
        $scope.$root.$broadcast('enable-navigation')
      }, 10)
      clearInterval($scope.progressInterval)
      $('#test-progress').css('width', '0%')
      clear()

    })
    // First, interrupt the test itself, then inform Java about the interruption
    $scope.test.interrupt()
  }

  startTest()
}
