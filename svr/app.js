const fs = require('fs');
const path = require('path');
const app = require('express')();
const nunjucks = require('nunjucks');
const helmet = require('helmet');
const cors = require('cors');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const server = require('http').Server(app);
const io = require('socket.io')(server);
const WebSocket = require('ws');
const wss = new WebSocket.Server({ server, path: "/ws" });
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const xmlparser = require('express-xml-bodyparser');
const querystring = require('querystring');
const request = require('request-promise-native')
const _ = require('lodash');
const moment = require('moment');
const winston = require('winston');
const logDir = 'log', clients = {};
// Create the log directory if it does not exist
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir);
}
////////////////////////////////////////////////
global.evt = require('./common/evt')
global.logger = new (winston.Logger)({
    transports: [
        new (require('winston-daily-rotate-file'))({
            level: 'silly',
            filename: 'paymgr-%DATE%.log',
            dirname: logDir,
            datePattern: 'YYYY-MM-DD',
            timestamp: () => moment().format("YYYY-MM-DD HH:mm:ss.SSS"),
            prepend: true,
            zippedArchive: true,
            maxSize: '20m',
            maxFiles: '14d'
        })
    ]
});
////////////////////////////////////////////////
require('./dealer/db');
require('./dealer/wx_api');
require('./dealer/ali_api')
// const cron = require('./dealer/cron')
// const user = require('./dealer/user')


const credential = require('./secret')
// const util = require('./common/util')
// const def = require('./common/def')

app.set('port', process.env.PORT || 8200);
app.use(session({
    secret: credential.session_key,
    store: new SQLiteStore({ db: credential.db_name, dir: '.', concurrentDB: true }),
    cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 }, // 1 week
    resave: false,
    saveUninitialized: false
}));

nunjucks.configure('views', {
    autoescape: true,
    express: app
});

app.use(require('express').static(__dirname + '/public'));

app.use(helmet());
app.use(cors());
app.use(xmlparser({ trim: true, explicitArray: false }));
app.use(cookieParser());
app.use(bodyParser.json());       // to support JSON-encoded bodies
app.use(bodyParser.urlencoded({     // to support URL-encoded bodies
    extended: true
}));
(async () => {
    await evt.ac('db_open')
    await server.listen(app.get('port'));
    console.log("Express server listening on port " + app.get('port'));
    logger.info(`Express server listening on port: ${app.get('port')}`)
    return 'done'
})()

app.get('/headers', (req, res) => {
    const data = req.headers;
    res.end(JSON.stringify(data));
});
evt.emit('init_rest', app);
evt.on('notify_cli', async (order_id) => {
    const po = await evt.ac('db_get_po_by_oid', order_id);
    if (po) {
        const o = _.omit(po, ['_id', 'cli_id', 'status', 'notify_url']);
        o.time_end = moment().format("YYYY-MM-DD HH:mm:ss");
        const to_cli = clients[po.cli_id];
        // ws/sock and notify_url mutual exclusion ?
        if (po.notify_url) {
            (async function post_result() {
                let retry_cnt = 10;
                const post_data = { ret: 0, order: o }
                logger.info(`post to ${po.notify_url}, data=${JSON.stringify(post_data)}`)
                try {
                    const ret = await request.post({
                        // timeout: 2000,
                        url: o.notify_url,
                        json: post_data
                    });
                    logger.info(`post to ${po.notify_url} success, return:${ret}`)
                    await evt.ac('db_del_po_by_oid', order_id);
                } catch (err) {
                    if(--retry_cnt > 0){
                        logger.error(`post to ${po.notify_url} failed, err_msg=${JSON.stringify(err.message)}, retry after 10 seconds`)
                        setTimeout(post_result, 10 * 1000)
                    }                   
                }
                
            })()
        } 
        if (to_cli) {
            to_cli('pay_result', o);
            await evt.ac('db_del_po_by_oid', order_id);
        } else {
            await evt.ac('db_chg_po_to_paid', order_id);
        }
        await evt.ac('db_insert_order', o);
    }
});
// app.get('/mobile.html', function (req, res) {

//     let ua = req.headers['user-agent'];
//     let is_wx_agent = /MicroMessenger/i.test(ua);
//     if (is_wx_agent) {
//         var openid = req.query.oid;
//         if (!openid) {
//             const qs = querystring.stringify({
//                 rurl: `${util.get_myurl_by_req(req)}/mobile.html`
//             });
//             let r_url = `https://wx.ily365.cn/oid?${qs}`;
//             // console.log(r_url);
//             res.redirect(r_url);

//         } else {
//             console.log('get openid=%s', openid);
//             res.render('mobile.html', {
//                 pay_type: def.PAY_TYPE.WX_GZH,
//                 usr_id: openid
//             });
//         }
//     } else {
//         //use ali pay
//         // let host = req.headers['host'];
//         // if (host.indexOf('localhost') >= 0 || host.indexOf('192.168.') >= 0) {

//         // }
//         res.render('mobile.html', {
//             pay_type: def.PAY_TYPE.ALI_WAP,
//             usr_id: ''
//         });
//     }

// });
// app.get('/test', (req, res) => {
//     const data = req.query;
//     console.log('on get /test, data=' + JSON.stringify(data));
//     res.end(JSON.stringify(data))
// })
// app.post('/test', (req, res) => {
//     const data = req.body;
//     console.log('on post /test, data=' + JSON.stringify(data));
//     res.end('success')
// })
// app.post('/api/auth_pay', (req, res) => {
//     const data = req.body;
//     (async () => {
//         try {
//             let decoded = await util.verify_mch_token(data.token)
//             // console.log(decoded)
//             let h = parseInt(data.auth_code.slice(0, 2));
//             if (h >= 10 && h <= 15) {
//                 //wx auth code
//                 Wx.post_auth_pay(data, decoded, res)
//             } else if (h >= 25 && h <= 30) {
//                 //ali auth code
//                 Ali.post_auth_pay(data, decoded, res)
//             } else {
//                 //unknown
//                 res.json( {ret:-1, msg: "无效的付款码"} );
//             }
//         } catch (err) {
//             // console.log( err )
//             res.json({ ret: -1, msg: err });
//         }
//         return "done"
//     })()
// })
// app.get('/api/wx_gzh_relay.html', (req, res) => {
//     const rurl = req.query['rurl'];
//     const nurl = req.query['nurl'];
//     const price = req.query['price'];
//     const token = req.query['token'];
//     const order_id = req.query['oid'] || 'gzh_' + moment().format("YYYYMMDDHHmmssSSS");
//     const desc = req.query['desc'];
//     const sess = req.session;
//     // console.log('/api/wx_gzh_relay.html, qdata=' + JSON.stringify(req.query));
//     if (!rurl || !desc || !nurl || !price || !token) {
//         // res.writeHead(200, {"Content-Type": "text/html; charset=utf-8"});
//         return res.end('wrong parameters');
//     }
//     (async () => {
//         try {
//             let decoded = await util.verify_mch_token(token)
//             // console.log(decoded)
//             sess.rurl = rurl;
//             sess.mch_decoded = decoded;
//             sess.order_data = {
//                 out_trade_no: order_id,
//                 body: desc,
//                 total_fee: price,
//                 notify_url: nurl
//             };
//             const qs = querystring.stringify({ rurl: `${util.get_myurl_by_req(req)}/wx_gzh_pay` })
//             // console.log(qs)
//             res.redirect(`https://wx.ily365.cn/oid?${qs}`);
//         } catch (err) {
//             // console.log( err )
//             res.end(JSON.stringify(err));
//         }
//         return "done"
//     })()
// })
// app.post('/api/qr_pay/result', (req, res) => {
//     const data = req.body;
//     // console.log('/api/qr_pay/result, data=' + JSON.stringify(data));
//     (async () => {
//         try {
//             let decoded = await util.verify_mch_token(data.token)
//             let order = await m_db.collection('orders').findOne({ out_trade_no: data.order_id }, { projection: { _id: 0 } })
//             res.json({ ret: 0, order });

//         } catch (err) {
//             // console.log( err )
//             res.json({ ret: -1, msg: err });
//         }
//         return "done"
//     })()
// })
// app.post('/api/qr_pay', (req, res) => {
//     const data = req.body;
//     // console.log('/api/qr_pay, data=' + JSON.stringify(data));
//     let req_data = {
//         token: data.token,
//         out_trade_no: data.order_id,
//         body: data.product_desc,
//         total_fee: data.amount,
//         notify_url: data.notify_url
//     }
//     if (data.qr_type == 0) {
//         Wx.req_pay_qr(req, req_data, ret => res.json(ret))
//     } else {
//         Ali.req_pay_qr(req, req_data, ret => res.json(ret))
//     }
// })
wss.on('connection', (ws, req) => {
    evt.emit('init_ws', ws, req);
    ws.on('error', err => {
        console.log('ws client error');
    });
    ws.on('message', message => {
        try {
            const data = JSON.parse(message);
            const cmd = data.cmd;
            delete data.cmd;
            ws.emit(cmd, data);
        } catch (err) {

        }
    })
    ws.on('client_uuid', client_uuid => {
        ws.cli_id = cli_uuid;
        clients[cli_uuid] = (cmd, data) => {
            if (typeof data !== 'object') return;
            data.cmd = cmd;
            const msg = JSON.stringify(data);
            ws.send(cmd, msg)
        }
    })
    ws.on('close', reason => {
        console.log('ws client closed');
        delete clients[ws.cli_id];
        ws.removeAllListeners();
    });
});
io.on('connection', socket => {
    evt.emit('init_sio', socket);
    socket.on('disconnect', () => {
        delete clients[socket.cli_id];
        socket.removeAllListeners();
    });
    socket.on('client_uuid', cli_uuid => {
        socket.cli_id = cli_uuid;
        clients[cli_uuid] = (cmd, ...para) => {
            socket.emit(cmd, ...para)
        }
    });
});

// cron.start()
// Ali.handle_pay_event(app, io)
// Wx.handle_pay_event(app, io)
