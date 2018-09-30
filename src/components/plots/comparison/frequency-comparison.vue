<template>
  <div class="row">
    <div class="col s12">
      <div class="row">
        <div class="col s3 input-field">
          <input type="text" placeholder="" v-model="filterCpusInput">
        </div>
      </div>
      <stacked-frequency-plot :height="100" :experiment-ids="experimentIds" :cpus="filterCpus"/>
    </div>
  </div>
</template>

<script>
import StackedFrequencyPlot from '@/components/plots/stacked-frequency-plot'

export default {
  name: 'frequency-comparison',
  components: {
    StackedFrequencyPlot
  },
  props: {
    experimentIds: {
      type: Array,
      default () {
        return []
      }
    }
  },
  computed: {
    filterCpus () {
      try {
        return JSON.parse(this.filterCpusInput)
      } catch (e) {
        return [0, 2]
      }
    }
  },
  data () {
    return {
      filterCpusInput: ''
    }
  }
}
</script>

<style>
.plot {

}
</style>
