<template>
  <div class="row">
    <div class="col s12">
      <div id="about-content">
        <div class="info-div">
          <div class="row">
            <div class="col s12 offset-m3 m6">
              <p>
                smartphones.exposed allows you to profile your Smartphone CPU to understand
                where it ranks compared to other devices of the same make and model (<b>{{ descriptiveName }}</b>).
              </p>
              <p>
                No two smartphone CPUs are created equal. There are inherent differences between them that
                arise from the manufacturing process. While users expect their smartphones to behave similar to reviews or benchmarks found online,
                they may often be surprised to find that their phones perform much poorer than the benchmarks.
              </p>
              <p>
                The reason for this performance difference stems from
                manufacturers selling CPUs with varying transistor quality
                characteristics, often at the same price, under the same name
                and label without providing this information to the end-user.
              </p>
            </div>
          </div>
          <div class="row" v-if="isFake">
            <div class="col s12 offset-m3 m6">
              You can install the app from the
              <a href="https://play.google.com/store/apps/details?id=edu.buffalo.cse.phonelab.smartphonesexposed">
                PlayStore
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { mapGetters, mapActions } from 'vuex'

export default {
  name: 'index',
  computed: {
    ...mapGetters([
      'deviceID'
    ]),
    descriptiveName () {
      const deviceID = this.deviceID
      let name = [deviceID['Build.MANUFACTURER']]
      if (deviceID.DeviceName) {
        name.push(deviceID.DeviceName.deviceName)
      } else {
        name.push(deviceID['Build.MODEL'])
      }
      return name.join(' ')
    }
  },
  methods: {
    ...mapActions([
      'getDeviceDescription'
    ])
  },
  mounted: function () {
    this.getDeviceDescription()
  }
}
</script>

<style>
</style>
