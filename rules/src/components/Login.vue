<template>
    <div>
        <div>
            this is login page            
        </div>
        <button @click="login">登录</button>
    </div>     
</template>

<script>
import QRious from "qrious";
import net from "../net";
import util from "../common/util";

export default {
  name: "LoginPage",

  data() {
    return {
      mchs: [
        {
          name: "蔡伦竹海",
          wx_id: "123423414124",
          aly_id: "9989887776767"
        }
      ]
    };
  },
  computed: {
    mp_nickname() {
      return wi.nickname;
    }
  },
  created: function() {
    this.$root.$on("login_success", data => {
        sessionStorage.setItem('token_id', data.token_id)
        this.$router.replace({ name: 'Home' })
    });
    this.$root.$on("pay_result", data => {
      util.show_noty(`${data.body},价格${data.total_fee}分，支付成功`);
    });
  },
  methods: {
    
    login() {
      this.$root.$emit("login_success", 'aaaaaaaaaa' )
    },
    mod_mch(m) {
      net.emit("mod_mch", m);
    },
    download_token(m) {
      net.emit("req_token", m, token => {
        util.download_text(`${m.name}.txt`, token);
      });
    }
  },
  mounted() {

  }
};
</script>

<style scoped>


</style>