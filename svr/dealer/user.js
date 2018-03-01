const _ = require("lodash");
const moment = require('moment');
const mongo = require('mongodb'),
    MongoClient = mongo.MongoClient,
    ObjectId = mongo.ObjectID,
    Binary = mongo.Binary;
const util = require('../common/util')

function reg_user_dealer(socket, app){
    app.post('/reg_app_usr', (req, res) => {
        const data = req.body;
        (async () => {
            try {
                let usr = await util.verify_usr_token(data.token)
                if( !(usr.name && usr.email && usr.password) ){
                    throw 'invalid token'
                }
                const pass = usr.password
                delete usr.password;
                usr.token = util.sign_token_with_pass(usr, pass)
                res.json({ ret: 0, user: usr });
            } catch (err) {
                console.log(err)
                res.json({ ret: -1, msg: err });
            }
            return "done"
        })()
    })
    socket.on('gen_usr_token', (data, cb) => {
        // console.log('in gen_usr_token', data)
        util.verify_usr(data)
            .then(usr => {                
                const pass = data.password;
                delete data._id;
                delete data.password;
                // console.log(data)
                const token = util.sign_token_with_pass(data, pass)
                // console.log('token='+token)
                cb({ ret: 0, token })
            })
            .catch(err => {
                console.log(err)
                cb({ ret: -1, msg: err })
            })
    });
    socket.on('gen_usr_reg_token', (data, cb) => {
        console.log('in gen_usr_reg_token', data)
        util.verify_usr(data)
            .then(usr => {                
                delete data._id;
                const token = util.sign_usr_token_10m(data)
                cb({ ret: 0, token })
            })
            .catch(err => {
                console.log(err)
                cb({ ret: -1, msg: err })
            })
    });
    socket.on('add_usr', data => {
        // console.log('in add_usr', data)
        util.verify_usr(data)
            .then(usr => {
                return m_db.collection('user').insert(data)
            })
            .then(() => {
                // socket.broadcast.emit('usr_changed', '');
                io.emit('usr_changed', '');
            })
            .catch(err => {
                // console.log(err)
                socket.emit('need_login_first', '');
            })
    });
    socket.on('del_usr', data => {
        // console.log('in del_usr', data)
        util.verify_usr(data)
            .then(usr => {
                return m_db.collection('user').remove({
                    _id: new ObjectId(data._id)
                })
            })
            .then(() => {
                // socket.broadcast.emit('usr_changed', '');
                io.emit('usr_changed', '');
            })
            .catch(err => {
                // console.log(err)
                socket.emit('need_login_first', '');
            })

    });
    socket.on('mod_usr', data => {
        // console.log('in mod_usr', data)
        util.verify_usr(data)
            .then(usr => {
                let id = new ObjectId(data._id);
                delete data._id;
                return m_db.collection('user').update({ _id: id }, data)
            })
            .then(() => {
                // socket.broadcast.emit('usr_changed', '');
                io.emit('usr_changed', '');
            })
            .catch(err => {
                // console.log(err)
                socket.emit('need_login_first', '');
            })
    });
    socket.on('get_usrs', (data, cb) => {
        util.verify_usr(data)
            .then(usr => {
                return m_db.collection('user').find({}).toArray()
            })
            .then(usrs => {
                // console.log(orders)
                cb({ ret: 0, usrs })
            })
            .catch(err => {
                cb({ ret: -1, msg:err })
            })
    });
}

module.exports = {
    reg_user_dealer
}
