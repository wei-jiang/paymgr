const fs = require('fs');
const moment = require('moment');
const _ = require('lodash');
const iconv = require('iconv-lite');
const credential = require('../secret')

const WXPay = require('wxpay.js').WXPay;
const WXPayConstants = require('wxpay.js').WXPayConstants;

const util = require('../common/util')

const APPID = credential.wx_APPID,
    MCHID = credential.wx_MCHID,
    KEY = credential.wx_KEY,
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

function get_req_obj(sock, data, decoded) {
    let notify_url = `${util.get_myurl_by_sock(sock)}/wx_notify`
    // console.log(`notify_url=${notify_url}`)
    data.sub_mch_id = decoded.wx_id;
    data.spbill_create_ip = util.get_ip_by_sock(sock);
    data.total_fee = parseInt(data.total_fee)
    data.out_trade_no = data.out_trade_no || moment().format("freego_YYYYMMDDHHmmssSSS")
    //above as order info to save in db
    return {
        body: data.body,
        sub_mch_id: data.sub_mch_id,
        out_trade_no: data.out_trade_no,
        total_fee: data.total_fee,
        spbill_create_ip: data.spbill_create_ip,
        notify_url: notify_url
    };
}
function req_micropay(sock, data, cb) {
    util.verify_req(data, () => data.auth_code)
        .then(decoded => {
            let reqObj = get_req_obj(sock, data, decoded)
            reqObj.auth_code = data.auth_code;
            delete reqObj.notify_url;
            return wxpay.microPay(reqObj)
        })
        .then(res => {
            // console.log(res);
            if(res.return_code == 'SUCCESS'){
                if(res.result_code == 'SUCCESS'){
                    cb({
                        ret: 0,
                        msg: '支付成功'
                    });
                    data.trade_type = '微信反扫';
                    delete data.token;
                    m_db.collection('orders').insert(data)
                } else if(res.result_code == 'USERPAYING'){
                    cb({
                        ret: -1,
                        msg: '等待用户付款（请稍候）'
                    });
                } else if(res.result_code == 'SYSTEMERROR'){
                    cb({
                        ret: -1,
                        msg: '系统超时（请稍候）'
                    });
                } else {

                }
            } else {
                cb({
                    ret: -1,
                    msg: '支付失败（网络错误）'
                });
            }
            
            // cb(res);
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
    util.verify_req(data, () => data.cli_id )
        .then(decoded => {
            let reqObj = get_req_obj(sock, data, decoded)
            reqObj.trade_type = 'NATIVE';
            return wxpay.unifiedOrder(reqObj)
        })
        .then(res => {
            // console.log(res);
            data.cli_id = data.cli_id
            data["pay_status"] = "invalid",
            data.sock_status = 'valid'
            data.sock_id = sock.id;
            data.createdAt = new Date();
            data.trade_type = '微信正扫';
            delete data.token;
            console.log(data);
            m_db.collection('pending_order').insert(data)
            cb(res);
        })
        .catch(err => {
            console.log(err);
            cb({
                ret: -1,
                msg: err
            })
        });
}

//here 
function order_query(sock, data, cb) {
    util.verify_usr(data)
        .then(decoded => {
            let reqObj = {
                sub_mch_id: data.sub_mch_id,
                out_trade_no: data.out_trade_no
            }
            return wxpay.orderQuery(reqObj)
        })
        .then(res => {
            // console.log(res);
            
            cb(res);
        })
        .catch(err => {
            console.log(err);
            cb({
                ret: -1,
                msg: err
            })
        });
}
function dl_wx_bill(sock, data, cb) {
    util.verify_usr(data)
        .then(decoded => {
            let reqObj = {
                sub_mch_id: data.sub_mch_id,
                bill_type: 'ALL',
                bill_date: data.bill_date
            }
            return wxpay.downloadBill(reqObj)
        })
        .then(res => {
            // console.log(res);
            if(res.return_code == 'SUCCESS'){
                cb({
                    ret: 0,
                    data: iconv.encode(res.data, 'win1255')
                });
            } else {
                cb({
                    ret: -1,
                    msg: res.return_msg
                });
            }   
        })
        .catch(err => {
            // console.log(err);
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
function deal_wx_pay(app, io) {
    app.post('/wx_notify', (req, res) => {
        let resp = req.body.xml;
        // console.log("wx qr pay callback...");
        // console.log(resp);
        if (resp.return_code[0] == 'SUCCESS' && resp.result_code[0] == 'SUCCESS') {
            let order_id = _.isArray(resp.out_trade_no) ? resp.out_trade_no[0] : resp.out_trade_no;
            util.notify_or_save_pay_result(order_id, resp, io, res)
        } else {
            console.log('notify pay failed', resp.result_code[0]);
            winston.error('notify pay failed', resp.result_code[0]);
            res.end('success');
        }  
    });
    io.on('connection', socket => {
        socket.on('req_wxpay_qr', (data, cb) => req_wxpay_qr(socket, data, cb));
        socket.on('wx_auth_pay', (data, cb) => req_micropay(socket, data, cb));
        socket.on('wx_order_query', (data, cb) => order_query(socket, data, cb));
        socket.on('dl_wx_bill', (data, cb) => dl_wx_bill(socket, data, cb));
    });
}
module.exports = deal_wx_pay;