<template>
    <div>
        <v-text-field
              label="用户名"
              v-model="usr_name"
            ></v-text-field>    
        <div>
            <v-text-field
              label="用户密钥"
              v-model="usr_token"
              multi-line
            ></v-text-field>           
        </div>
        <v-btn color="info" v-if="usr_token && usr_name" @click="login">登录</v-btn>
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
      usr_name: '',
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
      if(this.usr_name && this.usr_token){
        net.emit("verify_user", {name:this.usr_name, token:this.usr_token}, res => {
          if(res.ret === 0){
            this.$root.$emit("login_success", this.usr_token )
          } else {
            util.show_noty(`登陆失败:${ JSON.stringify(res.msg) }`);
          }
        })
      } else{
        //read token file here
        util.show_noty(`请输入用户名和密钥`);
      }      
    }
  },
  mounted() {

  }
};
</script>

<style scoped>


</style>