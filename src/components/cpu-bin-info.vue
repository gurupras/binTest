<template>
  <div class="row">
    <div class="col s12">
      <div class="info-div center">
        <h4>CPU Bin Info</h4>
        <div id="cpu-bin-info">
          <div v-if="isFake">
            <!-- We're on desktop -->
            <p>
              Please install the <code>smartphone.exposed</code> app from the
            <a :href="appURL" target="_blank">PlayStore</a>
          </p>
          </div>

          <div v-else>
            <div v-if="CPUBinData === undefined">
              <div class="progress-preloader">
                <div class="progress">
                  <div class="indeterminate"></div>
                </div>
              </div>
            </div>
            <div v-else-if="CPUBinData && Object.keys(CPUBinData).length !== 0">
              <p v-for="(entry, $index) in processedBinData" :key="$index">
                <vue-markdown>{{ entry }}</vue-markdown>
              </p>
            </div>
            <div v-else>
              <!-- We're on mobile but we were unable to get bin info -->
              <div v-if="rootAvailable">
                <p> Try running the app immediately after rebooting your device. </p>
              </div>
              <div v-else>
                <p>
                  CPU bin information is often unreadable on un-rooted devices.
                  If you're on a rooted device, try giving the app root permissions.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'
import VueMarkdown from 'vue-markdown'

/* global AndroidAPI */
export default {
  name: 'cpu-bin-info',
  components: {
    VueMarkdown
  },
  computed: {
    ...mapGetters([
      'appURL',
      'CPUBinData'
    ]),
    isFake () {
      return AndroidAPI.isFake
    },
    processedBinData () {
      return this.processBinData()
    },
    rootAvailable () {
      return AndroidAPI.isRootAvailable()
    }
  },
  data: function () {
    return {
    }
  },
  methods: {
    processBinData () {
      // binData is a JSON that contains filepath -> bin if it exists
      // and as a last hailmary, it also tries to send across the output of
      // dmesg if available
      // First, handle all keys except dmesg
      var ret = []
      const binData = this.CPUBinData
      Object.keys(binData).filter(e => e !== 'dmesg').forEach((key) => {
        const str = `**${key}** -> ${binData[key]}`
        ret.push(str)
      })
      if (ret.length > 0) {
        // We got at least one entry from files
        ret.unshift(`###CPU Bin`)
      }

      // Now dmesg processing
      const dmesg = binData.dmesg
      if (dmesg) {
        dmesg.map((line) => {
          const regex = /\[.*?\] (.*)/gm
          const m = regex.exec(line)
          ret.push(m[1])
        })
      }
      return ret
    }
  },
  beforeMount () {
  },
  mounted () {
  }
}
</script>
