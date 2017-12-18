$(document).on('angular-ready', function (e, app) {
  app.controller('testMyDeviceController', ['$scope', '$window', function ($scope, $window) {
    console.log('Running testMyDeviceController')

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
  $scope.workloadDurationMinutes = 5
  $scope.cooldownDurationMinutes = 10

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
      console.log('test finished. Attempting cooldown ...')
      $scope.cooldownData = JSON.parse(AndroidAPI.sleepForDuration($scope.test.getTestObj().COOLDOWN_DURATION_MS))
    } catch (e) {
      console.log('Failed cooldown: ' + e)
    }
  }

  function clear () {
    $scope.runningTest = undefined
    $scope.test = undefined
    $scope.interrupting = undefined
    $scope.testResults = ''
  }
  clear()

  $scope.checkRequisites()

  $scope.callbackCode = AndroidAPI.addChargeStateCallback(`
    var $scope = angular.element($('#test-prerequisites')[0]).scope();
    $scope.$apply(function() {
      $scope.checkRequisites();
    });
  `)

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
    var totalMs = ($scope.workloadDurationMinutes + $scope.cooldownDurationMinutes) * 60 * 1000
    $scope.progressInterval = setInterval(function () {
      var now = Date.now()
      var pct = ((now - start) / totalMs) * 100
      $('#test-progress').css('width', `${pct}%`)
    }, 2 * 1000)

    $scope.checkRequisites()
    var exptID = AndroidAPI.startExperiment()

    var tempReading = JSON.parse(AndroidAPI.getTemperature())
    var startTemp = tempReading.temperature

    var systemTime = AndroidAPI.systemTime()
    var upTime = AndroidAPI.upTime()
    var jsTime = Date.now()
    var timeDict = {
      systemTime: systemTime,
      upTime: upTime,
      jsTime: jsTime
    }

    console.log('Running test')

    $(window).one('test-finished', function () {
      doCooldown()
      AndroidAPI.toast('Uploading logs')
      var testResults = $scope.test.getResult()
      console.log(`iterations: ${testResults.iterations.length}`)
      testResults['startTemperature'] = startTemp
      testResults['cooldownData'] = $scope.cooldownData
      testResults['endTemperature'] = $scope.cooldownData.last.tempAfterSleep
      testResults = $.extend(testResults, appendToResult)
      var key = uploadData(JSON.stringify(testResults))
      AndroidAPI.uploadExperimentData('https://smartphone.exposed', 'upload-expt-data', key)
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
  }

  $scope.interruptTest = function () {
    $scope.test.interrupt()
    $(window).one('interrupt-finished', function () {
      $scope.$apply(function () {
        $scope.runningTest = false
        $scope.test = undefined
        if ($scope.callbackCode) {
          AndroidAPI.removeChargeStateCallback($scope.callbackCode)
        }
      })

      AndroidAPI.interruptExperiment()
      $scope.interrupting = undefined
      $scope.$root.$broadcast('enable-navigation')
      clearInterval($scope.progressInterval)
      $('#test-progress').css('width', '0%')
    })
  }

  startTest()
}
