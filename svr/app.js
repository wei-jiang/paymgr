const fs = require('fs');
const path = require('path');
const app = require('express')();
const nunjucks = require('nunjucks');
const helmet = require('helmet');
const cors = require('cors');
const session = require('express-session');
const MongoStore = require('connect-mongo')(session);
const server = require('http').Server(app);
const io = require('socket.io')(server);
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const xmlparser = require('express-xml-bodyparser');
const querystring = require('querystring');
const request = require('request');
const _ = require('lodash');
const moment = require('moment');
const cron = require('./dealer/cron')
const Ali = require('./dealer/aly')
const Wx = require('./dealer/wx')
const Redis = require('ioredis');
const redis_adapter = require('socket.io-redis');
const redis_adapter_pub = new Redis({
    host: '127.0.0.1',
    port: 6379
    // ,password: 'freego'
});
const redis_adapter_sub = new Redis();
// const redis_for_emitter = new Redis();
// redis_for_emitter.set('foo', 'bar');
// redis_for_emitter.get('foo', function (err, result) {
//     if ('bar' == result) {
//         console.log('redis server function ok');
//     } else {
//         console.log('redis server function not ok');
//     }
// });
// global.redis_emitter = require('socket.io-emitter')(redis_for_emitter);
io.adapter(redis_adapter({ pubClient: redis_adapter_pub, subClient: redis_adapter_sub }));
global.io = io;
const credential = require('./secret')
const util = require('./common/util')
const def = require('./common/def')
let mongo = require('mongodb'),
    MongoClient = mongo.MongoClient,
    ObjectId = mongo.ObjectID,
    Binary = mongo.Binary,
    http_svr;
global.m_db = null;
app.set('port', process.env.PORT || 8200);
app.use(session({
    secret: credential.session_key,
    store: new MongoStore({
        url: credential.db_url,
        // ttl: 14 * 24 * 60 * 60 // = 14 days. Default
        ttl: 1 * 60 * 60,
        touchAfter: 24 * 3600 // time period in seconds
    }),
    resave: false,
    saveUninitialized: false
}));
MongoClient.connect(credential.db_url)
    .then(client => {
        m_db = client.db(credential.db_name);
        m_db.collection('pending_order').createIndex({ "createdAt": 1 }, { expireAfterSeconds: 3600 })
        m_db.collection('temp').createIndex({ "createdAt": 1 }, { expireAfterSeconds: 30 * 60 })
        console.log('connect to mongodb(paymgr) success')
        const listen_port = app.get('port') + (parseInt(process.env.NODE_APP_INSTANCE) || 0);
        // console.log('listen_port='+ listen_port)
        
        http_svr = server.listen(listen_port
            , 'localhost'
            , () => {
                console.log("Express server listening on port " + listen_port);
            });
    })
    .catch(err => console.log('connect to mongodb(paymgr) failed', err))



nunjucks.configure('views', {
    autoescape: true,
    express: app
});

app.use(require('express').static(__dirname + '/public'));

app.use(helmet());
app.use(cors());
app.use(xmlparser());
app.use(cookieParser());
app.use(bodyParser.json());       // to support JSON-encoded bodies
app.use(bodyParser.urlencoded({     // to support URL-encoded bodies
    extended: true
}));
global.winston = require('winston');
let logDir = 'log';
// Create the log directory if it does not exist
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir);
}
global.winston = new (winston.Logger)({
    transports: [
        new (require('winston-daily-rotate-file'))({
            filename: logDir + '/-pay_mgr.log',
            timestamp: function () {
                return moment().format("YYYY-MM-DD HH:mm:ss SSS");
            },
            datePattern: 'yyyy-MM-dd',
            prepend: true,
            localTime: true
        })
    ]
});

app.get('/headers', function (req, res) {
    let data = req.headers;
    res.end(JSON.stringify(data));
});
app.get('/mobile.html', function (req, res) {

    let ua = req.headers['user-agent'];
    let is_wx_agent = /MicroMessenger/i.test(ua);
    if (is_wx_agent) {
        var openid = req.query.oid;
        if (!openid) {
            const qs = querystring.stringify({
                rurl: `${util.get_myurl_by_req(req)}/mobile.html`
            });
            let r_url = `https://wx.ily365.cn/oid?${qs}`;
            // console.log(r_url);
            res.redirect(r_url);

        } else {
            console.log('get openid=%s', openid);
            res.render('mobile.html', {
                pay_type: def.PAY_TYPE.WX_GZH,
                usr_id: openid
            });
        }
    } else {
        //use ali pay
        // let host = req.headers['host'];
        // if (host.indexOf('localhost') >= 0 || host.indexOf('192.168.') >= 0) {

        // }
        res.render('mobile.html', {
            pay_type: def.PAY_TYPE.ALI_WAP,
            usr_id: ''
        });
    }

});
app.get('/test', (req, res) => {
    const data = req.query;
    console.log('on get /test, data=' + JSON.stringify(data));
    res.end( JSON.stringify(data) )
})
app.post('/test', (req, res) => {
    const data = req.body;
    console.log('on post /test, data=' + JSON.stringify(data));
    res.end('success')
})
app.get('/api/wx_gzh_relay.html', (req, res) => {
    const rurl = req.query['rurl'];
    const nurl = req.query['nurl'];
    const price = req.query['price'];
    const token = req.query['token'];
    const order_id = req.query['oid'];
    const desc = req.query['desc'];
    const sess = req.session;
    // console.log('/api/wx_gzh_relay.html, qdata=' + JSON.stringify(req.query));
    if (!rurl || !desc || !nurl || !price || !token || !order_id) {
        // res.writeHead(200, {"Content-Type": "text/html; charset=utf-8"});
        return res.end('wrong parameters');
    }
    (async () => {
        try{
            let decoded = await util.verify_mch_token(token)
            // console.log(decoded)
            sess.rurl = rurl;
            sess.mch_decoded = decoded;
            sess.order_data = {
                out_trade_no: order_id,
                body: desc,
                total_fee: price,
                notify_url: nurl
            };
            const qs = querystring.stringify({rurl: `${util.get_myurl_by_req(req)}/wx_gzh_pay`})
            // console.log(qs)
            res.redirect(`https://wx.ily365.cn/oid?${qs}`);
        } catch (err) {
            // console.log( err )
            res.end( JSON.stringify(err) );
        }
        return "done"
    })()    
})
app.post('/api/qr_pay/result', (req, res) => {
    const data = req.body;
    // console.log('/api/qr_pay/result, data=' + JSON.stringify(data));
    (async () => {
        try{
            let decoded = await util.verify_usr(data)
            if (decoded.ali && decoded.ali.app_auth_token) {
                let order = await m_db.collection('orders').findOne({out_trade_no: data.order_id}, {projection:{_id: 0}})
                res.json({ ret: 0, order });
            } else {
                throw '无商户授权码'
            }
        } catch (err) {
            // console.log( err )
            res.json({ ret: -1, msg: err });
        }
        return "done"
    })()    
})
app.post('/api/qr_pay', (req, res) => {
    const data = req.body;
    // console.log('/api/qr_pay, data=' + JSON.stringify(data));
    let req_data = {
        token:data.token,
        out_trade_no: data.order_id,
        body: data.product_desc,
        total_fee: data.amount,
        notify_url: data.notify_url
    }
    if(data.qr_type == 0 ){
        Wx.req_pay_qr( req, req_data, ret=>res.json(ret) )
    } else{
        Ali.req_pay_qr( req, req_data, ret=>res.json(ret) )
    }
})
// app.post('/test_notify', (req, res) => {
//     let resp = req.body;
//     console.log('test_notify=' + JSON.stringify(resp));
//     function find_and_delete(data) {
//         m_db.collection('pending_order').findOneAndDelete({
//             "sock_status": "valid",
//             out_trade_no: data.order_id
//         })
//             .then(r => {
//                 let o = r.value
//                 console.log('find pending order', o);
//                 if (o) {
//                     let order = {
//                         body: o.body,
//                         sub_mch_id: o.sub_mch_id,
//                         out_trade_no: o.out_trade_no,
//                         total_fee: o.total_fee,
//                         spbill_create_ip: o.spbill_create_ip,
//                         trade_type: o.trade_type,
//                         time_begin: moment(o.createdAt).format("YYYY-MM-DD HH:mm:ss"),
//                         time_end: moment().format("YYYY-MM-DD HH:mm:ss")
//                     }
//                     io.to(o.sock_id).emit('pay_result', order);
//                     res.end('success');
//                 } else {
//                     console.log('can not find pending order');
//                     setTimeout(_.partial(find_and_update, data), 0)
//                 }
//             })
//             .catch(err => {
//                 console.log('find pending order failed, err=', err);
//             })
//     }
//     function find_and_update(data) {
//         m_db.collection('pending_order').findOneAndUpdate(
//             {
//                 "sock_status": "invalid",
//                 out_trade_no: data.order_id
//             },
//             {
//                 $set: { "pay_status": "valid", noty_data: data }
//             }
//         )
//             .then(r => {
//                 console.log('find_and_update', r)
//                 if (r.ok == 1) {
//                     res.end('success');
//                 } else {
//                     setImmediate(_.partial(find_and_delete, data))
//                 }
//             })
//             .catch(err => {
//                 setImmediate(_.partial(find_and_delete, data))
//             })
//     }
//     find_and_delete(resp)
// });
io.on('connection', socket => {
    socket.on('disconnect', function () {
        m_db.collection('pending_order').updateMany(
            {
                sock_id: socket.id
            },
            {
                $set: { "sock_status": "invalid" }
            }
        )
            .then(r => {
                console.log(`update disconnected sock to invalid, ${r.result.nModified} docs modified`)
            })
        socket.removeAllListeners();
    });
    socket.on('client_uuid', cli_uuid => {
        console.log('client_uuid', cli_uuid)
        function find_and_update(uuid) {
            m_db.collection('pending_order').update({
                cli_id: uuid
            }, {
                    $set: { sock_id: socket.id, "sock_status": "valid" }
                })
                .then(r => {
                    // console.log('updateOne reuturn=', r)
                    if (r.modifiedCount >= 1) {
                        console.log('updated socket.id')
                    }
                    find_and_delete(uuid)
                })
        }
        function find_and_delete(uuid) {
            m_db.collection('pending_order').find({
                cli_id: uuid,
                "pay_status": "valid"
            })
                .toArray()
                .then(ready_orders => {
                    console.log('ready_orders', ready_orders);
                    _.each(ready_orders, o => {
                        let order = {
                            body: o.body,
                            sub_mch_id: o.sub_mch_id,
                            out_trade_no: o.out_trade_no,
                            total_fee: o.total_fee,
                            spbill_create_ip: o.spbill_create_ip,
                            trade_type: o.trade_type,
                            time_begin: moment(o.createdAt).format("YYYY-MM-DD HH:mm:ss"),
                            time_end: moment().format("YYYY-MM-DD HH:mm:ss")
                        }
                        io.to(o.sock_id).emit('pay_result', order);
                        m_db.collection('pending_order').deleteOne(o)
                    })
                })
        }
        find_and_update(cli_uuid)
    });
    socket.on('verify_user', (usr_token, cb) => {
        // console.log('client_uuid', usr_token)
        util.verify_token(usr_token, (err, decoded) => {
            if (err) {
                cb({ ret: -1, err })
            } else {
                cb({ ret: 0, user: decoded })
            }
        })
    });
    /////////////////////////////////////////////////
    //below are mch mgr apis, every api need token of user info
    socket.on('find_orders', (data, cb) => {
        // console.log('in req_token', data)
        util.verify_usr(data)
            .then(usr => {
                return m_db.collection('orders').find({}).toArray()
            })
            .then(orders => {
                cb({ ret: 0, orders })
            })
            .catch(err => {
                cb({ ret: -1, msg: err })
            })

    });
    socket.on('req_token', (data, cb) => {
        // console.log('in req_token', data)
        util.verify_usr(data)
            .then(usr => {
                delete data._id;
                const token = util.sign_token(data)
                cb({ ret: 0, token })
            })
            .catch(err => {
                cb({ ret: -1, err })
            })

    });
    socket.on('add_mch', data => {
        // console.log('in req_token', data)
        util.verify_usr(data)
            .then(usr => {
                return m_db.collection('merchant').insert(data)
            })
            .then(() => {
                // socket.broadcast.emit('mch_changed', '');
                io.emit('mch_changed', '');
            })
            .catch(err => {
                socket.emit('need_login_first', '');
            })
    });
    socket.on('del_mch', data => {
        // console.log('in del_mch', data)
        util.verify_usr(data)
            .then(usr => {
                return m_db.collection('merchant').remove({
                    _id: new ObjectId(data._id)
                })
            })
            .then(() => {
                // socket.broadcast.emit('mch_changed', '');
                io.emit('mch_changed', '');
            })
            .catch(err => {
                socket.emit('need_login_first', '');
            })

    });
    socket.on('mod_mch', data => {
        // console.log('in mod_mch', data)
        util.verify_usr(data)
            .then(usr => {
                let id = new ObjectId(data._id);
                delete data._id;
                return m_db.collection('merchant').update({ _id: id }, data)
            })
            .then(() => {
                // socket.broadcast.emit('mch_changed', '');
                io.emit('mch_changed', '');
            })
            .catch(err => {
                socket.emit('need_login_first', '');
            })
    });
    socket.on('get_mchs', (data, cb) => {
        util.verify_usr(data)
            .then(usr => {
                return m_db.collection('merchant').find({}).toArray()
            })
            .then(mchs => {
                // console.log(orders)
                cb({ ret: 0, mchs })
            })
            .catch(err => {
                cb({ ret: -1, err })
            })
    });
    socket.on('get_mchs_with_token', (data, cb) => {
        m_db.collection('merchant').find({}).toArray()
            .then(mchs => {
                mchs = _.map(mchs, m => {
                    let pay_type = 0
                    if(m.wx_id) pay_type |= def.PAY_TYPE.WX_GZH
                    if(m.aly_id) pay_type |= def.PAY_TYPE.ALI_WAP
                    return {
                        pay_type,
                        name: m.name,
                        token: util.sign_token(m)
                    }
                })
                // console.log(mchs)
                cb({ ret: 0, mchs })
            })
            .catch(err => {
                cb({ ret: -1, msg: err })
            })
    });
});

cron.start()
Ali.handle_pay_event(app, io)
Wx.handle_pay_event(app, io)
function shutdown_svr() {
    // console.log('in shutdown_svr()');
    io.clients((error, clients) => {
        console.log(clients); // => [6em3d4TJP8Et9EMNAAAA, G5p55dHhGgUnLUctAAAB]
        if (_.size(clients) > 0) {
            clients = _.map(clients, sid => {
                return {
                    sock_id: sid
                }
            })
            let q = { $or: clients }
            m_db.collection('pending_order').updateMany(q, { $set: { sock_status: 'invalid' } })
                .then(() => {
                    console.log('update clients sock status before exit');
                    process.exit()
                })
                .catch(err => {
                    process.exit()
                })

        } else {
            process.exit()
        }
    });
}
process.on('SIGINT', function () {
    // console.log('in process.on(SIGINT)')
    shutdown_svr()
});
