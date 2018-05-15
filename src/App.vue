<template>
  <div id="app">
    <header>
      <div class="container-fluid">
        <div class="navbar-fixed">
          <nav>
            <div class="nav-wrapper silver" style="width: 100%;">
              <div class="brand-logo not-selectable">
                <a class="brand-logo-link" href="javascript:void(0);" @click="reset">
                  <!-- <img :src="logo" /> -->
                  <span>smartphone.exposed</span>
                </a>
              </div>
            </div>
          </nav>
        </div>
        <div class="side-nav" id="side-nav">
        </div>
      </div>
    </header>

    <main>
      <div class="container-fluid">
        <div class="row">
          <div class="col s12 offset-m3 m6">
            <div class="app-options center">
              <ul class="tabs">
                <app-section v-for="(section, $index) in mainSections" class="tab app-option-li"
                    :key="$index"
                    :navigationDisabled="navigationDisabled"
                    :target="section.target"
                    :label="section.label"
                    :currentSection="currentSection"
                    v-show="!(section.hide && section.hide())"
                    @updateSection="updateSection"/>
              </ul>
            </div>
          </div>
        </div>

        <div class="row" v-if="isFake">
          <div class="col offset-s6 offset-m10 s6 m2 input-field">
            <select id="device-select" @change="changeSimulatedDevice">
              <option v-for="device in fakeDevices" :value="'' + device" :key="device"
                  :class="[deviceID === fakeDevices[device] ? 'selected' : '']">
                {{ device }}
              </option>
            </select>
            <label>Select device to emulate</label>
          </div>
        </div>
        <div class="row">
          <div class="col s12">
            <router-view/>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'
import AppSection from '@/components/app-section'
import fakeDevices from '@/js/fake-devices'

export default {
  name: 'App',
  components: {
    AppSection
  },
  data: function () {
    return {
    }
  },
  computed: {
    ...mapGetters([
      'logo',
      'deviceID',
      'mainSections',
      'navigationDisabled',
      'isFake'
    ]),
    currentSection: {
      get () {
        return this.$store.getters.section
      },
      set (v) {
        this.$store.commit('section', v)
      }
    },
    fakeDevices: {
      get () {
        const devices = Object.keys(fakeDevices)
        devices.sort()
        return devices
      }
    }
  },
  watch: {
    '$route.name': function (v) {
      this.currentSection = v
    }
  },
  methods: {
    reset: function () {
      this.currentSection = undefined
      this.$router.push('/')
    },
    updateSection: function (route) {
      this.currentSection = route
      this.$router.push(`/${route}`)
    },
    changeSimulatedDevice (e) {
      this.$store.commit('deviceID', fakeDevices[e.target.value])
      this.$store.dispatch('getTestIDs').then(() => {
        console.log(`Fetched test IDs`)
      })
      const mSelect = window.M.FormSelect.getInstance(this.$el.querySelector('#device-select'))
      mSelect.input.value = e.target.value
    }
  },
  mounted: function () {
    this.$store.dispatch('getCPUBinInfo')
    this.$store.dispatch('getTestIDs').then(() => {
      console.log(`Fetched test IDs`)
    })

    const selectEl = this.$el.querySelector('#device-select')
    window.M.FormSelect.init(selectEl)

    // TODO: Initialize tabs
    // window.M.Tabs.init(this.$el.querySelector('.tabs'), {
    //   swipeable: true
    // })
  }
}
</script>

<style lang="scss">
$background-color: #202020;
$selected-bg: linear-gradient(#155179,#1c6da2);
$selected-color: #fff !important;

body {
  background-color: $background-color;
}

.tabs {
  background-color: $background-color !important;
}

.selected {
  background-image: $selected-bg;
  color: $selected-color;
}
</style>

<style>
body {
  color: #000;
}

.brand-logo-link {
  padding-left: 0.2em !important;
  color: #000 !important;
  cursor: pointer;
}
.brand-logo-link span {
}

.silver {
  background-color: #cdd2d8 !important;
  color: #000 !important;
}

.btn:hover {
  background-image: linear-gradient(#3498db,#258cd1);
}

main {
  padding-top: 1em;
}

.app-option-li {
  display: inline;
  margin: 0 0.3em;
}
@media only screen and (max-width: 500px) {
  .app-option-li {
    /*font-size: 0.8em;*/
    padding: 0;
    display: inline-block;
    margin: 0 0.1em 1em 0.1em;
  }
  .app-option-li a {
    font-size: 0.8em;
  }
}
.app-option {
  padding: 0 1em;
  margin: 0 0.1em;
}

.info-div {
  color: #fff !important;
}

.preformatted {
  /*font-size: 0.8em;*/
  /*font-family: monospace;*/
  white-space: pre-wrap;
  word-wrap: break-word;
}

canvas {
  background-color: #fff;
}

[ng\:cloak], [ng-cloak], [data-ng-cloak], [x-ng-cloak], .ng-cloak, .x-ng-cloak {
  display: none !important;
}

@media only screen and (max-width: 500px) {
  h3 {
    margin: 1rem 0;
  }
  #about-test-device-content {
    margin-top: 1em !important;
  }
}

input {
  color: white;
}

p.lead {
  /* font-size: 1em; */
}

.brand-logo img {
  vertical-align: middle;
  height: 1em;
  width: 1em;
}

.tabs .indicator {
  display: none;
}

.not-selectable {
  -webkit-touch-callout: none; /* iOS Safari */
  -webkit-user-select: none; /* Safari */
  -khtml-user-select: none; /* Konqueror HTML */
  -moz-user-select: none; /* Firefox */
  -ms-user-select: none; /* Internet Explorer/Edge */
  user-select: none; /* Non-prefixed version, currently
                                  supported by Chrome and Opera */
}

.error {
  color: red;
}
</style>
