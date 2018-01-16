<template>
    <div>
        this is order page
        <v-btn color="info" @click="dn_csv">下载微信对账单</v-btn>
    </div>     
</template>

<script>
import QRious from "qrious";
import downloadCsv from 'download-csv';
import { creatCsvFile, downloadFile, detectionClientType } from 'download-csv';
import net from "../net";
import util from "../common/util";

export default {
  name: "OrderPage",
  beforeRouteEnter(to, from, next) {
    sessionStorage.getItem("usr_token") ? next() : next("/login");
  },
  data() {
    return {
      usr_token: ''
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
      net.emit_with_usr_token("dl_wx_bill", {
        sub_mch_id:'1496133062',
        bill_date:'20180115'
      }, res => {
        if (res.ret == 0) {
          util.download_csv('aaa.csv', res.data )
        } else {
          this.to_login()
        }
      });
    }
    
  },
  mounted() {

  }
};
</script>

<style scoped>


</style>