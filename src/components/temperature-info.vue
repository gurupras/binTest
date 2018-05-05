<template>
  <div>
    <div class="row">
      <div class="input-field col offset-s4 s8 offset-m9 m3">
        <select v-model="hoursToPlot">
          <option value="" disabled selected>Choose number of hours</option>
          <option v-for="hour in hourOptions" :value="'' + hour" :key="hour">{{ hour }} Hour(s)</option>
        </select>
        <label>Hours</label>
      </div>
    </div>
    <div class="progress-preloader" v-if="loading === true">
      <div class="progress">
        <div class="indeterminate"></div>
      </div>
    </div>

    <p v-if="error">{{ error }}</p>
    <temperature-plot :height="100" v-if="tempData" :temperature-data="tempData"/>
  </div>
</template>

<script>
import { mapActions } from 'vuex'
import TemperatureMixin from '@/components/plots/temperature-mixin'
import TemperaturePlot from '@/components/plots/temperature-plot'

export default {
  name: 'temperature-info',
  components: {
    TemperaturePlot
  },
  mixins: [TemperatureMixin],
  data: function () {
    return {
      hourOptions: [1, 3, 5, 8, 12, 24],
      hoursToPlot: '',
      loading: true,
      tempData: undefined,
      error: undefined
    }
  },
  watch: {
    hoursToPlot: function (v) {
      var self = this
      localStorage.setItem('temperature-info:hoursToPlot', v)
      this.error = undefined
      this.loading = true
      this.getTemperatureData(Number(v)).then((data) => {
        // Convert all timestamps to datetime
        self.tempData = self.fixTemperatureDataForPlot(data)
      }).catch((e) => {
        self.tempData = undefined
        self.error = `Error: ${e.message}`
      }).finally(() => {
        self.loading = false
      })
    }
  },
  methods: {
    ...mapActions([
      'getTemperatureData'
    ])
  },
  beforeMount: function () {
    this.hoursToPlot = localStorage.getItem('temperature-info:hoursToPlot') || '12'
  },
  mounted: function () {
    // Initialize select
    const selectEl = this.$el.querySelector('select')
    window.M.FormSelect.init(selectEl)
    window.tempInfo = this
  }
}
</script>

<style>
</style>
