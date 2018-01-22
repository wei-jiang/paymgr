// The Vue build version to load with the `import` command
// (runtime-only or standalone) has been set in webpack.base.conf with an alias.
import Vue from 'vue'
import App from './App'
import 'noty/lib/noty.css'
import './db';
import './net';

Vue.config.ignoredElements = ['home', 'buy']

require('phonon/dist/css/phonon.min.css')
require('phonon/dist/js/phonon.js')
window.usr_info.pay_type = parseInt(window.usr_info.pay_type)

/* eslint-disable no-new */
window.vm = new Vue({
  el: '#app',
  template: '<App/>',
  components: { App }
})
