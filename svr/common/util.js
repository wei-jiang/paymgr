const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const _ = require('lodash');
const moment = require('moment');
const request = require('request');
const credential = require('../secret')

function is_sock(sock) {
    return !!sock.handshake
}
function get_ip_by_sock(sock) {
    let rip = sock.handshake.headers['x-forwarded-for'];
    //console.log(rip);
    return rip;
}
function get_ip_by_req(req) {
    let cli_ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    cli_ip = Array.isArray(cli_ip) ? cli_ip[0] : cli_ip;
    if (cli_ip.indexOf(',') > 0) {
        cli_ip = cli_ip.substring(0, cli_ip.indexOf(','));
    }
    return cli_ip;
}
let get_myurl_by_req = (req) => {
    //depend on nginx config
    let host = req.headers['host'];
    let proto = req.headers['x-forwarded-proto'] || 'http';
    let port = req.headers['x-forwarded-port'];
    let url = `${proto}://${host}`
    if (port) url = url + `:${port}`
    // console.log(req.headers);
    // console.log(url);
    return url;
}
let get_myurl_by_sock = (sock) => {
    //depend on nginx config
    let host = sock.handshake.headers['host'];
    let proto = sock.handshake.headers['x-forwarded-proto'] || 'http';
    let port = sock.handshake.headers['x-forwarded-port'];
    let url = `${proto}://${host}`
    if (port) url = url + `:${port}`
    // console.log(sock.handshake.headers);
    // console.log(url);
    return url;
}


function sign_token_1h(data) {
    return jwt.sign(data, credential.mch_token_key, { expiresIn: '1h' });
}
function sign_token(data) {
    return jwt.sign(data, credential.mch_token_key);
}
function sign_usr_token(data) {
    return jwt.sign(data, credential.usr_token_key);
}
function verify_usr_token(token) {
    return new Promise((resolve, reject) => {
        jwt.verify(token, credential.usr_token_key, (err, decoded) => {
            if (err) {
                reject(err)
            } else {
                resolve(decoded);
            }
        });
    })
}
function verify_mch_token(token) {
    return new Promise((resolve, reject) => {
        jwt.verify(token, credential.mch_token_key, (err, decoded) => {
            if (err) {
                reject(err)
            } else {
                resolve(decoded);
            }
        });
    })
}
function verify_token(token, cb) {
    jwt.verify(token, credential.mch_token_key, cb);
}
function verify_req(data, judge) {
    return new Promise((resolve, reject) => {
        if (!data.token || !data.body || !data.total_fee) {
            reject('wrong parameters')
        } else {
            if (judge && !judge(data)) {
                reject('wrong parameters')
            } else {
                verify_token(data.token, (err, decoded) => {
                    if (err) {
                        reject(err)
                    } else {
                        resolve(decoded);
                    }
                })
            }
        }
    })
}
//two type of token: mch_token, usr_token
function verify_usr(data) {
    return new Promise((resolve, reject) => {
        if (data.token) {
            verify_token(data.token, (err, decoded) => {
                if (err) {
                    reject(err)
                } else {
                    //remove token
                    delete data.token;
                    resolve(decoded);
                }
            })
        } else {
            reject('no login info presents')
        }
    })
}
function change_order_state_to_refund(out_trade_no) {
    return m_db.collection('orders').updateOne({ out_trade_no }, { $set: { state: '已退款' } })
}
function notify_or_save_pay_result(order_id, resp, io, res) {
    function find_and_delete(data) {
        m_db.collection('pending_order').findOneAndDelete({
            "sock_status": "valid",
            out_trade_no: order_id
        })
            .then(r => {
                let o = r.value
                // console.log('find pending order', o);
                if (o) {
                    let order = {
                        body: o.body,
                        sub_mch_id: o.sub_mch_id,
                        out_trade_no: o.out_trade_no,
                        total_fee: o.total_fee,
                        state: '已支付',
                        spbill_create_ip: o.spbill_create_ip,
                        trade_type: o.trade_type,
                        time_begin: moment(o.createdAt).format("YYYY-MM-DD HH:mm:ss"),
                        time_end: moment().format("YYYY-MM-DD HH:mm:ss")
                    }
                    if (o.notify_url) {
                        (function post_result() {
                            const post_data = { ret: 0, order }
                            winston.info(`post to ${o.notify_url}, data=${JSON.stringify(post_data)}`)
                            request.post(
                                {
                                    // timeout: 2000,
                                    url: o.notify_url,
                                    json: post_data
                                },
                                (err, httpResponse, body) => {
                                    if (err) {
                                        console.error(`post to ${o.notify_url} failed`, err);
                                        winston.error(`post to ${o.notify_url} failed, err_msg=${JSON.stringify(err)}, retry after 10 seconds`)
                                        setTimeout(post_result, 10 * 1000)
                                    }
                                    else {
                                        winston.info(`post to ${o.notify_url} success, return:${body}`)
                                        console.log(o.notify_url + " return:" + JSON.stringify(body));
                                    }
                                }
                            );
                        })()
                    }
                    o.sock_id && io.to(o.sock_id).emit('pay_result', order);
                    m_db.collection('orders').insert(order)
                    res.end('success');
                } else {
                    // console.log('can not find pending order');
                    setTimeout(_.partial(find_and_update, data), 0)
                }
            })
            .catch(err => {
                // console.log('find pending order failed, err=', err);
            })
    }
    function find_and_update(data) {
        m_db.collection('pending_order').findOneAndUpdate(
            {
                "sock_status": "invalid",
                out_trade_no: order_id
            },
            {
                $set: { "pay_status": "valid", noty_data: data }
            }
        )
            .then(r => {
                // console.log('find_and_update', r)
                if (r.ok == 1) {
                    let o = r.value
                    let order = {
                        body: o.body,
                        sub_mch_id: o.sub_mch_id,
                        out_trade_no: o.out_trade_no,
                        total_fee: o.total_fee,
                        state: '已支付',
                        spbill_create_ip: o.spbill_create_ip,
                        trade_type: o.trade_type,
                        time_begin: moment(o.createdAt).format("YYYY-MM-DD HH:mm:ss"),
                        time_end: moment().format("YYYY-MM-DD HH:mm:ss")
                    }
                    m_db.collection('orders').insert(order)
                    res.end('success');
                } else {
                    setImmediate(_.partial(find_and_delete, data))
                }
            })
            .catch(err => {
                setImmediate(_.partial(find_and_delete, data))
            })
    }
    find_and_delete(resp)
}

function hash_str(str) {
    return crypto.createHash('md5').update(str).digest("hex");
}

module.exports = {
    sign_usr_token,
    verify_usr_token,
    verify_mch_token,
    is_sock,
    hash_str,
    get_ip_by_sock,
    get_ip_by_req,
    get_myurl_by_req,
    get_myurl_by_sock,
    sign_token,
    sign_token_1h,
    verify_token,
    verify_req,
    verify_usr,
    notify_or_save_pay_result,
    change_order_state_to_refund
}