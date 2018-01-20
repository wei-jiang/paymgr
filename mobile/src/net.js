import io from 'socket.io-client';
import _ from 'lodash'
import adb from "./db";
const moment = require('moment');
import Noty from 'noty';

// var wwwRoot = window.location.href;
// if (wwwRoot.substr(wwwRoot.lenght - 1, 1) != "/") {
//   wwwRoot = wwwRoot.substr(0, wwwRoot.lastIndexOf("/"));
// }

class Net {
  constructor() {
    if (typeof io != "undefined") {
      this.sock = io();
      this.sock.on('connect', this.on_connect.bind(this));
      this.sock.on('pay_result', this.on_pay_result.bind(this));
    }
  }
  register_ui_evt() {
    vm.$on("notify_seller_status", data => {
      this.emit('notify_seller_status', data)
    });
  }

  on_connect() {

  }
  get_mchs(cb) {
    this.emit('get_mchs_with_token', usr_info, cb);
  }
  on_pay_result(res) {
    console.log('支付通知：' + JSON.stringify(res))
    // alert('from server notify, 支付通知：' + JSON.stringify(res))
    window.vm.$emit('pay_result', res);
  }
  emit(name, data, cb) {
    if (this.sock) {
      this.sock.emit(name, data, cb)
    }
  }

}
export default new Net;