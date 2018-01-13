
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
let mongo = require('mongodb'),
    MongoClient = mongo.MongoClient,
    ObjectId = mongo.ObjectID,
    Binary = mongo.Binary,
    http_svr;
global.m_db = null;
app.set('port', process.env.PORT || 8200);
MongoClient.connect(credential.db_url)
    .then(client => {
        m_db = client.db(credential.db_name);
        m_db.collection('pending_order').createIndex({ "createdAt": 1 }, { expireAfterSeconds: 3600 })
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
app.use(session({ 
    secret: credential.session_key,
    store: new MongoStore({ db: m_db })
}));
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
            filename: logDir + '/-ssm.log',
            timestamp: function () {
                return moment().format("YYYY-MM-DD HH:mm:ss SSS");
            },
            datePattern: 'yyyy-MM-dd',
            prepend: true,
            localTime: true
        })
    ]
});


app.post('/test_notify', (req, res) => {
    let resp = req.body;
    console.log('test_notify=' + JSON.stringify(resp));
    function find_delete(cnt) {
        m_db.collection('pending_order').findOneAndDelete({
            "status": "valid",
            out_trade_no: resp.order_id
        })
            .then(r => {
                let o = r.value
                console.log('find pending order', o);
                if (o) {
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
                    res.end('success');
                } else {
                    console.log('can not find pending order');       
                    if(cnt > 0) {
                        setTimeout( _.partial(find_delete, --cnt), 20 )
                    } else {
                        res.end('failed');
                    }             
                }
            })
            .catch(err => {
                console.log('find pending order failed, err=', err);
                res.end('failed');
            })
            
    }
    find_delete(2)
});
io.on('connection', socket => {
    socket.on('client_uuid', cli_uuid => {
        console.log('client_uuid', cli_uuid)
        m_db.collection('pending_order').updateOne({
            cli_id: cli_uuid
        }, {
                $set: { sock_id: socket.id, "sock_status": "valid" }
            })
            .then(r => {
                // console.log('updateOne reuturn=', r)
                if (r.modifiedCount == 1) {
                    console.log('updated socket.id')
                }
            })
    });
    /////////////////////////////////////////////////
    //below are mch mgr apis, every api need token of user info
    socket.on('req_token', (data, cb) => {
        // console.log('in req_token', data)
        util.verify_usr(data)
        .then( usr=>{
            delete data._id;
            const token = util.sign_token(data)
            cb( { ret:0,  token } )
        })
        .catch(err=>{
            cb( { ret:-1,  err } )
        })
        
    });
    socket.on('add_mch', data => {
        // console.log('in req_token', data)
        util.verify_usr(data)
        .then( usr=>{
            return m_db.collection('merchant').insert(data)
        })
        .then( () => {
            // socket.broadcast.emit('mch_changed', '');
            io.emit('mch_changed', '');
        })
        .catch(err=>{
            socket.emit('need_login_first', '');
        })
    });
    socket.on('del_mch', data => {
        // console.log('in del_mch', data)
        util.verify_usr(data)
        .then( usr=>{
            return  m_db.collection('merchant').remove({
                _id: new ObjectId(data._id)
            })
        })
        .then( () => {
            // socket.broadcast.emit('mch_changed', '');
            io.emit('mch_changed', '');
        })
        .catch(err=>{
            socket.emit('need_login_first', '');
        })

    });
    socket.on('mod_mch', data => {
        // console.log('in mod_mch', data)
        util.verify_usr(data)
        .then( usr=>{
            let id = new ObjectId(data._id);
            delete data._id;
            return m_db.collection('merchant').update( { _id: id }, data )
        })
        .then( () => {
            // socket.broadcast.emit('mch_changed', '');
            io.emit('mch_changed', '');
        })
        .catch(err=>{
            socket.emit('need_login_first', '');
        })
    });
    socket.on('get_mchs', (data, cb) => {
        util.verify_usr(data)
        .then( usr=>{
            return m_db.collection('merchant').find({}).toArray()
        })
        .then(mchs => {
            // console.log(orders)
            cb( { ret:0,  mchs } )
        })
        .catch(err=>{
            cb( { ret:-1,  err } )
        })      
    });
});
const cron = require('./dealer/cron')
cron.start()
const deal_aly_pay = require('./dealer/aly')
const deal_wx_pay = require('./dealer/wx')
deal_aly_pay(app, io)
deal_wx_pay(app, io)
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
            m_db.collection('pending_order').updateMany(q, { $set: { status: 'invalid' } })
                .then(() => {
                    console.log('update clients sock status before exit');
                    process.exit()
                })
                .catch(err=>{
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
