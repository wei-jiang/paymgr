const fs = require('fs');
const moment = require('moment');
const jwt = require('jsonwebtoken');
const WXPay = require('wxpay.js').WXPay;
const WXPayConstants = require('wxpay.js').WXPayConstants;


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

function req_wxpay_qr(sock, data){

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
//winston is global
function deal_wx_pay(app, io, db) {
    io.on('connection', socket => {
        socket.on('req_wxpay_qr', data => req_wxpay_qr(socket, data) );

    });
}
module.exports = deal_wx_pay;