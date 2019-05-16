const fs = require('fs');
const moment = require('moment');
const _ = require('lodash');
const querystring = require('querystring');
const ali = require('./ali');

// //////////////////////
const AlipaySdk = require('alipay-sdk').default;
const cfg = require('../secret');
const alipaySdk = new AlipaySdk({
    appId: cfg.ali_APP_ID,
    privateKey: cfg.ali_app_PRIVATE_KEY,
    alipayPublicKey: cfg.ali_PUBLIC_KEY,
    timeout: 5000,
    camelcase: false
});
// //////////////////////
const util = require('../common/util')
const credential = require('../secret')

class AliApi {
    constructor() {
        _.bindAll(this, ['init_rest', 'init_sio', 'init_ws', 'req_alipay_qr']);
        evt.on('init_rest', this.init_rest);
        evt.on('init_sio', this.init_sio);
        evt.on('init_ws', this.init_ws);
    }
    init_rest(app) {
        app.post('/ali_notify', (req, res) => {
            const resp = req.body;
            logger.info("ali pay callback...", resp);
            if( ali.verify_notify_rsa2(resp) ){
                // console.log("ali notified data valid");
                if (resp.trade_status == "TRADE_SUCCESS" || resp.trade_status == "TRADE_FINISHED") {
                    const order_id = resp.out_trade_no;
                    logger.info(`${order_id} paid`);
                    evt.emit('notify_cli', order_id);
                } else {
                    // skip
                }
            } else {
                logger.info("ali notified data invalid, skip...");
            }
            res.end('success');
        });
    }
    init_sio(socket) {
        socket.on('req_alipay_qr', (data, cb) => this.req_alipay_qr(socket, data, cb));
    }
    init_ws(ws, req) {

    }
    get_req_obj(sock_or_req, data, decoded) {
        const my_url = util.is_sock(sock_or_req) ? util.get_myurl_by_sock(sock_or_req) : util.get_myurl_by_req(sock_or_req)

        let notify_url = `${my_url}/ali_notify`
        // console.log(`notify_url=${notify_url}`)
        data.total_fee = parseInt(data.total_fee)
        data.sub_mch_id = decoded.aly_id;
        data.spbill_create_ip = util.is_sock(sock_or_req) ? util.get_ip_by_sock(sock_or_req) : util.get_ip_by_req(sock_or_req);
        data.out_trade_no = data.out_trade_no || 'freego_' + moment().format("YYYYMMDDHHmmssSSS")
        data.store_id = data.store_id || 'cs001'
        delete data.token;
        //above as order info to save in db
        return {
            store_id: data.store_id,
            subject: data.body,
            out_trade_no: data.out_trade_no,
            total_amount: parseFloat(data.total_fee / 100).toFixed(2),
            extend_params: {
                sys_service_provider_id: credential.ali_sys_service_provider_id
            }
        };
    }
    async req_alipay_qr(sock, data, cb) {
        try {
            const result = await alipaySdk.exec('alipay.trade.close', {
              notifyUrl: 'http://notify_url',
              appAuthToken: '',
              // sdk 会自动把 bizContent 参数转换为字符串，不需要自己调用 JSON.stringify
              bizContent: {
                tradeNo: '',
                outTradeNo: '',
                operatorId: '',
              },
            }, {
              // 验签
              validateSign: true,
              // 打印执行日志
              log: this.logger,
            });
          
            // result 为 API 介绍内容中 “响应参数” 对应的结果
            console.log(result);
          } catch (err) {
            //...
          }
        // try {
        //     // console.log('req_alipay_qr', data)
        //     const mch = await util.verify_req(data, () => data.cli_id);
        //     const od = this.get_req_obj(sock, data, mch);
        //     const reqObj = {
        //         notify_url: `${util.get_myurl_by_sock(sock)}/ali_notify`,
        //         app_auth_token: mch.ali.app_auth_token,
        //         biz_content: JSON.stringify(od)
        //     };
        //     const res = await ali.trade_precreate(reqObj);
        //     if(res.code !== '10000') throw res.sub_msg || res.msg;
        //     data.trade_type = '支付宝正扫';
        //     evt.ac('db_insert_po', data);   //no need to await?
        //     cb({
        //         ret: 0,
        //         code_url: res.qr_code,
        //         qr_code: res.qr_code
        //     });
        // } catch (err) {
        //     console.log(err)
        //     cb({
        //         ret: -1,
        //         msg: err.message
        //     })
        // }
    }
}
module.exports = new AliApi;
