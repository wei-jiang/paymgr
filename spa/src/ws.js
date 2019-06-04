import _ from 'lodash'
import moment from "moment";
import uuidv1 from 'uuid/v1'
class WS {
  constructor() {
    window.cli_id = localStorage.getItem('cli_id')
    if(!window.cli_id){
      window.cli_id = uuidv1()
      localStorage.setItem('cli_id', window.cli_id)
    }
    _.bindAll(this, ['on_message', 'on_close', 'on_error', 'on_open', 'send'])
    this.init()    
  }
  init() {
    this.connected = false;
    const ws_url = `${location.protocol=="https:"?'wss':'ws'}://${location.host}${location.pathname}wx_pay`;
    this.ws = new WebSocket(ws_url);    
    this.ws.onmessage = this.on_message;
    this.ws.onclose = this.on_close;
    this.ws.onerror = this.on_error;
    this.ws.onopen = this.on_open;
  }
  register_ui_evt() {
    vm.$on("notify_seller_status", data => {
      this.emit('notify_seller_status', data)
    });
  }
  on_message(evt) {
    const data = JSON.parse(evt.data)
    console.log(data)  
    vm.$emit(data.cmd, data);

  }
  on_error(err) {
    console.log('onerror', err)
  }
  on_close() {
    this.init()
    console.log('onclose')
  }
  on_open() {
    // this.register_ui_evt()
    this.connected = true;
    this.send({
      cmd: 'reg_cli_id',
      cli_id
    })
    console.log('onopen')
  }
  on_update_order_state(data) {
    vm.$emit('update_order_state', data);
  }
  on_refresh_file_list(data) {
    vm.$emit('refresh_file_list', '');
  }
 
  send(data) {
    if( !this.connected ){
      return setTimeout(this.send, 1000, data);
    }
    this.ws.send(JSON.stringify(data) );
  }

}
export default new WS;