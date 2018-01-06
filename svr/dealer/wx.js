const fs = require('fs');
const moment = require('moment');
const WXPay = require('wxpay.js').WXPay;
const WXPayConstants = require('wxpay.js').WXPayConstants;

const util = require('../common/util')

const APPID = 'wxa71182a49ab08050',
    MCHID = '1278305901',
    KEY = 'X5i69E6ZxL5ip15By0oUi3Fr8hINscgO',
    CERT_FILE_CONTENT = fs.readFileSync('./keys/apiclient_cert.p12'),
    CA_FILE_CONTENT = fs.readFileSync('./keys/rootca.pem'),
    TIMEOUT = 10000; // 毫秒

const wxpay = new WXPay({
    appId: APPID,
    mchId: MCHID,
    key: KEY,
    certFileContent: CERT_FILE_CONTENT,
    caFileContent: CA_FILE_CONTENT,
    timeout: TIMEOUT,
    signType: WXPayConstants.SIGN_TYPE_HMACSHA256,  // 使用 HMAC-SHA256 签名，也可以选择  WXPayConstants.SIGN_TYPE_MD5
    useSandbox: false   // 不使用沙箱环境
});
function verify(data) {
    return new Promise((resolve, reject) => {
        if (!data.token || !data.body || !data.total_fee) {
            reject('wrong parameters')
        } else {
            util.verify_token(data.token, (err, decoded) => {
                if (err) {
                    reject(err)
                } else {
                    resolve(decoded);
                }
            })
        }
    })
}
function get_req_obj(sock, data, decoded) {
    let client_ip = util.get_ip_by_sock(sock)
    let notify_url = `${util.get_myurl_by_sock(sock)}/wx_notify`
    console.log(`notify_url=${notify_url}`)
    return {
        body: data.body,
        sub_mch_id: decoded.wx_id,
        out_trade_no: data.out_trade_no || moment().format("YYYYMMDDHHmmssSSS"),
        total_fee: data.total_fee,
        spbill_create_ip: client_ip,
        notify_url: notify_url        
    };
}
function req_micropay(sock, data, cb) {
    verify(data)
        .then(decoded => {
            if(!data.auth_code){
                return cb({
                    ret: -1,
                    msg: 'wrong parameters'
                })
            }
            let reqObj = get_req_obj(sock, data, decoded)
            reqObj.auth_code = auth_code;
            delete reqObj.notify_url;
            wxpay.microPay(reqObj)
                .then(res => {
                    console.log(res);
                    //todo: if res success then insert pending order
                    // reqObj.sock_id = sock.id;
                    // reqObj.createdAt = new Date();
                    // reqObj.trade_type = '微信反扫';
                    // m_db.collection('pending_order').insert(reqObj)
                    cb(res);
                })
                .catch( err=> {
                    console.log(err);
                    cb({
                        ret: -1,
                        msg: err
                    })
                });
        })
        .catch(err => {
            console.log(err);
            cb({
                ret: -1,
                msg: err
            })
        });
}
function req_wxpay_qr(sock, data, cb) {
    verify(data)
        .then(decoded => {
            let reqObj = get_req_obj(sock, data, decoded)
            reqObj.trade_type = 'NATIVE';
            wxpay.unifiedOrder(reqObj)
                .then(res => {
                    console.log(res);
                    //todo: if res success then insert pending order
                    reqObj.sock_id = sock.id;
                    reqObj.createdAt = new Date();
                    reqObj.trade_type = '微信正扫';
                    m_db.collection('pending_order').insert(reqObj)
                    cb(res);
                })
                .catch(function (err) {
                    console.log(err);
                    cb({
                        ret: -1,
                        msg: err
                    })
                });
        })
        .catch(err => {
            console.log(err);
            cb({
                ret: -1,
                msg: err
            })
        });
}
// const reqObj = {
//     openid:"ok7PPv1TI3LbP6ixCdOW3Dv_Vo14",
//     sub_mch_id: '1411994302',
//     body: '智慧旅游服务商下子商户支付测试',
//     out_trade_no: moment().format("YYYYMMDDHHmmssSSS"),
//     total_fee: 1,
//     spbill_create_ip: '123.12.12.123',
//     notify_url: 'http://www.example.com/wxpay/notify',
//     trade_type: 'JSAPI'
// };

// wxpay.unifiedOrder(reqObj).then(function (respObj) {
//     console.log(respObj);
// }).catch(function (err) {
//     console.log(err);
// });
//mdb && winston is global
function deal_wx_pay(app, io, db) {
    io.on('connection', socket => {
        socket.on('req_wxpay_qr', (data, cb) => req_wxpay_qr(socket, data, cb));
        socket.on('req_micropay', (data, cb) => req_micropay(socket, data, cb));
    });
}
module.exports = deal_wx_pay;