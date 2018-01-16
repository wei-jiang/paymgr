<template>
    <div>
        this is order page
        <v-btn color="info" @click="dn_csv">下载微信对账单</v-btn>
    </div>     
</template>

<script>
import QRious from "qrious"

import moment from 'moment'
import net from "../net";
import util from "../common/util";

export default {
  name: "OrderPage",
  beforeRouteEnter(to, from, next) {
    sessionStorage.getItem("usr_token") ? next() : next("/login");
  },
  data() {
    return {
      sel_mch:'',
      sel_date: ''
    };
  },
  computed: {
    mp_nickname() {
 
    }
  },
  created: function() {
    this.$root.$on("login_success", usr_token => {

    });
  },
  methods: {    
    to_login(){
      this.$router.replace({ name: 'Login' })
      util.show_noty(`您尚未登陆，请登录后操作`);
    },
    dn_csv() {
      if(!this.sel_mch) return util.show_noty(`请选择商户`);
      if(!this.sel_date) return util.show_noty(`请选择日期`);
      net.emit_with_usr_token("dl_wx_bill", {
        sub_mch_id:'1496133062',
        bill_date: this.sel_date
      }, res => {
        if (res.ret == 0) {
          // console.log(res)
          // window.open(res.to_url)
          //below all valid
          util.download_csv(`wxpay_${this.sel_date}`, res.data)
          // util.download_csv1('bbb.csv', res.data)
          // util.download_url(res.to_url)
        } else {
          this.to_login()
        }
      });
    }
    
  },
  mounted() {
    this.sel_date = moment().add(-1, 'days').format("YYYY-MM-DD")
  }
};
</script>

<style scoped>


</style>