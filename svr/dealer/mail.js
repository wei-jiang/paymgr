
const nodemailer = require('nodemailer');
const moment = require('moment');
const _ = require('lodash');
const evt = require("./common/evt");
const credential = require('../secret')


const transporter = nodemailer.createTransport({
    host: credential.mail_host,
    port: 465,
    secure: true, // upgrade later with STARTTLS
    auth: {
        user: credential.mail_usr,
        pass: credential.mail_pass
    }
});
class Mail {
	constructor() {
        _.bindAll(this, ['send']);
		evt.on('mail_send', this.send);
    }
    send(subject, html){
        // setup email data with unicode symbols
        const mailOptions = {
            from: `"freego支付平台" <${credential.mail_usr}>`, // sender address
            to: credential.receivers, // list of receivers
            subject: subject, // Subject line
            // text: text, // plain text body
            html: html // html body
        };
        // send mail with defined transport object
        try{
            const info = await transporter.sendMail(mailOptions);
            winston.info(`发送邮件成功, to: ${credential.receivers}; subject: ${subject}`);
        } catch(err){
            winston.error('发送邮件失败', err);
        }

    }
}


module.exports = new Mail();
