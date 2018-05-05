const state = {
  temperaturePlotDefaultOptions: {
    elements: {
      point: {
        radius: 0
      }
    },
    hover: {
      intersect: false
    },
    tooltips: {
      mode: 'index',
      intersect: false
    },
    scales: {
      xAxes: [{
        type: 'time',
        display: true,
        scaleLabel: {
          display: true,
          labelString: 'Time'
        }
      }],
      yAxes: [{
        ticks: {
          beginAtZero: true,
          suggestedMax: 120
        },
        scaleLabel: {
          display: true,
          labelString: 'Temperature'
        }
      }]
    }
  },
  temperaturePlotDefaultData: {
    labels: [],
    datasets: [{
      label: 'Temperature',
      fill: false,
      lineTension: 0,
      data: [],
      borderColor: 'rgba(0, 153, 255, 0.9)',
      backgroundColor: 'rgba(0, 153, 255, 0.9)'
    }]
  }
}

const getters = {
  temperaturePlotDefaultData: state => state.temperaturePlotDefaultData,
  temperaturePlotDefaultOptions: state => state.temperaturePlotDefaultOptions
}

export default {
  state,
  getters
}
