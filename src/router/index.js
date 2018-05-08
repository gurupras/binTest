import Vue from 'vue'
import Router from 'vue-router'
import Index from '@/components/index'
import DeviceInfo from '@/components/device-info'
import CPUBinInfo from '@/components/cpu-bin-info'
import TestDevice from '@/components/test-device'
import SweepTest from '@/components/sweep-test'
import TestResults from '@/components/test-results'
import PrivacyPolicy from '@/components/privacy-policy'

Vue.use(Router)

export default new Router({
  routes: [
    {
      path: '/',
      name: 'index',
      component: Index
    },
    {
      path: '/device-info',
      name: 'device-info',
      component: DeviceInfo
    },
    {
      path: '/bin-info',
      name: 'bin-info',
      component: CPUBinInfo
    },
    {
      path: '/test-device',
      name: 'test-device',
      component: TestDevice
    },
    {
      path: '/sweep-test',
      name: 'sweep-test',
      component: SweepTest
    },
    {
      path: '/test-results',
      name: 'test-results',
      component: TestResults
    },
    {
      path: '/privacy-policy',
      name: 'privacy-policy',
      component: PrivacyPolicy
    }
  ]
})
