const java = require("java");
const moment = require('moment');
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
        console.log(data)
        res.end('success');
    });
    app.post('/ali_notify', (req, res) => {
        let resp = req.body;
        console.log("ali qr pay callback...");
        console.log(resp);
        ali_pay.verifyPromise( JSON.stringify(resp) )
        .then( is_valid => console.log("验证通知签名："+is_valid) )
        if (resp.trade_status == "TRADE_SUCCESS" || resp.trade_status == "TRADE_FINISHED") {
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
        res.end('success');
    });
    io.on('connection', socket => {
        socket.on('req_alipay_qr', (data, cb) => req_alipay_qr(socket, data, cb));
        socket.on('req_authpay', (data, cb) => req_authpay(socket, data, cb));
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
            if (decoded.auth_token) {
                let reqObj = get_req_obj(data)
                ali_pay.precreate(JSON.stringify(reqObj), decoded.auth_token, (err, res) => {
                    if (err) {
                        console.log(err, res)
                        cb({
                            ret: -1,
                            msg: err
                        })
                    } else {
                        res = JSON.parse(res).alipay_trade_precreate_response;
                        reqObj.sock_id = sock.id;
                        reqObj.createdAt = new Date();
                        reqObj.sub_mch_id = decoded.aly_id;
                        reqObj.trade_type = '支付宝正扫';
                        m_db.collection('pending_order').insert(reqObj)
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
function req_authpay(sock, data, cb) {

}
module.exports = deal_aly_pay;