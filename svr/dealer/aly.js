const java = require("java");
const moment = require('moment');
const _ = require('lodash');
const util = require('../common/util')
java.classpath.push("./jar/kotlin_bridge-all.jar");
java.asyncOptions = {
    syncSuffix: "Sync",
    asyncSuffix: "",
    promiseSuffix: "Promise",   // Generate methods returning promises, using the suffix Promise.
    promisify: require("when/node").lift
};

const AliPay = java.import('freego.AliPay');
const ali_pay = new AliPay()
//winston is global
function deal_aly_pay(app, io) {
    app.get('/authRedirect', function (req, res) {
        let data = req.query;
        // console.log(data)
        let req_data = {
            grant_type: 'authorization_code',
            code: data.app_auth_code
        };
        ali_pay.get_auth_tokenPromise(JSON.stringify(req_data))
            .then(res => {
                // console.log('get_auth_token return:', res)
                res = JSON.parse(res).alipay_open_auth_token_app_response
                // console.log('before get usr info', res)
                m_db.collection('merchant')
                    .update({ aly_id: res.user_id }, {
                        $set: {
                            'ali.app_auth_token': res.app_auth_token,
                            'ali.app_refresh_token': res.app_refresh_token,
                            'ali.expires_in': res.expires_in,
                            'ali.re_expires_in': res.re_expires_in,
                        }
                    }, { upsert: true })
                    .then(() => {
                        redis_emitter.emit('mch_changed', '');
                    })

            })
        res.end('success');
    });
    app.post('/ali_notify', (req, res) => {
        let resp = req.body;
        // console.log("ali qr pay callback...");
        // console.log(resp);
        ali_pay.verifyPromise(JSON.stringify(resp))
            .then(is_valid => {
                // console.log("验证通知签名：" + is_valid)
                if (is_valid && resp.trade_status == "TRADE_SUCCESS" || resp.trade_status == "TRADE_FINISHED") {
                    let order_id = resp.out_trade_no
                    m_db.collection('pending_order').findOneAndDelete({
                        out_trade_no: order_id
                    })
                        .then(r => {
                            let o = r.value
                            console.log('find pending order', o);
                            let order = {
                                body: o.body,
                                sub_mch_id: o.sub_mch_id,
                                out_trade_no: o.out_trade_no,
                                total_fee: o.total_fee,
                                trade_type: o.trade_type,
                                time_begin: moment(o.createdAt).format("YYYY-MM-DD HH:mm:ss"),
                                time_end: resp.notify_time
                            }
                            redis_emitter.to(o.sock_id).emit('pay_result', order);
                            m_db.collection('orders').insert(order)
                        })
                        .catch(err => {
                            console.log('can not find pending order', err);
                        })
                }
            })

        res.end('success');
    });
    io.on('connection', socket => {
        socket.on('req_alipay_qr', (data, cb) => req_alipay_qr(socket, data, cb));
        socket.on('ali_auth_pay', (data, cb) => req_auth_pay(socket, data, cb));
    });
}
//把微信的请求格式转成ali的（客户端请求单位全部用 分）
function get_req_obj(data) {
    return {
        subject: data.body,
        out_trade_no: data.out_trade_no || moment().format("YYYYMMDDHHmmssSSS"),
        total_amount: parseFloat(parseInt(data.total_fee) / 100).toFixed(2),
        extend_params: {
            sys_service_provider_id: "2088621170920613"
        }
    };
}
function req_alipay_qr(sock, data, cb) {
    util.verify_req(data)
        .then(decoded => {
            console.log('decoded=', decoded)
            if (decoded.ali && decoded.ali.app_auth_token) {
                let reqObj = get_req_obj(data)
                ali_pay.precreate(JSON.stringify(reqObj), decoded.ali.app_auth_token, (err, res) => {
                    if (err) {
                        console.log(err, res)
                        cb({
                            ret: -1,
                            msg: err
                        })
                    } else {
                        res = JSON.parse(res).alipay_trade_precreate_response;
                        data.sock_id = sock.id;
                        data.createdAt = new Date();
                        data.out_trade_no = reqObj.out_trade_no;
                        data.sub_mch_id = decoded.aly_id;
                        data.trade_type = '支付宝正扫';
                        m_db.collection('pending_order').insert(data)
                        console.log(res.qr_code)
                        res.code_url = res.qr_code  //把支付宝格式转成微信格式返回客户端
                        cb(res)
                    }
                })
            } else {
                cb({
                    ret: -1,
                    msg: '无商户授权码'
                })
            }
        })
        .catch(err => {
            console.log(err);
            cb({
                ret: -1,
                msg: err
            })
        });

}
function req_auth_pay(sock, data, cb) {
    util.verify_req(data, ()=>data.auth_code)
        .then(decoded => {
            console.log('decoded=', decoded)
            if (decoded.ali && decoded.ali.app_auth_token) {
                let reqObj = get_req_obj(data)
                reqObj.auth_code = data.auth_code
                reqObj.scene = "bar_code"
                ali_pay.trade_pay(JSON.stringify(reqObj), decoded.ali.app_auth_token, (err, res) => {
                    if (err) {
                        console.log(err, res)
                        cb({
                            ret: -1,
                            msg: err
                        })
                    } else {
                        res = JSON.parse(res).alipay_trade_pay_response;
                        console.log(res)
                        // data.sock_id = sock.id;
                        // data.createdAt = new Date();
                        // data.out_trade_no = reqObj.out_trade_no;
                        // data.sub_mch_id = decoded.aly_id;
                        // data.trade_type = '支付宝反扫';
                        // m_db.collection('pending_order').insert(data)
                        
                        // res.code_url = res.qr_code  //把支付宝格式转成微信格式返回客户端
                        cb(res)
                    }
                })
            } else {
                cb({
                    ret: -1,
                    msg: '无商户授权码'
                })
            }
        })
        .catch(err => {
            console.log(err);
            cb({
                ret: -1,
                msg: err
            })
        });
}
module.exports = deal_aly_pay;