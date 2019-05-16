const EventEmitter = require('events');

class EventBus extends EventEmitter {
    constructor() {
        super();
        this._events = {};
    }
    assertType(type) {
        if (typeof type !== 'string' && typeof type !== 'symbol') {
            throw new TypeError('[event name] is not type of string or symbol!')
        }
    }
    assertFn(fn) {
        if (typeof fn !== 'function') {
            throw new TypeError('fn is not type of Function!')
        }
    }
    // for async call
    async ac(evt_name, data) {
        const func = this._events[evt_name];
        if (!func) return false;
        const ret = func(data);
        if (this.is_promise(ret)) {
            return await ret;
        }
        return ret;
    }
    call(evt_name, data) {
        if (!this._events[evt_name]) return false;
        return this._events[evt_name](data);
    }
    do(evt_name, func) {
        this.assertType(evt_name)
        this.assertFn(func)
        this._events[evt_name] = func;
    }
    quit(evt_name) {
        delete this._events[evt_name];
    }
    is_promise(obj) {
        return !!obj && (typeof obj === 'object' || typeof obj === 'function') && typeof obj.then === 'function';
    }
}

module.exports = new EventBus();