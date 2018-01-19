<template>
    <div>
      <v-toolbar>
        <!-- <v-toolbar-title>商户</v-toolbar-title> -->
        <v-select
          v-bind:items="mch_names"
          v-model="sel_mch"
          label="商户"
          single-line
          bottom
        ></v-select>
        <input v-model="sel_date" type="date" placeholder="订单日期" />
        <v-spacer></v-spacer>
        <v-toolbar-items class="hidden-sm-and-down">
          <v-btn flat @click="find_orders"><v-icon>search</v-icon>查找</v-btn>
          <v-btn color="primary" @click="dn_csv">下载微信对账单</v-btn>
        </v-toolbar-items>
      </v-toolbar>
      <v-layout row style="background-color:#777">
        <div style="width:200px;">订单号</div>
        <div style="width:300px;">名称</div>
        <div style="width:100px;">价格</div>
        <div style="width:200px;">支付类型</div>
        <div style="width:100px;">状态</div>
      </v-layout>
      <v-layout row v-for="o in orders" style="border:1px dashed purple">
        <div style="width:200px;">{{o.out_trade_no}}</div>
        <div style="width:300px;">{{o.body}}</div>
        <div style="width:100px;">{{parseFloat(o.total_fee/100).toFixed(2)+'(元)'}}</div>
        <div style="width:200px;">{{o.trade_type}}</div>
        <div style="width:100px;">{{o.state}}</div>
        <v-btn color="info" @click="query_order(o)">查询</v-btn>
        <v-btn v-if="o.state==='已支付'" color="warning" @click="reverse_order(o)">撤销</v-btn>
        <v-btn v-if="o.state==='已支付'" color="error" @click="refund(o)">退款</v-btn>
      </v-layout>
      
    </div>     
</template>

<script>
import QRious from "qrious"
import _ from 'lodash'
import moment from 'moment'
import net from "../net"
import util from "../common/util";

export default {
  name: "OrderPage",
  beforeRouteEnter(to, from, next) {
    sessionStorage.getItem("usr_token") ? next() : next("/login");
  },
  data() {
    return {
      mchs:[],
      orders:[],
      sel_mch:'',
      sel_date: ''
    };
  },
  computed: {
    mch_names() {
      return _.map(this.mchs, m=>m.name)
    }
  },
  created: function() {
    this.$root.$on("login_success", usr_token => {

    });
  },
  methods: {    
    query_order(o){
      if( o.trade_type.indexOf("微信") >= 0 ){
        net.emit_with_usr_token( "wx_order_query", {
                sub_mch_id: o.sub_mch_id,
                out_trade_no: o.out_trade_no
            },  res => {
            if (res.ret == 0) {
              console.log(`查询微信订单成功`,res)
              util.show_noty(`${res.msg}`);
            } else {
              util.show_noty(`查询微信订单失败：${res.msg}`);
            }
          }
        );
      } else {
        //ali order
        net.emit_with_usr_token( "ali_order_query", {
                out_trade_no: o.out_trade_no
            },  res => {
            if (res.ret == 0) {
              console.log(`查询支付宝订单成功`,res)
              util.show_noty(`${res.msg}`);
            } else {
              console.log(`查询支付宝订单失败`,res)
              util.show_noty(`查询支付宝订单失败：${res.msg}`);
            }
          }
        );
      }
    },
    reverse_order(o){
      if( o.trade_type.indexOf("微信") >= 0 ){
        net.emit_with_usr_token( "wx_reverse", {
                sub_mch_id: o.sub_mch_id,
                out_trade_no: o.out_trade_no
            },  res => {
            if (res.ret == 0) {
              console.log(`撤销微信订单成功`,res)
              util.show_noty(`${res.msg}`);
            } else {
              console.log(`撤销微信订单失败`,res)
              util.show_noty(`撤销微信订单失败：${res.msg}`);
            }
          }
        );
      } else {
        //ali order
        net.emit_with_usr_token( "ali_reverse", {
                out_trade_no: o.out_trade_no
            },  res => {
            if (res.ret == 0) {
              console.log(`撤销支付宝订单成功`,res)
              util.show_noty(`${res.msg}`);
            } else {
              console.log(`撤销支付宝订单失败`,res)
              util.show_noty(`撤销支付宝订单失败：${res.msg}`);
            }
          }
        );
      }
    },
    refund(o){
      if( o.trade_type.indexOf("微信") >= 0 ){
        net.emit_with_usr_token( "wx_refund", {
                sub_mch_id: o.sub_mch_id,
                out_trade_no: o.out_trade_no,
                out_refund_no: moment().format("wx_refund_YYYYMMDDHHmmssSSS"),
                total_fee: o.total_fee,
                refund_fee: o.total_fee
            },  res => {
            if (res.ret == 0) {
              console.log(`微信订单退款成功`,res)
              util.show_noty(`${res.msg}`);
            } else {
              console.log(`微信订单退款失败`,res)
              util.show_noty(`微信订单退款失败：${res.msg}`);
            }
          }
        );
      } else {
        //ali order
        net.emit_with_usr_token( "ali_refund", {
                out_trade_no: o.out_trade_no,
                refund_amount: o.total_fee,
                refund_reason: '正常退款',
                store_id: 'cs001'
            },  res => {
            if (res.ret == 0) {
              console.log(`支付宝订单退款成功`,res)
              util.show_noty(`${res.msg}`);
            } else {
              console.log(`支付宝订单退款失败`,res)
              util.show_noty(`支付宝订单退款失败：${res.msg}`);
            }
          }
        );
      }
    },
    to_login(){
      this.$router.replace({ name: 'Login' })
      util.show_noty(`您尚未登陆，请登录后操作`);
    },
    dn_csv() {
      if(!this.sel_mch) return util.show_noty(`请选择商户`);
      if(!this.sel_date) return util.show_noty(`请选择日期`);
      const mch = _.find(this.mchs, m=>m.name == this.sel_mch)
      net.emit_with_usr_token("dl_wx_bill", {
        sub_mch_id: mch.wx_id,
        bill_date: moment(this.sel_date).format('YYYYMMDD')
      }, res => {
        if (res.ret == 0) {
          // console.log(res)
          // window.open(res.to_url)
          //below all valid
          util.download_csv(`wxpay_${this.sel_date}.csv`, res.data)
          // util.download_csv1(`wxpay_${this.sel_date}.csv`, res.data)
          util.download_url(res.to_url)
        } else {
          util.show_noty(`下载微信对账单失败：${res.msg}`);
        }
      });
    },
    get_mchs() {
      net.emit_with_usr_token( "get_mchs", '',  res => {
          if (res.ret == 0) {
            this.mchs = res.mchs;
          } else {
            util.show_noty(`获取商户失败：${res.msg}`);
          }
        }
      );
    },
    find_orders(){
      net.emit_with_usr_token( "find_orders", '',  res => {
          if (res.ret == 0) {
            this.orders = res.orders;
          } else {
            util.show_noty(`查询失败：${res.msg}`);
          }
        }
      );
    }
  },
  mounted() {
    this.get_mchs()
    this.sel_date = moment().add(-1, 'days').format("YYYY-MM-DD")
  }
};
</script>

<style scoped>
input[type="date"]:after {
  content: attr(placeholder);
}

</style>