
const _ = require('lodash');
const nunjucks = require('nunjucks');
const moment = require('moment');

const mail = require('./mail');
const tmpl = `
<h2>{{ day }} 销售数据</h2>
<ul>
{% for it0 in today_income %}
    {% for k0,v0 in it0 %}
    <li>
        <h3>{{ k0 }}</h3>
        {% for it1 in v0 %}
            {% for k1,v1 in it1 %}
                <h4>{{ k1 }}</h4>
                {% for it2 in v1 %}
                    {% for k2,v2 in it2 %}
                        <h5>{{ k2 }}:{{v2}}(元)</h5>
                    {% endfor %}
                {% endfor %} 
            {% endfor %}  
        {% endfor %}    
    </li>
    --------------------------------------------
    {% endfor %}
{% endfor %}    
</ul>
<h3>总计：</h3>
{% for t0 in total %}
    {% for k0,v0 in t0 %}
        <h4>{{ k0 }}:{{v0}}(元)</h4>
    {% endfor %}
{% endfor %} 
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
            let today_income = _.chain(mch)
                    .map(m => {
                        return {
                            [m.name]:_.chain(order)
                            .filter(o => o.sub_mch_id == m.wx_id || o.sub_mch_id == m.aly_id)
                            .groupBy("sub_mch_id")
                            .map((v0, k0) => {
                                return {
                                        [
                                            k0 == m.wx_id ? '微信':'支付宝'
                                        ] 
                                        : _.chain(v0)
                                        .groupBy("state")
                                        .map( (v1, k1) => 
                                            ({
                                                [k1]: parseFloat(_.reduce(v1, (sum, o) => sum + o.total_fee, 0)/100).toFixed(2)
                                            })
                                        )
                                        .value()
                                }
                            })
                            .value()
                        } 
                    })
                    .filter(it=>_.size( _.flattenDeep(_.values(it) ) ) > 0)
                    .value()
                const total = _.chain(order)  
                .groupBy("state")
                .map( (v1, k1) => 
                    ({
                        [k1]: parseFloat(_.reduce(v1, (sum, o) => sum + o.total_fee, 0)/100).toFixed(2)
                    })
                )
                .value()
                if(_.size(total) > 0 ){
                    let day = moment().format("YYYY-MM-DD");
                    today_income = nunjucks.renderString(tmpl, { 
                        day,
                        today_income,
                        total
                    });
                    mail.send(`智慧旅游支付平台(${day})销售通知`, null, today_income)
                }                
        }))
}

module.exports = {
    do_job
}
// console.log(moment().format("YYYY-MM-DD HH:mm:ss"))
// console.log(moment({ h: 0, m: 0, s: 0 }).format("YYYY-MM-DD HH:mm:ss"))
// console.log(moment({ h: 23, m: 59, s: 59 }).format("YYYY-MM-DD HH:mm:ss"))