import Vue from 'vue'
import App from './App.vue'
import router from './router'
import './registerServiceWorker'
import 'noty/lib/noty.css'
import 'normalize.css';
window.$ = window.jQuery = require('jquery');

Vue.config.productionTip = false

window.vm = new Vue({
  router,
  render: h => h(App)
}).$mount('#app')
