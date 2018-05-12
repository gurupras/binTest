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
            <div v-if="Object.keys(binData) !== 0">
              <p>
                {{ binData }}
              </p>
            </div>
            <div v-else>
              <!-- We're on mobile but we were unable to get bin info -->
              <div v-if="rootAvailable">
                <p> Try running the app immediately after rebooting your device </p>
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

/* global AndroidAPI */
export default {
  name: 'cpu-bin-info',
  computed: {
    ...mapGetters([
      'appURL'
    ]),
    isFake () {
      return AndroidAPI.isFake
    }
  },
  data: function () {
    return {
      binData: undefined
    }
  },
  beforeMount () {
    this.binData = AndroidAPI.getCPUBin()
  },
  mounted () {
  }
}
</script>
