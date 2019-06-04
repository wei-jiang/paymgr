<template>
  <div class="test">
    <div class="ti">
      <div>
        <h2>向指定商户付款</h2>
      </div>
      <div class="tooltip">
        <span class="tooltiptext">请填写注册时的【商户简称】</span>
        <div class="caption">商户简称:</div>
        <input placeholder="商户简称:" v-model="mch_name">
      </div>
      <div>
        <div class="caption">商品名称：</div>
        <input placeholder="商品名称:" v-model="body">
      </div>
      <div>
        <div class="caption">价格(分)：</div>
        <input placeholder="价格(分):" v-model="price">
      </div>
    </div>
    <button @click.prevent="req_wx_qr()">扫码支付</button>
    <canvas id="qr"></canvas>
  </div>
</template>

<script>
import _ from "lodash";
import moment from "moment";
import QRious from "qrious";
import util from "../common/util";
import ws from "../ws";
export default {
  name: "Test",
  props: {
    msg: String
  },
  created: function() {
    this.$root.$on("req_wx_qr_by_sn", data => {
      this.requesting = false;
      this.show_qr(data);
    });
    this.$root.$on("pay_success", data => {
      console.log("支付成功", data);
      util.show_success_top(`商品【${data.body}】价格【${data.total_fee}(分)】，支付成功`);
    });
  },
  mounted() {
    // this.order = this.$route.query;
  },
  data() {
    return {
      requesting: false,
      mch_name: "飘云软件",
      body: "测试商品",
      price: '1'
    };
  },
  computed: {
    total() {}
  },
  methods: {
    req_wx_qr() {
      this.requesting = true;
      const data = {
        cmd: "req_wx_qr_by_sn",
        short_name: this.mch_name.trim(),
        total_fee: this.price.trim(),
        body: this.body.trim(),
        cli_id
      };
      console.log("req data = ", data);
      ws.send(data);
    },
    show_qr(data) {
      if (data.ret == 0) {
        const qr = new QRious({
          size: 200,
          background: "#fff",
          foreground: "#284a9f",
          element: document.getElementById("qr"),
          value: data.code_url
        });
        util.show_alert_top_tm("请用微信扫码支付");
      } else {
        util.show_error_top(`请求支付失败：${data.msg}`);
      }
    }
  }
};
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped>
canvas {
  margin: 0.3em auto;
  width: 200px;
  /* height: 200px; */
}
.test {
  display: flex;
  flex-flow: column;
  align-items: center;
}
.ti {
  opacity: 0.9;
  /* padding: 0.5em; */
  /* background-color: grey; */
  /* margin: 1.5em 0.5rem 0; */
  display: flex;
  align-items: center;
  flex-flow: column;
  justify-content: space-between;
  flex-wrap: nowrap;
}
.ticket {
  display: flex;
  /* justify-content: space-between; */
  flex-flow: column;
  overflow: hidden;
  font-weight: 700;
}

.ti > div {
  color: white;
  margin-top: 1em;
  display: flex;
  flex-wrap: nowrap;
}
.ti > div:last-child {
  margin-bottom: 1em;
}

button {
  font-size: 1.2rem;
  margin: 0.5em 0.5rem;
  background-color: bisque;
  border-radius: 0.9em;
  color: #42b983;
}
.caption {
  min-width: 4em;
}
</style>
