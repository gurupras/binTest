<template>
  <div>
    <div class="row">
      <div class="col s12">
        <div class="center">
          <div class="app-options page-options">
            <ul style="display: inline;">
              <app-section class="app-option-li page-option-li" v-for="(section, $index) in sections"
                  :key="$index"
                  :navigationDisabled="navigationDisabled"
                  :target="section.target"
                  :label="section.label"
                  :currentSection="subSection"
                  @updateSection="updateSection"/>
            </ul>
          </div>
        </div>
      </div>
    </div>

    <div class="info-div center" v-if="subSection === 'basic-info'">
      <h4>Basic Info</h4>
      <div class="row">
        <div class="col s12 offset-m3 m6">
          <properties :data="deviceID"/>
        </div>
      </div>
    </div>

    <div class="info-div center" v-if="subSection === 'hardware-info'">
      <h4>Hardware Info</h4>
      <div class="row">
        <div class="col s12 offset-m3 m6">
          <div id="device-info">
            <properties :data="deviceInfo"/>
          </div>
        </div>
      </div>
    </div>

    <div class="info-div center" v-if="subSection === 'temperature-info'">
      <h4>Temperature Info</h4>
      <div class="row">
        <div class="col s12">
          <temperature-info/>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { mapGetters, mapActions } from 'vuex'
import AppSection from '@/components/app-section'
import Properties from '@/components/properties'
import TemperatureInfo from '@/components/temperature-info'

export default {
  name: 'device-info',
  components: {
    AppSection,
    Properties,
    TemperatureInfo
  },
  computed: {
    ...mapGetters([
      'navigationDisabled',
      'deviceID',
      'deviceInfo'
    ])
  },
  data: function () {
    return {
      sections: [
        {
          label: 'Basic',
          target: 'basic-info'
        },
        {
          label: 'Hardware',
          target: 'hardware-info'
        },
        {
          label: 'Temperature',
          target: 'temperature-info'
        }
      ],
      subSection: 'basic-info'
    }
  },
  methods: {
    ...mapActions([
      'getDeviceDescription'
    ]),
    updateSection: function (target) {
      this.subSection = target
    }
  },
  beforeMount: function () {
    if (!this.deviceInfo) {
      this.getDeviceDescription()
    }
  },
  mounted: function () {
  }
}
</script>

<style>
</style>
