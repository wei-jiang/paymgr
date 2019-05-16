const fs = require('fs');
const jwt = require('jsonwebtoken');
const rs = require("jsrsasign");
const rsu = require("jsrsasign-util");
const crypto = require("crypto");
const util = require('util')
const _ = require('lodash');
const moment = require('moment');
const credential = require('../secret')

const writeFilePromise = util.promisify(fs.writeFile)

class Util {
	constructor() {
		this.delay = util.promisify((d, f) => setTimeout(f, d))
	}
	sign_token(data) {
		return jwt.sign(data, credential.mch_token_key);
	}
	verify_mch_token(token) {
		return new Promise((resolve, reject) => {
			jwt.verify(token, credential.mch_token_key, (err, decoded) => {
				if (err) {
					reject(err)
				} else {
					resolve(decoded);
				}
			});
		})
	}
	verify_req(data, judge) {
		return new Promise((resolve, reject) => {
			if (!data.token || !data.body || !data.total_fee) {
				reject('wrong parameters')
			} else {
				if (judge && !judge(data)) {
					reject('wrong parameters')
				} else {
					jwt.verify(data.token, credential.mch_token_key, (err, decoded) => {
						if (err) {
							reject(err)
						} else {
							resolve(decoded);
						}
					})
				}
			}
		})
	}
	md5(data){
		return crypto.createHash('md5').update(data).digest("hex")
	} 
	sha1(data){
		const shasum = crypto.createHash('sha1');
		shasum.update(data);
		return shasum.digest('hex');
	}
	is_sock(sock) {
		return !!sock.handshake
	}
	get_ip_by_sock(sock) {
		const rip = sock.handshake.headers['x-forwarded-for'] || '127.0.0.1';
		//console.log(rip);
		return rip;
	}
	get_ip_by_req(req) {
		let cli_ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress || '127.0.0.1';
		cli_ip = Array.isArray(cli_ip) ? cli_ip[0] : cli_ip;
		if (cli_ip.indexOf(',') > 0) {
			cli_ip = cli_ip.substring(0, cli_ip.indexOf(','));
		}
		return cli_ip;
	}
	get_myurl_by_req(req) {
		//depend on nginx config
		let host = req.headers['host'];
		let proto = req.headers['x-forwarded-proto'] || 'http';
		let port = req.headers['x-forwarded-port'];
		let url = `${proto}://${host}`
		if (port) url = url + `:${port}`
		// console.log(req.headers);
		// console.log(url);
		return url;
	}
	get_myurl_by_sock(sock) {
		//depend on nginx config
		let host = sock.handshake.headers['host'];
		let proto = sock.handshake.headers['x-forwarded-proto'] || 'http';
		let port = sock.handshake.headers['x-forwarded-port'];
		let url = `${proto}://${host}`
		if (port) url = url + `:${port}`
		// console.log(sock.handshake.headers);
		// console.log(url);
		return url;
	}
	// for submit to bank
	pem2raw(pem) {
		pem = pem.trim();
		let raw_key = pem.split(/\r?\n/)
		// console.log(raw_key)
		raw_key.shift();
		raw_key.pop();
		// console.log(raw_key)
		raw_key = raw_key.join('');
		// console.log(raw_key)
		return raw_key;
	}
	raw2pkcs8pem_pub(raw) {
		const pkcs8pem = `-----BEGIN PUBLIC KEY-----\n${raw.match(/.{1,64}/g).join('')}\n-----END PUBLIC KEY-----`;
		return pkcs8pem
	}
	raw2pkcs8pem_pri(raw) {
		const pkcs8pem = `-----BEGIN PRIVATE KEY-----\n${raw.match(/.{1,64}/g).join('')}\n-----END PRIVATE KEY-----`;
		return pkcs8pem
	}
	raw2pkcs1pem_pri(raw) {
		const pkcs1pem = `-----BEGIN RSA PRIVATE KEY-----\n${raw.match(/.{1,64}/g).join('')}\n-----END RSA PRIVATE KEY-----`;
		return pkcs1pem
	}
	gen_rsa(bits) {
		const key = rs.KEYUTIL.generateKeypair("RSA", bits || 2048);
		const pub_pkcs8 = rs.KEYUTIL.getPEM(key.pubKeyObj)
		// "PKCS1PRV", "PKCS5PRV" or "PKCS8PRV"
		const pri_pkcs8 = rs.KEYUTIL.getPEM(key.prvKeyObj, "PKCS8PRV")
		const pri_pkcs1 = rs.KEYUTIL.getPEM(key.prvKeyObj, "PKCS1PRV")
		return {
			pub_pkcs8,
			pri_pkcs8,
			pri_pkcs1
		}
	}
	gen_keys(bits) {
		const key_dir = 'keys';
		if (!fs.existsSync(key_dir)) {
			fs.mkdirSync(key_dir);
		}
		const keys = this.gen_rsa(bits);
		const pri_pem = writeFilePromise(`./${key_dir}/private_key_pkcs8.pem`, keys.pri_pkcs8)
		const pub_pem = writeFilePromise(`./${key_dir}/public_key_pkcs8.pem`, keys.pub_pkcs8)
		const pri_raw = writeFilePromise(`./${key_dir}/pri_key_pkcs8_raw.txt`, this.pem2raw(keys.pri_pkcs8))
		const pub_raw = writeFilePromise(`./${key_dir}/pub_key_pkcs8_raw.txt`, this.pem2raw(keys.pub_pkcs8))
		Promise.all([
			pri_pem, pub_pem, 
			pri_raw, pub_raw
		]).then( (values)=> {
			console.log('新生成的密钥对已保存至keys文件夹');
		});
	}
	rsa1_sign(prvKeyPEM, data) {
		const sig = new rs.KJUR.crypto.Signature({ "alg": "SHA1withRSA" });
		sig.init(prvKeyPEM);
		sig.updateString(data);
		const hSigVal = sig.sign();
		return hSigVal;
	}
	rsa2_sign(prvKeyPEM, data) {
		const sig = new rs.KJUR.crypto.Signature({ "alg": "SHA256withRSA" });
		sig.init(prvKeyPEM);
		sig.updateString(data);
		const hSigVal = sig.sign();
		return hSigVal;
	}
	hmacsha256(source, key) {
		return crypto.createHmac("sha256", key).update(source, 'utf8').digest("hex").toUpperCase();
	}
	// sign is in hex format
	rsa1_verify(pubkey, data, sign) {
		const sig = new rs.KJUR.crypto.Signature({ "alg": "SHA1withRSA" });
		sig.init(pubkey);
		sig.updateString(data);
		const is_valid = sig.verify(sign);
		return is_valid;
	}
	rsa2_verify(pubkey, data, sign) {
		const sig = new rs.KJUR.crypto.Signature({ "alg": "SHA256withRSA" });
		sig.init(pubkey);
		sig.updateString(data);
		const is_valid = sig.verify(sign);
		return is_valid;
	}

	generateNonceString(length) {
		const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
		const maxPos = chars.length;
		let noceStr = "";
		for (let i = 0; i < (length || 32); i++) {
			noceStr += chars.charAt(Math.floor(Math.random() * maxPos));
		}
		return noceStr;
	}
}

module.exports = new Util;