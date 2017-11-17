(function() {
  console.log(`Running testing.js`);

  function generateTemperatureData() {
    var hours = 1 + Math.floor((Math.random() * 0));
    var startTime = moment(Date.now() - (hours * 60 * 60 * 1000));
    var now = startTime;
    var endTime = moment();

    var results = [];
    while(endTime.diff(now, 'milliseconds') > 0) {
      now.add(100 + ((250 - 100) * Math.random()), 'ms');
      temp = 30 + (30 * Math.random());

      results.push({
        timestamp: Number(now.format('x')),
        temperature: temp,
      });
    }
    return results;
  }

  var app = angular.module("mainApp", ["ngRoute"]);
  $(document).trigger('angular-ready', app);

  app.config(function($routeProvider) {
    $routeProvider

    .when('/device-info', {
      templateUrl: 'static/html/device-info.html',
      controller: 'deviceInfoController',
    })
    .when('/cpu-bin-info', {
      templateUrl: 'static/html/cpu-bin-info.html',
      controller: 'cpuBinInfoController',
    })
    .when('/test-my-device', {
      templateUrl: 'static/html/test-my-device.html',
      controller: 'testMyDeviceController',
    })
    .when('/test-results', {
      templateUrl: 'static/html/test-results.html',
      controller: 'testResultsController',
    })
    .when('/debug', {
      templateUrl: 'static/html/debug.html',
      controller: 'debugController',
    })
    .when('/sweep-test', {
      templateUrl: 'static/html/sweep-test.html',
      controller: 'sweepTestController',
    })
    .when('/terms', {
      templateUrl: 'static/html/terms_and_conditions.html',
      controller: 'dummyController',
    })
    .when('/privacy', {
      templateUrl: 'static/html/privacy_policy.html',
      controller: 'dummyController',
    })
    .otherwise({
      templateUrl: 'static/html/about.html',
      controller: 'aboutController',
    });
  });

  app.run(['$rootScope', '$window', function($rootScope, $window) {
    $rootScope.deviceID = JSON.parse(AndroidAPI.getDeviceID());
    $rootScope.deviceIDStr = JSON.stringify($rootScope.deviceID, null, 2);
    //$rootScope.deviceInfo = JSON.parse(AndroidAPI.getDeviceInfo());
    $rootScope.testResults = [];
    $rootScope.deviceInfo = [];
    $rootScope.deviceInfoStr = '{}';
    $rootScope.section = undefined;
    $rootScope.navigationDisabled = false;

    $.ajax({
      type: 'GET',
      url: 'device-description',
      data: {
        deviceID: $rootScope.deviceID,
      },
      dataType: 'json',
      success: function(data) {
        if(data.error) {
          $rootScope.$apply(function() {
            $rootScope.deviceInfo = data.error;
          });
          return;
        } else {
          $rootScope.$apply(function() {
            try {
              var keys = Object.keys(data[0]);
              for(var idx = 0; idx < keys.length; idx++) {
                var key = keys[idx];
                var value = data[0][key];
                $rootScope.deviceInfo.push({
                  key: key,
                  value: value,
                });
              }
            } catch(e) {
              console.error(e && e.stack);
            }
            $rootScope.deviceInfoStr = JSON.stringify($rootScope.deviceInfo);
          });
        }
      },
    });

    var $scope = $rootScope;
    $scope.sections = [
      {
        label: 'Device Info',
        id: 'device-info',
      },
      {
        label: 'CPU Bin Info',
        id: 'cpu-bin-info',
      },
      {
        label: 'Test My Device',
        id: 'test-my-device',
      },
      {
        label: 'Test Results',
        id: 'test-results',
        hide: 'testResults.length === 0',
      },
      {
        label: 'Debug',
        id: 'debug',
        hide: 'true',
      },
      {
        label: 'Sweep Test',
        id: 'sweep-test',
        hide: 'true',
      },
    ];

    $scope.$on('disable-navigation', function() {
      console.log(`navigation disabled`);
      $scope.navigationDisabled = true;
    });
    $scope.$on('enable-navigation', function() {
      console.log(`navigation re-enabled`);
      $scope.$apply(function() {
        $scope.navigationDisabled = false;
      });
    });


    $scope.section = undefined;
    $scope.changeSection = function(e) {
      if($scope.navigationDisabled) {
        return;
      }

      var el;
      if(!e.target) {
        // This is a section-id
        el = $(`.app-option[data-id="${e}"]`);
      } else {
        el = $(e.target);
      }
      var oldEl = $(`.app-option[data-id="${$scope.section}"]`);
      oldEl.removeClass('selected');
      el.addClass('selected');
      $scope.section = el.data('id');
      var hash = `#!/`;
      if($scope.section) {
        hash += $scope.section;
      }
      if(hash !== $window.location.hash) {
        $window.location.assign(hash);
      }
    };

    $scope.$on('$viewContentLoaded', function() {
      var hash = $window.location.hash.substr(3);
      if(hash !== '') {
        //$scope.changeSection(hash);
      }
    });

    // Get any test results
    $rootScope.updateTestResults = function() {
      return new Promise(function(resolve, reject) {
        $.ajax({
          type: 'GET',
          url: 'device-experiment-ids',
          data: {deviceID: $rootScope.deviceID},
          dataType: 'json',
          success: function(data) {
            $rootScope.$apply(function() {
              $rootScope.testResults = data;
              console.log(`device-experiment-ids=${JSON.stringify(data)}`);
            });
            resolve();
          },
          error: function(e) {
            reject(e);
          },
        });
      });
    };
    $rootScope.updateTestResults();
  }]);

  app.controller('testingController', ['$scope', '$window', function($scope, $window) {
    console.log('Running testingController');

    $('.brand-logo').on('click touchstart', function() {
      $scope.$apply(function() {
        $scope.changeSection({target: undefined});
      });
    });
  }]);

  function processAndroidData(data) {

    if(typeof data === 'string') {
      return JSON.stringify(JSON.parse(data), null, 2);
    } else if(typeof data === 'object') {
      // This is an error
      return data.message;
    }
  }
  app.controller('deviceInfoController', ['$scope', '$window', function($scope, $window) {
    $scope.sections = [
      {
        label: 'Basic',
        id: 'basic-info',
      },
      {
        label: 'Hardware',
        id: 'hardware-info',
      },
      {
        label: 'Temperature',
        id: 'temperature-info',
        onClick: 'updateTemperaturePlot();',
      }
    ];

    $scope.subSection = undefined;
    $scope.changeSection = function(e) {
      var el = $(e.target);
      var oldEl = $(`.page-option[data-id="${$scope.subSection}"]`);
      oldEl.removeClass('selected');
      el.addClass('selected');
      $scope.subSection = el.data('id');
      var evalStr = el.data('callback');
      if(evalStr) {
        $scope.$eval(evalStr);
      }
    };

    $scope.$on('$viewContentLoaded', function() {
      // Temperature data
    });

    $scope.updateTemperaturePlot = function() {
      var params = {
        hours: 12,
        utcOffset: moment().utcOffset(),
        deviceID: JSON.parse(JSON.stringify($scope.deviceID)),
      };

      $scope.loading = true;
      $.ajax({
        type: 'GET',
        url: 'generate-temperature-plot',
        data: params,
        dataType: 'json',
        success: function(data) {
          // FIXME: For some reason, this is only working on error
          var script = $(data.script);
          var div = $(data.div);
          $('#temperature-plot-div').empty();
          $('#temperature-plot-div').append(div);
          $('#temperature-plot-div').append(script);
          $scope.$apply(function() {
            $scope.loading = false;
          });
        },
        error: function(e) {
          var err = JSON.parse(e.responseText);
          var p = $(`<p>${err.msg}</p>`);
          p.appendTo($('#temperature-plot-div'));
          $scope.$apply(function() {
            $scope.loading = false;
          });
        },
      });
    };
  }]);

  app.controller('cpuBinInfoController', ['$scope', '$window', function($scope, $window) {
    $scope.$on('$viewContentLoaded', function() {
      var data = AndroidAPI.getCPUBin();
      data = processAndroidData(data);
      if(data === '{}') {
        // We got no data
        // Give the user some meaningful message
        $scope.CPUBinInfo = `We were unable to find any CPU bin information for your device.`;
        if(AndroidAPI.isRootAvailable()) {
          $scope.CPUBinInfo += ` Try running the app immediately after rebooting your device.`;
        } else {
          $scope.CPUBinInfo += ` CPU bin information is often unreadable from apps without root privileges.`;
        }
      } else {
        $scope.CPUBinInfo = data;
      }
    });
  }]);

  app.controller('aboutController', ['$scope', '$window', function($scope, $window) {
    console.log('Running aboutController');

    $scope.$on('$viewContentLoaded', function() {
      $('#terms').click(() => {
        $window.location.assign('#!/terms');
      });
      $('#privacy').click(() => {
        $window.location.assign('#!/privacy');
      });
    });
  }]);

  app.controller('dummyController', ['$scope', '$window', function($scope, $window) {
  }]);
})();
