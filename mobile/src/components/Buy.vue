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
        <button class="btn primary fit-parent"  v-tap="onBuy">购买</button>
      </ul>
    </div>
  </buy>
</template>

<script>
import Vue from "vue";
import _ from "lodash";
import net from "../net";
import util from "../common/util";
import def from "../common/def";
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
      count: 1
    };
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
    onClose(self) {
      self.close();
    },

    onHidden() {},

    onHashChanged(sel_mch) {
      this.sel_mch = _.isArray(sel_mch) ? sel_mch[0] : sel_mch;
      this.sel_mch = decodeURIComponent(this.sel_mch);
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
</style>