const java = require("java");
const moment = require('moment');
const _ = require('lodash');
const querystring = require('querystring');
const credential = require('../secret')
const util = require('../common/util')
const mail = require('./mail');
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
function handle_pay_event(app, io) {
    app.get('/ali_result', (req, res)=> {
        res.writeHead(200, {"Content-Type": "text/html; charset=utf-8"});
        res.end('支付成功')
    })
    app.get('/ali_wap_pay', function (req, res) {
        let data = req.query;
        //to finish
        (async () => {
            try{
                let notify_url = "https://pay.cninone.com/ali_notify"
                let return_url = "https://pay.cninone.com/ali_result"
                let decoded = await util.verify_req(data)
                let reqObj = get_req_obj(req, data, decoded)
                reqObj.product_code = 'QUICK_WAP_WAY'
                console.log('in /ali_wap_pay', reqObj)
                let html = await ali_pay.wap_payPromise( 
                    JSON.stringify(reqObj), 
                    decoded.ali.app_auth_token,
                    return_url,
                    notify_url
                )
                res.writeHead(200, {"Content-Type": "text/html; charset=utf-8"});
                res.end(html)
            } catch (err) {
                console.log('some thing wrong', err)
            }
            return "done"
        })()  
    })
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
                res.app_auth_token && m_db.collection('merchant')
                    .update({ aly_id: res.user_id }, {
                        $set: {
                            'ali.app_auth_token': res.app_auth_token,
                            'ali.app_refresh_token': res.app_refresh_token,
                            'ali.expires_in': res.expires_in,
                            'ali.re_expires_in': res.re_expires_in,
                        }
                    }, { upsert: true })
                    .then(() => {
                        mail.send(`支付平台,支付宝商户授权`, null, JSON.stringify(res) )
                        io.emit('mch_changed', '');
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
                    util.notify_or_save_pay_result(order_id, resp, io, res)
                }
            })
            .catch(err => {
                console.log('can not find pending order', err);
                res.end('failed');
            })
    });
    io.on('connection', socket => {
        socket.on('req_alipay_qr', (data, cb) => req_alipay_qr(socket, data, cb));
        socket.on('ali_auth_pay', (data, cb) => req_auth_pay(socket, data, cb));
        socket.on('ali_order_query', (data, cb) => order_query(socket, data, cb));
        socket.on('ali_reverse', (data, cb) => reverse(socket, data, cb));
        socket.on('ali_refund', (data, cb) => refund(socket, data, cb));
    });
}
//here
function refund(sock, data, cb) {
    (async () => {
        try{
            const refund_amount = parseFloat(data.refund_amount / 100).toFixed(2)
            let usr = await util.verify_usr(data)
            let reqObj = {
                out_trade_no: data.out_trade_no,
                refund_amount,
                refund_reason: data.refund_reason,
                store_id: data.store_id
            }
            const auth_token = await get_auth_token_by_order_id(data.out_trade_no)
            let res = await ali_pay.trade_refundPromise( JSON.stringify(reqObj), auth_token )
            res = JSON.parse(res).alipay_trade_refund_response;
            // console.log(res)
            if(res.code === '10000'){
                cb({ ret: 0, msg: '退款成功' })
                util.change_order_state_to_refund(data.out_trade_no)
            } else{
                throw `${res.msg}(${res.sub_msg})`
            }
        } catch (err) {
            console.log( err )
            cb({ ret: -1, msg: err });
        }
        return "done"
    })()    
} 
function reverse(sock, data, cb) {
    (async () => {
        try{
            let usr = await util.verify_usr(data)
            let reqObj = {
                out_trade_no: data.out_trade_no
            }
            const auth_token = await get_auth_token_by_order_id(data.out_trade_no)
            let res = await ali_pay.trade_cancelPromise( JSON.stringify(reqObj), auth_token )
            res = JSON.parse(res).alipay_trade_cancel_response;
            if(res.code === '10000'){
                if(res.action === 'close'){
                    cb({ ret: 0, msg: '撤销成功（交易关闭）' });                   
                } else if(res.action === 'refund'){
                    cb({ ret: 0, msg: '撤销成功（已退款）' });
                    util.change_order_state_to_refund(data.out_trade_no)
                } else{
                    throw '撤销成功（未知操作）'
                }
            } else{
                throw `${res.msg}(${res.sub_msg})`
            }
        } catch (err) {
            console.log( err )
            cb({ ret: -1, msg: err });
        }
        return "done"
    })()    
} 
function get_auth_token_by_order_id(order_id){
    return (async () => {
        let order = await m_db.collection('orders').findOne({
            out_trade_no:order_id
        })
        if(!order) throw 'can not find order'
        let mch = await m_db.collection('merchant').findOne({
            aly_id : order.sub_mch_id
        })
        if(!mch) throw 'can not find merchant'
        return mch.ali.app_auth_token
    })()
}
function order_query(sock, data, cb) {
    (async () => {
        try{
            let usr = await util.verify_usr(data)
            const auth_token = await get_auth_token_by_order_id(data.out_trade_no)
            // console.log('auth_token='+auth_token)
            let reqObj = {
                out_trade_no: data.out_trade_no
            }
            let res = await ali_pay.trade_queryPromise( JSON.stringify(reqObj), auth_token )
            res = JSON.parse(res).alipay_trade_query_response;
            if(res.code === '10000'){
                if(res.trade_status === 'TRADE_SUCCESS'
                    || res.trade_status === 'TRADE_SUCCESS'){
                    cb({ ret: 0, msg: '支付成功' });                   
                } else if(res.trade_status === 'TRADE_CLOSED'){
                    throw '交易已关闭'
                } else{
                    throw '未知状态'
                }
            } else{
                throw `${res.msg}(${res.sub_msg})`
            }
        } catch (err) {
            console.log( err )
            cb({ ret: -1, msg: err });
        }
        return "done"
    })()    
}
//把微信的请求格式转成ali的（客户端请求单位全部用 分）
function get_req_obj(sock_or_req, data, decoded) {
    data.total_fee = parseInt(data.total_fee)
    data.sub_mch_id = decoded.aly_id;
    data.spbill_create_ip = util.is_sock(sock_or_req)? util.get_ip_by_sock(sock_or_req) : util.get_ip_by_req(sock_or_req);
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
function req_alipay_qr(sock, data, cb) {
    util.verify_req(data
        , () => data.cli_id
    )
        .then(decoded => {
            console.log('decoded=', decoded)
            if (decoded.ali && decoded.ali.app_auth_token) {
                let reqObj = get_req_obj(sock, data, decoded)
                ali_pay.precreate(JSON.stringify(reqObj), decoded.ali.app_auth_token, (err, res) => {
                    if (err) {
                        console.log(err, res)
                        cb({
                            ret: -1,
                            msg: err
                        })
                    } else {
                        res = JSON.parse(res).alipay_trade_precreate_response;
                        data.cli_id = data.cli_id
                        data["pay_status"] = "invalid"
                        data.sock_status = 'valid'
                        data.sock_id = sock.id;
                        data.createdAt = new Date();
                        data.out_trade_no = reqObj.out_trade_no;                        
                        data.trade_type = '支付宝正扫';
                        delete data.token;
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
    (async () => {
        try{
            let decoded = await util.verify_req(data, () => data.auth_code)
            if (decoded.ali && decoded.ali.app_auth_token) {
                let reqObj = get_req_obj(sock, data, decoded)
                data.time_begin = moment().format("YYYY-MM-DD HH:mm:ss")
                reqObj.auth_code = data.auth_code
                reqObj.scene = "bar_code"
                let res = await ali_pay.trade_payPromise(JSON.stringify(reqObj), decoded.ali.app_auth_token)
				res = JSON.parse(res).alipay_trade_pay_response;
				console.log(res)
				if (res.code == '10000') {
                    cb({
                        ret: 0,
                        msg: '支付成功(交易完成)'
                    });
                    data.trade_type = '支付宝反扫';
                    data.time_end = moment().format("YYYY-MM-DD HH:mm:ss")
                    m_db.collection('orders').insert(data)
                } else if (1) {
                    throw res.sub_msg || res.msg
                }
            } else {
                throw '无商户授权码'
            }
        } catch (err) {
            // console.log( err )
            cb({ ret: -1, msg: err });
        }
        return "done"
    })() 
}
module.exports = {
    handle_pay_event,
    req_pay_qr
}
//post api below
function req_pay_qr(req, data, cb) {
    (async () => {
        try{
            let decoded = await util.verify_req(data)
            if (decoded.ali && decoded.ali.app_auth_token) {
                let reqObj = get_req_obj(req, data, decoded)
                let res = await ali_pay.precreatePromise( JSON.stringify(reqObj), decoded.ali.app_auth_token)
                res = JSON.parse(res).alipay_trade_precreate_response;
                data["pay_status"] = "invalid"
                data.sock_status = 'valid'
                data.createdAt = new Date();
                data.out_trade_no = reqObj.out_trade_no;                        
                data.trade_type = '支付宝正扫';
                delete data.token;
                m_db.collection('pending_order').insert(data)
                if(res.qr_code){                    
                    cb({ret:0, code_url:res.qr_code})
                }else {
                    console.log("generate ali qr code failed", res)
                    cb({ret:-1, msg:res.sub_msg})
                }
            } else {
                throw '无商户授权码'
            }
        } catch (err) {
            // console.log( err )
            cb({ ret: -1, msg: err });
        }
        return "done"
    })()    
}