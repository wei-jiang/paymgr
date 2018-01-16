<template>
    <div>
        <div>
            <v-text-field
              label="用户密钥"
              v-model="usr_token"
              multi-line
            ></v-text-field>           
        </div>
        <v-btn color="info" v-if="usr_token" @click="login">登录</v-btn>
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
      usr_token: ''
    };
  },
  computed: {
    mp_nickname() {
 
    }
  },
  created: function() {
    this.$root.$on("login_success", usr_token => {
        sessionStorage.setItem('usr_token', usr_token)
        this.$router.replace({ name: 'Home' })
    });
  },
  methods: {    
    login() {
      if(this.usr_token){
        net.emit("verify_user", this.usr_token, res => {
          if(res.ret === 0){
            this.$root.$emit("login_success", this.usr_token )
          } else {
            util.show_noty(`登陆失败`);
          }
        })
      } else{
        //read token file here
      }      
    }
  },
  mounted() {

  }
};
</script>

<style scoped>


</style>