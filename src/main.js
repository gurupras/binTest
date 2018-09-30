// The Vue build version to load with the `import` command
// (runtime-only or standalone) has been set in webpack.base.conf with an alias.
import Vue from 'vue'
import VueClipboard from 'vue-clipboard2'
import App from './App'
import router from './router'
import store from '@/store'

import M from 'materialize-css'
import '@/styles/app.scss'
import utils from '@/js/utils'
import thermabox from '@/js/thermabox.js'
Vue.config.productionTip = false

Vue.use(VueClipboard)

/* eslint-disable no-new */
window.app = new Vue({
  el: '#app',
  router,
  store,
  components: { App },
  template: '<App/>'
})

window.M = M
window.utils = utils
window.thermabox = thermabox
