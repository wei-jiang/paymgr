const jwt = require('jsonwebtoken');
const credential = require('../secret')

function get_ip_by_sock(sock) {
    let rip = sock.handshake.headers['x-forwarded-for'];
    //console.log(rip);
    return rip;
}
function get_ip_by_req(req) {
    let cli_ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    cli_ip = Array.isArray(cli_ip) ? cli_ip[0] : cli_ip;
    if (cli_ip.indexOf(',') > 0) {
        cli_ip = cli_ip.substring(0, cli_ip.indexOf(','));
    }
    return cli_ip;
}
let get_myurl_by_req = (req) => {
    //depend on nginx config
    let host = req.headers['host'];
    let proto = req.headers['x-forwarded-proto'] || 'http';
    let port = req.headers['x-forwarded-port'];
    let url = `${proto}://${host}`
    if(port) url = url + `:${port}`
    // console.log(req.headers);
    // console.log(url);
    return url;
}
let get_myurl_by_sock = (sock) => {
    //depend on nginx config
    let host = sock.handshake.headers['host'];
    let proto = sock.handshake.headers['x-forwarded-proto'] || 'http';
    let port = sock.handshake.headers['x-forwarded-port'];
    let url = `${proto}://${host}`
    if(port) url = url + `:${port}`
    // console.log(sock.handshake.headers);
    // console.log(url);
    return url;
}
function sign_token_1h(data) {
    return jwt.sign(data, credential.token_key, { expiresIn: '1h' });
}
function sign_token(data) {
    return jwt.sign(data, credential.token_key);
}
function verify_token(token, cb) {
    jwt.verify(token, credential.token_key, cb);
}
function verify_req(data) {
    return new Promise((resolve, reject) => {
        if (!data.token || !data.body || !data.total_fee) {
            reject('wrong parameters')
        } else {
            verify_token(data.token, (err, decoded) => {
                if (err) {
                    reject(err)
                } else {
                    resolve(decoded);
                }
            })
        }
    })
}
module.exports = {
    get_ip_by_sock,
    get_ip_by_req,
    get_myurl_by_req,
    get_myurl_by_sock,
    sign_token,
    sign_token_1h,
    verify_token,
    verify_req
}