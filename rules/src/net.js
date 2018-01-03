import io from 'socket.io-client';

import _ from 'lodash';


class Net {
    constructor() {
        this.sock = io();
        this.sock.on('connect', this.on_connect.bind(this));
        this.sock.on('mch_changed', this.on_mch_changed.bind(this));
        this.sock.on('player_offline', this.on_player_offline.bind(this));

    }
    register_ui_evt() {
        vm.$on("notify_seller_status", data => {
            this.emit('notify_seller_status', data)
        });
    }
    
    on_connect() {
        this.register_ui_evt()
        console.log('on_connect to socket.io server');
    }
    get_orders(openid, cb) {
        this.emit('get_orders', openid, orders => {
            cb(orders)
        });
    }
    
    emit(name, data, cb) {
        if (this.sock) {
            this.sock.emit(name, data, cb)
        }
    }
    on_mch_changed(data) {
        window.vm.$emit('mch_changed', data);
    }
    on_player_offline(p) {
        game.remove_player(p.openid)
        window.vm.$emit('count_changed', game.players.length);
    }
    
}
export default new Net;