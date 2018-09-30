<template>
  <div class="row">
    <div class="col s12">
      <div class="row">
        <div class="col s3 input-field">
          <vue-select ref="comparisonSelect" :options="availableComparisons" label="Plot Type" message="Select plot type for comparison" v-model="plotType"/>
        </div>
        <div class="col s3 input-field">
          <input id="experiment-id-input" type="text" placeholder="" v-model="experimentIdInput" @input="handleKey" @keydown="handleKey">
          <label for="experiment-id-input">Enter Experiment ID</label>
        </div>
        <div class="col s3" style="margin-top: 2em;">
          <button :class="['btn', 'btn-small', 'waves-effect', 'waves-light', 'silver', !plotType || experimentIDOrder.length < 2 ? 'disabled' : '']" >Generate Plot</button>
          <button class="btn waves-effect waves-light silver" @click="onShare"> Share <i class="material-icons">share</i> </button>
        </div>
      </div>

      <div class="row">
        <div class="col s12">
          <div class="tags">
            <div v-for="(valid, experimentID) in experimentIDs" :key="experimentID">
              <div class="tag" :class="[valid ? 'valid' : 'invalid']">
                <span>{{experimentID}}</span>
                <span class="close-tag" @click="removeExperiment(experimentID)"></span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="row">
        <div class="col s12" v-if="experimentIDOrder">
          <frequency-comparison v-if="plotType === 'stacked-frequency'" :experiment-ids="experimentIDOrder"/>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import URI from 'urijs'
import 'urijs/src/URI.fragmentQuery.js'

import Vue from 'vue'
import VueSelect from '@/components/common/select'
import FrequencyComparison from '@/components/plots/comparison/frequency-comparison'
import axios from 'axios'

export default {
  name: 'v-comparison',
  components: {
    VueSelect,
    FrequencyComparison
  },
  computed: {
    availableComparisons () {
      return [
        {
          value: 'stacked-frequency',
          text: 'Stacked Frequency'
        }
      ]
    },
    shareURL () {
      const prefix = `${window.location.origin}/#/comparison`
      const uri = new URI('')
      uri.addSearch({
        'experimentIDs[]': this.experimentIDOrder,
        plotType: this.plotType
      })
      return `${prefix}${uri.toString()}`
    }
  },
  data () {
    return {
      plotType: undefined,
      experimentIdInput: '',
      experimentIDs: {},
      experimentIDOrder: [],
      ready: false
    }
  },
  methods: {
    onShare () {
      const url = this.shareURL
      this.$copyText(url).then(() => {
        window.M.toast({
          html: `Copied to clipboard`,
          displayLength: 3000
        })
      })
    },
    handleKey (e) {
      const self = this
      const keyCode = e.keyCode || e.which
      var content = e.target.value.split(',')
      content = content.map(e => e.replace(',', '')).filter(e => e.length > 0)

      switch (keyCode) {
        case 13:
        case 188: // comma
          if (e.shiftKey) {
            break
          }
          Promise.all(content.map(e => this.addExperiment(e), this)).then(() => {
            self.experimentIdInput = ''
          })
          break
        case 8: // backspace
          if (e.target.value === '') {
            const lastExperimentID = this.experimentIDOrder.slice(-1)[0]
            self.removeExperiment(lastExperimentID)
          }
          break
      }
    },
    async addExperiment (experimentID) {
      if (this.experimentIDs[experimentID]) {
        return
      }

      var response
      try {
        response = await axios.get('/api/is-experiment-valid', {
          params: {
            experimentID
          }
        })
      } catch (e) {
        response = e.response
      } finally {
        this.experimentIDOrder.push(experimentID)
        this.experimentIDs[experimentID] = response.data.valid
      }
    },
    removeExperiment (experimentID) {
      this.experimentIDOrder.splice(this.experimentIDOrder.indexOf(experimentID), 1)
      Vue.delete(this.experimentIDs, experimentID)
    }
  },
  beforeMount () {
    debugger
    const { query } = this.$route
    const { 'experimentIDs[]': experimentIDs, plotType } = query

    if (experimentIDs) {
      experimentIDs.forEach(x => this.addExperiment(x), this)
      this.$router.replace({query: {}})
    }
    if (plotType) {
      this.plotType = plotType
    }
  },
  mounted () {
    if (this.plotType) {
      this.$nextTick(() => {
        this.$refs.comparisonSelect.update(this.plotType)
      })
    }
    window.comparison = this
  }
}
</script>

<style scoped>
.tags {
    margin: 0 0 1em 0;
  }

  .tags .tag {
    display: table;
    background: #cde69c;
    color: #638421;
    padding: 2px;
    padding-right: 12px;
    margin: 0 5px 5px 0;
    border: 1px solid #a5d24a;
    border-radius: 2px;
    font: inherit;
    -webkit-user-select: none;
    -moz-user-select: none;
    -ms-user-select: none;
    user-select: none;
    transition: all 0.1s ease;
  }

  .tag .close-tag {
    vertical-align: middle;
    float: right;
    margin-left: 8px;
  }

  .tag .close-tag::before {
    position: absolute;
    font-weight: bold;
    content: "x";
  }

  .tag .close-tag:hover {
    float: right;
    display: inline-block;
    cursor: pointer;
    /*   padding:2px 5px; */
  }

  .tag.invalid {
    background-color: #f2dede;
    border-color: #ebcccc;
    color: #a94442;
  }
</style>
