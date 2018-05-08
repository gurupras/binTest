var request = require('request');

module.exports = function(key) {
  this.apiKey = key;

  var exports = this;
  this.query = function(device) {
    return new Promise((resolve, reject) => {
      try {
        request.post(
          'https://fonoapi.freshpixl.com/v1/getdevice', {
            json: {
              device: device,
              token: 'eb66ce55cf59127bf126ad97baefadb824f2690051fa1941',
              limit: 5,
            },
          },
          function (error, response, body) {
            if (!error && response.statusCode == 200 && body.status !== 'error') {
              console.log('Response: ' + JSON.stringify(body));
              resolve(body);
            } else {
              reject([error, response, body]);
            }
          }
        );
      } catch(e) {
        console.log(e && e.stack);
      }
    });
  }


  function resolveNumCPUs(string) {
  	string = string.toLowerCase();
  	// Split by '&' to handle big.LITTLE
  	var strings = string.split('&');
  	var ncpus = 0;	// Track total number of CPUs
  	var result = {};
  	for(var idx = 0; idx < strings.length; idx++) {
  		var cpus = 0;
  		if(string.startsWith('quad')) {
  			cpus = 4;
  		} else if(string.startsWith('dual')) {
  			cpus = 2;
  		} else {
  			cpus = 1;
  		}
  		// Right now, we only add ncpus.  If we planned on adding frequency
  		// information, that would go in here.
  		var cpuConfig = {
  			'ncpus': cpus,
  		};
  		result['cluster-' + idx] = cpuConfig;
  		// Increment total number of cpus
  		ncpus += cpus;
  	}
  	result['ncpus'] = ncpus;
  	return result;
  }

  return this;
}
