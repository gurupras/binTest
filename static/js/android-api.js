window.onload = function () {
  if (!window.Android) {
    window.Android = {
      clearLogcat: function () {},
      startMonsoon: function () {},
      stopMonsoon: function () {},
      runPowerSync: function () {},
      setAmbientTemperature: function () {},
      systemTime: function () { return 0 },
      upTime: function () { return 0 },
      toast: function () {},
      start: function () {},
      finish: function () {},
      post: function () {},
      log: function () {},
      getStartTemp: function () { return 10 },
      getEndTemp: function () { return 12 },
      getStep: function () { return 1 },
      getNumIterations: function () { return 2 },
      setURL: function () {},
      isDozeDisabled: function () { return true },
      showDozeDialog: function () {}
    }
  }
}
