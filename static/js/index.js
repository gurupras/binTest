(function() {

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

  window.AndroidAPI = window.AndroidAPI || {
    stockResponse: function() {
      return new Error('Please install the smartphones.exposed app from the PlayStore');
    },
    getDeviceID: function() {
      //return this.stockResponse();
      return JSON.stringify({
        "IMEI": "353626070549717",
        "Settings.Secure.ANDROID_ID": "c3004cdd541bea40",
        "Build.PRODUCT": "bullhead",
        "Build.SERIAL": "01aff1e7b54aa0d8",
        "Build.BRAND": "google",
        "ICCID": "310260808169237",
        "Build.MANUFACTURER": "LGE",
        "Build.MODEL": "Nexus 5X"
      });
    },
    getDeviceInfo: function() {
      return JSON.stringify({
        cpus: navigator.hardwareConcurrency,
      });
    },
    getCPUBin: function() {
      return this.stockResponse();
    },
    getTemperatureData: function() {
      //return '[]';
      return JSON.stringify(generateTemperatureData());
    },
    toast: function(msg) {
      console.log('TOAST: ' + msg);
    },
    isRootAvailable: function() {
      return false;
    },
  };

  var app = angular.module("mainApp", ["ngRoute"]);

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
    .when('/run-workload', {
      templateUrl: 'static/html/workload.html',
      controller: 'workloadController',
    })
    .otherwise({
      templateUrl: 'static/html/about.html',
      controller: 'aboutController',
    });
  });

  app.run(['$rootScope', function($rootScope) {
    $rootScope.deviceID = JSON.parse(AndroidAPI.getDeviceID());
    $rootScope.deviceIDStr = JSON.stringify($rootScope.deviceID, null, 2);
    $rootScope.deviceInfo = JSON.parse(AndroidAPI.getDeviceInfo());
    $rootScope.deviceInfoStr = JSON.stringify({cpus: $rootScope.deviceInfo.cpus}, null, 2);
  }]);

  app.controller('indexController', ['$scope', '$window', function($scope, $window) {
    console.log('Running indexController');
    $scope.sections = [
      {
        label: 'Device Info',
        id: 'device-info',
        href: 'device-info',
      },
      {
        label: 'CPU Bin Info',
        id: 'cpu-bin-info',
        href: 'cpu-bin-info',
      },
      {
        label: 'Run Experiment',
        id: 'run-experiment',
        href: 'run-experiment',
      },
    ];

    $scope.section = undefined;
    $scope.changeSection = function(e) {
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
      var href = '#!/';
      if(el.data('href')) {
        href += el.data('href');
      }
      $window.location.assign(href);
    };

    $('.brand-logo').on('click touchstart', () => {
      $scope.$apply(() => {
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
        label: 'Basic Info',
        id: 'basic-info',
      },
      {
        label: 'Hardware Info',
        id: 'hardware-info',
      },
      {
        label: 'Temperature Info',
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
        debugger;
        $scope.$eval(evalStr);
      }
    };

    $scope.$on('$viewContentLoaded', () => {
      $scope.$parent.changeSection('device-info');
      // Temperature data
    });

    $scope.updateTemperaturePlot = function() {
      var params = {
        hours: 12,
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
          $('#temperature-plot-div').append(div);
          $('#temperature-plot-div').append(script);
          $scope.$apply(() => {
            $scope.loading = false;
          });
        },
        error: function(e) {
        },
      });
    };
  }]);

  app.controller('cpuBinInfoController', ['$scope', '$window', function($scope, $window) {
    $scope.$on('$viewContentLoaded', () => {
      $scope.$parent.changeSection('cpu-bin-info');
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
  }]);
})();
