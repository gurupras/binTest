(function () {
  const THERMABOX_ADDR = '192.168.2.113'
  window.thermabox = {
    setLimits: function (temp, threshold, cb) {
      $.post(`http://${THERMABOX_ADDR}:8080/set-limits`, {
        temperature: temp,
        threshold: threshold
      }, cb)
    },
    getLimits: function (cb) {
      $.get(`http://${THERMABOX_ADDR}:8080/get-limits`, cb)
    },
    getTemperature: function (cb) {
      $.get(`http://${THERMABOX_ADDR}:8080/get-temperature`, cb)
    },
    getState: function (cb) {
      $.get(`http://${THERMABOX_ADDR}:8080/get-state`, cb)
    }
  }
})()
