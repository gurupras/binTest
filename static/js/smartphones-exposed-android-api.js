window.AndroidAPI = window.AndroidAPI || {
  stockResponse: function() {
    return new Error('Please install the smartphones.exposed app from the PlayStore');
  },
  getDeviceID: function() {
    //return this.stockResponse();
    return JSON.stringify({
      "IMEI": "353626070549717", /*"000000000000000",*/
      "Settings.Secure.ANDROID_ID": "c3004cdd541bea40", /* c3004cdd541bea40 */
      "Build.PRODUCT": "generic",
      "Build.SERIAL": "01aff1e7b54aa0d8", /* "0000000000000000" */
      "Build.BRAND": "google",
      "ICCID": "310260808169237", /* "000000000000000", */
      "Build.MANUFACTURER": "LGE",
      "Build.MODEL": "Nexus 5X" /* "Nexus 5X" */
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
  isPluggedIn: function() {
    //return false;
    return Math.random() > 0.9;
  },
  getBatteryLevel: function() {
    //return 1.0;
    return Math.min(1, 0.7 + Math.random());
  },
  getTemperature: function() {
    return JSON.stringify({
      temperature: 25.0,
      timestamp: Date.now(),
    });
  },
  clearLogcat: function() {
    return;
  },
  log: function(msg) {
    console.log('AndroidAPI: ' + msg);
  },
  systemTime: function() {
    return Date.now();
  },
  upTime: function() {
    return 1000.0;
  },
  sleepForDuration: function(duration) {
    return "{}";
  },
  addChargeStateCallback: function(content) {
    window.csc = setInterval(function() {
      eval(content);
    }, 1000);
  },
  removeChargeStateCallback: function() {
    if(window.csc) {
      clearInterval(window.csc);
    };
  },
  waitUntilAmbientTemperature: function () {
  },
  startMonsoon: function () {
  },

  startExperiment: function() {
    return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
      (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16))
  },
  getStartTemp: function() {
    return 20
  },
  getEndTemp: function () {
    return 32
  },
  getStep: function () {
    return 2
  },
  getNumIterations: function () {
    return 3
  },
  stopMonsoon: function () {
  },
  setURL: function(url) {
    // window.location.href = url
  },
  startUploadData: function() {
    return "";
  },
  upload: function() {
  },
  finishUploadData: function(key) {
  },
  uploadExperimentData: function(origin, endpoint, msg) {
    console.log(`${JSON.stringify(msg, null, 4)}`);
  }
};
