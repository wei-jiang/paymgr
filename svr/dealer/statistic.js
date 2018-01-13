
const _ = require('lodash');
const nunjucks = require('nunjucks');
const moment = require('moment');

const mail = require('./mail');
const tmpl = `
<h2>{{ day }} 销售数据</h2>
<ul>
{% for m in today_income %}
  <li>
    <h3>{{ m.name }}</h3>
    <h4>微信收入：{{m.wx_income}}（元）</h4>
    <h4>支付宝收入：{{m.ali_income}}（元）</h4>
  --------------------------------------------
  </li>
{% endfor %}
</ul>
`
function do_job() {
    let mchs = m_db.collection('merchant').find({}).toArray()
    let today_orders = m_db.collection('orders').find({
        "time_end": {
            $gte: moment({ h: 0, m: 0, s: 0 }).format("YYYY-MM-DD HH:mm:ss"),
            $lt: moment({ h: 23, m: 59, s: 59 }).format("YYYY-MM-DD HH:mm:ss")
        }
    }).toArray()

    Promise.all([mchs, today_orders])
        .then(_.spread((mch, order) => {
            // console.log(mch, order)
            let today_income = _.map(mch, m => {
                let wx_income = _.chain(order)
                    .filter(o => o.sub_mch_id == m.wx_id)
                    .reduce((sum, o) => sum + o.total_fee, 0)
                    .value();
                let ali_income = _.chain(order)
                    .filter(o => o.sub_mch_id == m.aly_id)
                    .reduce((sum, o) => sum + o.total_fee, 0)
                    .value();
                return {
                    name: m.name,
                    wx_income: parseFloat(wx_income / 100).toFixed(2),
                    ali_income: parseFloat(ali_income / 100).toFixed(2)
                }
            })
            // console.log(today_income)
            let day = moment().format("YYYY-MM-DD");
            today_income = nunjucks.renderString(tmpl, {
                day,
                today_income
            });
            // console.log(today_income)
            mail.send(`智慧旅游支付平台(${day})销售通知`, null, today_income)

        }))
}

module.exports = {
    do_job
}
// console.log(moment().format("YYYY-MM-DD HH:mm:ss"))
// console.log(moment({ h: 0, m: 0, s: 0 }).format("YYYY-MM-DD HH:mm:ss"))
// console.log(moment({ h: 23, m: 59, s: 59 }).format("YYYY-MM-DD HH:mm:ss"))