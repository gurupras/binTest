$(document).on('angular-ready', function(e, app) {
  app.controller('debugController', ['$scope', '$window', function($scope, $window) {
    console.log('Running debugController');

    $scope.currentTemperature = 'NA';

    $scope.runWorkloadPi = function() {
      AndroidAPI.runWorkloadPi(15000, 1 * 60 * 1000);
    };
    $scope.runNativeWorkloadPi = function() {
      AndroidAPI.runNativeWorkloadPi(15000, 1 * 60 * 1000);
    };

    var tempInterval;
    $scope.$on('$viewContentLoaded', function() {
      tempInterval = setInterval(function() {
        $scope.$apply(function() {
          $scope.currentTemperature = ('' + JSON.parse(AndroidAPI.getTemperature()).temperature).substr(0, 5);
        });
      }, 500);
    });

    $scope.$on('$destroy', function() {
      clearInterval(tempInterval);
    });
  }]);
});
