<template>
  <buy data-page="true">
    <header class="header-bar">
      <div class="left">
        <button class="btn pull-left icon icon-arrow-back" data-navigation="$previous-page"></button>        
      </div>
      <div class="center">
        <h1 class="title">{{sel_mch}}商品</h1>
      </div>
    </header>

    <div class="content">
      <ul class="list">
        <li class="input-wrapper padded-list">
            <div style="margin-right:5px;color:purple;">商品名称:</div>
            <input type="text" v-model="product_name" placeholder="名称">
        </li>
        <li class="input-wrapper padded-list">
            <div style="margin-right:5px;color:green;">售价:</div>
            <input type="number" v-model="price" onclick="this.select()">
            <div>（分）</div>
        </li>
        <li class="input-wrapper padded-list">
            <div style="margin-right:5px;color:gold;">购买数量:</div>
            <input type="number" v-model="count" onclick="this.select()">
        </li>
        <li>
          <button class="btn primary fit-parent"  @click.prevent="onBuy">购买</button>
          <!-- <button class="btn error fit-parent"  @click.prevent="test">test</button> -->
        </li>        
        <li class="divider" v-if="!empty_orders">历史订单</li>
        <li v-if="!empty_orders">
          <ul class="list" v-for="o in orders">
            <li class="input-wrapper padded-list" style="background-color:Aquamarine;">
                <div style="margin-right:5px;color:orange;">购买日期:</div>
                <div>{{o.dt}}</div>
            </li>
            <li class="input-wrapper padded-list">
                <div style="margin-right:5px;color:purple;">商品名称:</div>
                <div>{{o.product_name}}</div>
            </li>
            <li class="input-wrapper padded-list">
                <div style="margin-right:5px;">单价:</div>
                <div>{{parseFloat(o.price / 100).toFixed(2)}}(元)</div>
            </li>
            <li class="input-wrapper padded-list">
                <div style="margin-right:5px;">数量:</div>
                <div>{{o.count}}</div>
            </li>
            <li class="input-wrapper padded-list">
                <div style="margin-right:5px;">总价:</div>
                <div>{{parseFloat(o.total_fee / 100).toFixed(2)}}(元)</div>
            </li>
            <li class="input-wrapper padded-list">
                <div style="margin-right:5px;">状态:</div>
                <div>{{o.state}}</div>
            </li>
            <li class="input-wrapper padded-list" style="background-color:Thistle;">
                <div style="margin-right:5px;">可使用:</div>
                <div v-bind:style="{color: o.valid_count==0?'red':'green'}">{{o.valid_count}}（次）</div>
            </li>
            <li class="padded-list" v-if="o.valid_count > 0">
              <ul class="list">
                <li class="divider">可控设备</li>
                <li class="input-wrapper padded-list">
                  <div style="margin-right:5px;">游客中心二楼3号闸机</div>
                  <button class="btn primary" @click="use_it(o,'确认开闸吗？','请至闸机处再开闸通行', '开闸成功，请通行！')">开闸</button>
                </li>
                <li class="input-wrapper padded-list">
                  <div style="margin-right:5px;">游客中心一楼门口左侧2号咖啡机</div>
                  <button class="btn primary" @click="use_it(o,'确认使用吗？','请拿纸杯至咖啡机处接取使用', '打开咖啡机成功，请接取享用！')">使用</button>
                </li>
                <li class="input-wrapper padded-list">
                  <div style="margin-right:5px;">三楼单人渡江索道</div>
                  <button class="btn primary" @click="use_it(o,'确认使用吗？','请至三楼5号胶囊舱外使用', '打开舱门成功，请进入！')">开门</button>
                </li>
              </ul>
            </li>
            
          </ul>
        </li>
      </ul>
    </div>
  </buy>
</template>

<script>
import Vue from "vue"
import _ from "lodash"
import moment from'moment'
import net from "../net"
import adb from "../db"
import util from "../common/util"
import def from "../common/def"
// Directive to use tap events with VueJS
Vue.directive("tap", {
  isFn: true, // important!
  bind: function(el, bindings) {
    el.on("tap", bindings.value);
  }
});

export default {
  name: "PhononBuy",
  props: {
    app: {
      type: Object,
      require: true
    }
  },
  created: function() {
    this.$root.$on("pay_result", data => {
      //from server notify
      // util.show_noty(`${data.body},价格${data.total_fee}分，支付成功`);
    });
  },
  data() {
    return {
      sel_mch: "",
      product_name: "入园门票",
      price: 1,
      count: 1,
      orders: []
    };
  },
  computed: {
    empty_orders() {
      return _.size(this.orders) == 0
    }
  },
  mounted() {
    /*
     * Phonon also supports objects
     * With VueJS, it is better to use "this"
     * instead of a callable function like other examples
     * If Phonon finds page events, it will call them
     * here we want to use onClose, onHidden and onHashChanged methods
     */
    this.app.on({ page: "buy", preventClose: true }, this);
  },

  methods: {
    use_it(o, title, text, after_text){
      let confirm = phonon.confirm(text, title, true, '确认', '取消');
      confirm.on('confirm', ()=> {
        phonon.alert(after_text, '操作成功')
        adb.then(db => {
          --o.valid_count;
          db.orders.findAndUpdate(
            {
              $loki: o.$loki
            },
            obj => o
          );

          this.find_orders();
        });
      });
      confirm.on('cancel', ()=> {} );
    },
    find_orders(){
      (async () => {
          try{
            const db = await adb
            this.orders = db.orders.find({mch_name: this.sel_mch});
          } catch (err) {

          }
          return "done"
      })()      
    },
    onClose(self) {
      self.close();
    },

    onHidden() {},

    onHashChanged(sel_mch) {
      this.sel_mch = _.isArray(sel_mch) ? sel_mch[0] : sel_mch;
      this.sel_mch = decodeURIComponent(this.sel_mch);
      this.find_orders()
    },
    test(){
      adb.then(db => {
        db.orders.insert({
          mch_name: this.sel_mch,
          out_trade_no: '111111',
          product_name: '测试商品',
          total_fee: 1,
          openid: 'data.openid',
          price: 1,
          count: 1,
          valid_count: 1,
          dt: moment().format("YYYY-MM-DD HH:mm:ss"),
          state: '支付成功'
        });
        this.find_orders()
      });
    },
    onBuy(event) {
      let mch = _.find(mchs, m => m.name == this.sel_mch);
      let total_fee = parseInt(this.price * this.count);
      total_fee = total_fee > 0 ? total_fee : 0;
      if (usr_info.pay_type & def.PAY_TYPE.WX) {
        let data = {
          out_trade_no: new Date().getTime().toString(),
          body: this.product_name,
          total_fee,
          openid: usr_info.usr_id,
          token: mch.token
        };
        // console.log(data);
        net.emit("wx_js_prepay_id", data, res => {
          // console.log(res);
          if (res.ret == 0) {
            WeixinJSBridge.invoke("getBrandWCPayRequest", res.prepay, resp => {
              if (resp.err_msg == "get_brand_wcpay_request:ok") {
                // 此处可以使用此方式判断前端返回,微信团队郑重提示：res.err_msg 将在用户支付成功后返回ok，但并不保证它绝对可靠，。
                phonon.alert(
                  `购买(${this.product_name})成功，数量:${
                    this.count
                  }，总价:${parseFloat(total_fee / 100).toFixed(2)}(元)`,
                  "支付成功"
                );
                adb.then(db => {
                  db.orders.insert({
                    mch_name: this.sel_mch,
                    out_trade_no: data.out_trade_no,
                    product_name: this.product_name,
                    total_fee: data.total_fee,
                    openid: data.openid,
                    price: this.price,
                    count: this.count,
                    valid_count: this.count,
                    dt: moment().format("YYYY-MM-DD HH:mm:ss"),
                    state: '支付成功'
                  });
                  this.find_orders()
                });
              } else {
                phonon.alert(resp.err_msg, "购买失败");
              }
            });
          } else {
            let reason = res.msg || "未知";
            util.show_noty(`购买失败，原因：${reason}`);
          }
        });
      } else {
        //ali here
        let data = {
          out_trade_no: new Date().getTime().toString(),
          body: this.product_name,
          total_fee,
          token: mch.token
        };
        const q_str = $.param(data)
        const pay_url = `/ali_wap_pay?${q_str}`
        window.location.href = pay_url
      }
    }
  }
};
</script>
<style scoped>
input {
  flex: 1;
}
/* input[type="number"]{
  flex:1;
} */
.input-wrapper {
  display: flex;
  flex-direction: row;
}
.input-wrapper > button {
  margin-left: auto;
}
</style>