
const request = require('request-promise-native')
const moment = require('moment');
const qs = require('querystring').stringify;
const util = require('../common/util');
const cfg = require('../secret');

const SIGNTYPE = "RSA2";
const CHARSET = "UTF-8";
const GATEWAY = "https://openapi.alipay.com/gateway.do";
// const notify_url = "https://pay.cninone.com/ali_notify"
// const return_url = "https://pay.cninone.com/ali_result"
class Ali {
	constructor() {
		if (cfg.ali_app_PRIVATE_KEY.indexOf('PRIVATE KEY') < 0) {
			cfg.ali_app_PRIVATE_KEY = util.raw2pkcs8pem_pri(cfg.ali_app_PRIVATE_KEY);
		}
		if (cfg.ali_app_PUBLIC_KEY && cfg.ali_app_PUBLIC_KEY.indexOf('PUBLIC KEY') < 0) {
			cfg.ali_app_PUBLIC_KEY = util.raw2pkcs8pem_pub(cfg.ali_app_PUBLIC_KEY);
		}
		if (cfg.ali_PUBLIC_KEY.indexOf('PUBLIC KEY') < 0) {
			cfg.ali_PUBLIC_KEY = util.raw2pkcs8pem_pub(cfg.ali_PUBLIC_KEY);
		}
	}
	//object to querystring
	querystring(data) {
		const qs = Object.keys(data)
			.filter(key => {
				return data[key] !== undefined && data[key] !== '' && ['pfx', 'sign', 'key'].indexOf(key) < 0;
			})
			.sort()
			.map(key => `${key}=${data[key]}`).join("&")
		return qs;
	}
	rsa_sign(data) {
		const qs = this.querystring(data)
		// console.log(qs)
		const hex_sign = util.rsa2_sign(cfg.ali_app_PRIVATE_KEY, qs);
		//阿里的sign还要转为base64格式
		data.sign = Buffer.from(hex_sign, 'hex').toString('base64')
		return data;
	}
	sign(data) {
		this.rsa_sign(data);
	}
	ret_data_str(ret_data) {
		for (let key in ret_data) {
			if (ret_data.hasOwnProperty(key) && /_response/.test(key)) {
				return JSON.stringify(ret_data[key])
			}
		}
	}
	verify_ret_rsa2(ret_data) {
		const sign = Buffer.from(ret_data.sign, 'base64').toString('hex');
		const data = this.ret_data_str(ret_data)
		// console.log('待验签数据=' + data)
		return util.rsa2_verify(cfg.ali_PUBLIC_KEY, data, sign)
	}
	verify_notify_rsa2(data) {
		const sign = Buffer.from(data.sign, 'base64').toString('hex');
		const qs = Object.keys(data)
			.filter(key => data[key] !== '' && ['sign_type', 'sign'].indexOf(key) < 0)
			.sort()
			.map(key => `${key}=${data[key]}`).join("&")
		return util.rsa2_verify(cfg.ali_PUBLIC_KEY, qs, sign);
	}
	async get_uid(code) {
		const data = {
			app_id: cfg.ali_APP_ID,
			method: "alipay.system.oauth.token",
			charset: CHARSET,
			sign_type: SIGNTYPE,
			timestamp: moment().format("YYYY-MM-DD HH:mm:ss"),
			version: '1.0',
			grant_type: "authorization_code",
			code
		}
		this.sign(data);
		const url = `${GATEWAY}?${qs(data)}`;
		// console.log(url);
		let res = await request({ url, method: 'POST' });
		res = JSON.parse(res);
		// if( this.verify_ret_rsa2(res) ){
		// 	console.log('验签成功');
		// } else{
		// 	console.log('验签失败');
		// }
		return res.alipay_system_oauth_token_response;
	}
	async get_uinfo(code) {
		const rd = await this.get_uid(code);
		const data = {
			app_id: cfg.ali_APP_ID,
			method: "alipay.user.info.share",
			charset: CHARSET,
			sign_type: SIGNTYPE,
			timestamp: moment().format("YYYY-MM-DD HH:mm:ss"),
			version: '1.0',
			grant_type: "authorization_code",
			code,
			auth_token: rd.access_token
		}
		this.sign(data);
		const url = `${GATEWAY}?${qs(data)}`;
		let res = await request({ url, method: 'POST' });
		res = JSON.parse(res);
		// if( this.verify_ret_rsa2(res) ){
		// 	console.log('验签成功');
		// } else{
		// 	console.log('验签失败');
		// }
		console.log(res);
		return res.alipay_user_info_share_response;
	}
	async trade_precreate (data) {
		const fd = {
			app_id: cfg.ali_APP_ID,
			method: "alipay.trade.precreate",
			charset: CHARSET,
			sign_type: SIGNTYPE,
			timestamp: moment().format("YYYY-MM-DD HH:mm:ss"),
			version: '1.0'
		}		
		data = Object.assign(fd, data);		
		this.sign(data);
		const url = `${GATEWAY}?${qs(data)}`;
		let res = await request({ url, method: 'POST' });
		res = JSON.parse(res);
		// if( this.verify_ret_rsa2(res) ){
		// 	console.log('验签成功');
		// } else{
		// 	console.log('验签失败');
		// }
		// console.log(res);
		return res.alipay_trade_precreate_response;
	}
}

module.exports = new Ali();