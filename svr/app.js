const fs = require('fs');
const path = require('path');
const app = require('express')();
const nunjucks = require('nunjucks');
const helmet = require('helmet');
const cors = require('cors');
const session = require('express-session');
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
const redis_for_adapter = new Redis({
    host: '127.0.0.1',
    port: 6379
    // ,password: 'freego'
});
const redis_for_emitter = new Redis();
redis_for_emitter.set('foo', 'bar');
redis_for_emitter.get('foo', function (err, result) {
    if ('bar' == result) {
        console.log('redis server function ok');
    } else {
        console.log('redis server function not ok');
    }
});
global.redis_emitter = require('socket.io-emitter')(redis_for_emitter);
io.adapter(redis_adapter({ pubClient: redis_for_adapter, subClient: redis_for_adapter }));

const credential = require('./secret')
const util = require('./common/util')
let mongo = require('mongodb'),
    MongoClient = mongo.MongoClient,
    ObjectId = mongo.ObjectID,
    Binary = mongo.Binary
    ;
global.m_db = null;
MongoClient.connect(credential.db_url)
    .then(client => {
        m_db = client.db(credential.db_name);
        m_db.collection('pending_order').createIndex({ "createdAt": 1 }, { expireAfterSeconds: 3600 })
        console.log('connect to mongodb(paymgr) success')
    })
    .catch(err => console.log('connect to mongodb(paymgr) failed', err))

app.set('port', process.env.PORT || 8200);

nunjucks.configure('views', {
    autoescape: true,
    express: app
});
app.use(session({ secret: credential.session_key }));
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
server.listen(app.get('port')
    // , 'localhost'
    , () => {
        console.log("Express server listening on port " + app.get('port'));
    });


io.on('connection', socket => {
    socket.on('req_token', (data, cb) => {
        // console.log('in req_token', data)
        delete data._id;
        const token = util.sign_token(data)
        cb(token)
    });
    socket.on('add_mch', data => {
        // console.log('in req_token', data)
        m_db.collection('merchant')
            .insert(data)
            .then(() => {
                socket.emit('mch_changed', '');
                // socket.broadcast.emit('mch_changed', '');
                redis_emitter.emit('mch_changed', '');
            })
    });
    socket.on('del_mch', data => {
        // console.log('in del_mch', data)
        m_db.collection('merchant')
            .remove({
                _id: new ObjectId(data._id)
            })
            .then(() => {
                socket.emit('mch_changed', '');
                // socket.broadcast.emit('mch_changed', '');
                redis_emitter.emit('mch_changed', '');
            })
    });
    socket.on('mod_mch', data => {
        // console.log('in mod_mch', data)
        let id = new ObjectId(data._id);
        delete data._id;
        m_db.collection('merchant')
            .update(
            { _id: id },
            data
            )
            .then(() => {
                socket.emit('mch_changed', '');
                // socket.broadcast.emit('mch_changed', '');
                redis_emitter.emit('mch_changed', '');
            })
    });
    socket.on('get_mchs', (data, cb) => {
        m_db.collection('merchant')
            .find({})
            .toArray()
            .then(mchs => {
                // console.log(orders)
                cb(mchs)
            })
    });
});
const deal_aly_pay = require('./dealer/aly')
const deal_wx_pay = require('./dealer/wx')
deal_aly_pay(app, io)
deal_wx_pay(app, io)