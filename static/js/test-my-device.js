$(document).on('angular-ready', function(e, app) {
  app.controller('testMyDeviceController', ['$scope', '$window', function($scope, $window) {
    console.log('Running testMyDeviceController');

    $scope.testDuration = '12 minutes';

    $scope.requirements = [
      {
        label: 'Phone not charging',
        id: 'req-not-charging',
        checkedCondition: 'isPluggedIn === false',
      },
      {
        label: 'Battery > 80%',
        id: 'req-battery-level',
        checkedCondition: 'batteryLevel > 0.8',
      },
      // {
      //   label: 'Screen off',
      //   id: 'req-screen-off',
      // },
    ];

    function clear() {
      $scope.runningTest = undefined;
      $scope.test = undefined;
      $scope.interrupting = undefined;
      $scope.testResults = '';
    }
    clear();
    $scope.$on('$viewContentLoaded', function() {

      $scope.checkRequisites = function() {
        $scope.isPluggedIn = AndroidAPI.isPluggedIn();
        $scope.batteryLevel = AndroidAPI.getBatteryLevel();
        if($scope.isPluggedIn || $scope.batteryLevel < 0.8) {
          if($scope.runningTest && $scope.test) {
            $scope.test.valid(false);
          }
        }
      };

      $scope.checkRequisites();

      $scope.callbackCode = AndroidAPI.addChargeStateCallback(`
        var $scope = angular.element($('#test-prerequisites')[0]).scope();
        $scope.$apply(function() {
          $scope.checkRequisites();
        });
      `);

      $scope.$on('$destroy', function() {
        if($scope.callbackCode) {
          AndroidAPI.removeChargeStateCallback($scope.callbackCode);
        }
        if($scope.runningTest) {
          $scope.interruptTest();
        }
      });

      $scope.startTest = function() {
        $scope.checkRequisites();
        var exptID = AndroidAPI.startExperiment();

        var tempReading = JSON.parse(AndroidAPI.getTemperature());
        var startTemp = tempReading.temperature;

        var systemTime = AndroidAPI.systemTime();
        var upTime = AndroidAPI.upTime();
        var jsTime = Date.now();
        var timeDict = {
          systemTime: systemTime,
          upTime: upTime,
          jsTime: jsTime,
        };

        // Run powersync
        function padDate(val) {
          return ('0'+val).slice(-2);
        }

        console.log('Running test');

        function uploadData(str) {
          var key = AndroidAPI.startUploadData();

          MAX_CHUNK_SIZE = 32 * 1024;
          function chunkSubstr(str, size) {
            var numChunks = Math.ceil(str.length / size),
                chunks = new Array(numChunks);

            for(var i = 0, o = 0; i < numChunks; ++i, o += size) {
              chunks[i] = str.substr(o, size);
            }

            return chunks;
          }
          var chunks = chunkSubstr(str, MAX_CHUNK_SIZE);
          for(var idx = 0; idx < chunks.length; idx++) {
            AndroidAPI.upload(key, chunks[idx]);
          }
          AndroidAPI.finishUploadData(key);
          return key;
        }

        $(window).on('test-finished', function() {
          var cooldownData = null;
          try {
            console.log('test finished. Attempting cooldown ...');
            cooldownData = JSON.parse(AndroidAPI.sleepForDuration($scope.test.getTestObj().COOLDOWN_DURATION_MS));
            ;
          } catch(e) {
            console.log('Failed cooldown: ' + e);
          }
          AndroidAPI.toast('Uploading logs');
          var testResults = $scope.test.getResult();
          testResults['startTemperature'] = startTemp;
          testResults['cooldownData'] = cooldownData;
          var key = uploadData(JSON.stringify(testResults));
          AndroidAPI.uploadExperimentData('http://dirtydeeds.cse.buffalo.edu/smartphones.exposed/', 'upload-expt-data', key);
          $scope.$root.testResults.push(exptID);
          $scope.$apply(function() {
            $scope.$root.changeSection('test-results');
          });
        });

        $scope.test = PiTest();
        $scope.test.run();
      };

      $scope.interruptTest = function() {
        $scope.test.interrupt();
        $(window).one('interrupt-finished', function() {
          $scope.$apply(function() {
            $scope.interrupting = undefined;
            $scope.runningTest = false;
            $scope.test = undefined;
          });
          AndroidAPI.interruptExperiment();
        });
      };

      $scope.checkStability = function() {
        return true;
      }
    });
  }]);
});



function createPiWebWorker() {
		var worker = new Worker('static/js/pi.js');
		worker.timeTaken = [];
		worker.getTimes = function() {
			return JSON.stringify(worker.timeTaken);
		}
		return worker;
}


function PiTest(digits) {
  this.COOLDOWN_DURATION_MS = 5 * 60 * 1000;
  this.numWebWorkers = navigator.hardwareConcurrency;
  this.digits = digits || 15000;
  this.workers = [];
  this.testTimeMs = 7 * 60 * 1000;
  var test = this;
  this.zeroTime = Date.now();
  this.startTime = undefined;
  this.done = undefined;
  this.valid = true;
  // Create workers equal to number of CPU cores

  __log('# webworkers = ' + this.numWebWorkers);

  this.getResult = function() {
    return {
      digits: test.digits,
      startTime: test.startTime,
      iterations: test.results,
      testTimeMs: test.testTimeMs,
      valid: test.valid,
    };
  };

  function __log(str, logToAndroid) {
    logToAndroid = logToAndroid || false;
    if(logToAndroid) {
      AndroidAPI.log('workload.js', str);
    }
    console.log(str);
  }


  /* Real functions */
  function addRealListener(worker) {
    worker.onmessage = function(e) {
      var data = e.data;
      var now = Date.now();
      test.results.push({
        ft: round((now-test.zeroTime)/1e3, 2),
        tt: round(data.timeTaken/1e3, 2)
      });

      // A worker just finished. So decrement count
      test.started--;

      if(test.interrupt) {
        if(test.started === 0) {
          // Interrupt is complete
          $(window).trigger('interrupt-finished');
        }
        // Test is interrupted. Just return
        return;
      }

      // XXX: Right now, we just run the test for test.realTimeMs duration
      if(!test.startTime) {
        test.realEnd = Date.now();
        test.startTime = Date.now();
      } else {
        if(!test.startTime || (!test.done && ((Date.now()-test.startTime) < test.testTimeMs))) {
          test.started++;
          //console.log('Starting another iteration');
          worker.postMessage({
            'cmd':   'CalculatePi',
            'value': data.digits,
          });
        }
      }

      if(test.startTime && (Date.now()-test.startTime) > test.testTimeMs) {
        test.done = true;
        console.log('Finishing test..remaining: ' + test.started);
        //__log(JSON.stringify(getResult()));
        if(test.started == 0) {
          // This is the end of the test
          console.log('Done!');
          $(window).trigger('test-finished');
        }
      }
      // Signal that one real worker is done
      $(test.workers).trigger('worker-done', [e.data, worker]);
    };
    worker.onerror = function(e) {
      alert('Error: Line ' + e.lineno + ' in ' + e.filename + ': ' + e.message);
    };
  }

  function mean(list) {
    var sum = 0.0;
    for(i = 0; i < list.length; i++) {
      sum += list[i];
    }
    return sum / list.length;
  }

  function median(list) {
    //list.sort((a, b) => a - b);
    list.sort();
    var lowMiddle = Math.floor((list.length - 1) / 2);
    var highMiddle = Math.ceil((list.length - 1) / 2);
    var median = (list[lowMiddle] + list[highMiddle]) / 2;
    return median;
  }

  function round(value, exp) {
    if (typeof exp === 'undefined' || +exp === 0)
      return Math.round(value);

    value = +value;
    exp = +exp;

    if (isNaN(value) || !(typeof exp === 'number' && exp % 1 === 0))
      return NaN;

    // Shift
    value = value.toString().split('e');
    value = Math.round(+(value[0] + 'e' + (value[1] ? (+value[1] + exp) : exp)));

    // Shift back
    value = value.toString().split('e');
    return +(value[0] + 'e' + (value[1] ? (+value[1] - exp) : -exp));
  }

  // This is the core function that is exposed externally
  function run() {
    test.results = [];
    test.startTime = Date.now();

    //_run(addRealListener, setupRealEventHandlers, test.digits);
    for(i = 0; i < test.numWebWorkers; i++) {
      worker = createPiWebWorker();
      worker.id = `worker-${i}`;
      addRealListener(worker);
      test.workers[i] = worker;
    }

    __log('Running test');
    test.started = 0;
    // Launch number of web workers specified by numWebWorkers
    for(i = 0; i < test.numWebWorkers; i++) {
      //start the worker
      test.started++;
      test.workers[i].postMessage({
        cmd: 'CalculatePi',
        value: test.digits,
      });
    }
  }

  function interrupt() {
    test.interrupt = true;
  };

  function valid(bool) {
    test.valid = bool;
  }

  return {
    run: run,
    getResult: getResult,
    interrupt: interrupt,
    valid: valid,
    getTestObj: function() {return test;},
  };
};
