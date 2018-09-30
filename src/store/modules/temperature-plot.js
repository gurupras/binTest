const state = {
  temperaturePlotDefaultOptions: {
    showLine: true,
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
          labelString: 'Temperature (°C)'
        }
      }]
    }
  },
  temperaturePlotDefaultData: {
    datasets: [{
      label: 'Temperature',
      fill: false,
      lineTension: 0,
      data: [],
      borderColor: 'rgba(0, 153, 255, 0.9)',
      backgroundColor: 'rgba(0, 153, 255, 0.9)',
      borderWidth: 1.4,
      showLine: true,
      spanGaps: true,
      pointRadius: 0
    }]
  }
}

const getters = {
  temperaturePlotDefaultData: state => state.temperaturePlotDefaultData,
  temperaturePlotDefaultOptions: state => state.temperaturePlotDefaultOptions,
  temperaturePlotDefaultDataset: state => JSON.parse(JSON.stringify(state.temperaturePlotDefaultData)).datasets[0]
}

export default {
  state,
  getters
}
