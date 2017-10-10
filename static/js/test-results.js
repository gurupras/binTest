$(document).on('angular-ready', function(e, app) {
  app.controller('testResultsController', ['$scope', '$window', function($scope, $window) {
    console.log('Running testResultsController');

    $scope.testInfo = [];
    $scope.testScore = undefined;
    $scope.testResultsError = undefined;

    $scope.updateTestInfo = function(testInfo) {
      $scope.testInfo = [];

      // ----- BEGIN: Special field handling -----
      // Sanitize time
      testInfo.startTime = moment(testInfo.startTime);
      // Convert temperature to degC
      if(testInfo.startTemperature) {
        testInfo.startTemperature = testInfo.startTemperature + '°C';
      }
      // ----- END: Special field handling -------

      var keyLabelDict = {
        experimentID: 'Experiment ID',
        digits: 'Pi-digits/Iteration',
        startTime: 'Experiment Start Time',
        testTimeMs: 'Total Experiment Duration (ms)',
        iterationsCompleted: '# Iterations Completed',
        startTemperature: 'Initial Device Temperature',
      };
      var keys = Object.keys(keyLabelDict);
      for(var idx = 0; idx < keys.length; idx++) {
        var key = keys[idx];
        var label = keyLabelDict[key]
        $scope.testInfo.push({
          label: label,
          value: testInfo[key] || 'NA',
        });
      }
    };

    $scope.updateTestScore = function(score) {
      $scope.testScore = score;
    };

    var lastExperimentID = $scope.testResults.slice(-1)[0];
    $scope.loadExperimentResults = function(experimentID) {
      $.ajax({
        type: 'GET',
        url: 'experiment-results',
        data: {
          deviceID: $scope.deviceID,
          experimentID: experimentID,
        },
        dataType: 'json',
        success: function(data) {
          if(data.error) {
            $scope.$apply(function() {
              $scope.testResultsError = data.error;
            });
            setTimeout(function() {
              $scope.loadExperimentResults(experimentID);
            }, 3000);
            return;
          }
          $scope.$apply(function() {
            $scope.testResultsError = undefined;
            $scope.updateTestInfo(data.testInfo);
            $scope.updateTestScore(data.testScore);
            // TODO: Add logic to embed plot
            var script = $(data.testPlot.script);
            var div = $(data.testPlot.div);
            $('#test-plot-container').empty();
            $('#test-plot-container').append(div);
            $('#test-plot-container').append(script);
          });
        },
        error: function(e) {
        },
      });
    }
    $scope.loadExperimentResults(lastExperimentID);
  }]);
});
