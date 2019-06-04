<template>
  <div class="user">
    <div  class="ti" v-if="!token">
      <div class="input">
        <div>联系邮箱:</div>
        <input type="email" placeholder="邮箱" v-model="contact_email">
        <button @click="send_veri_code()" :disabled="!contact_email || cooldown != '发送验证码'">{{cooldown}}</button>
      </div>
      <div class="input">
        <div>验证码&nbsp;&nbsp;:</div>
        <input placeholder="验证码" v-model="veri_code">
        <button @click="login()" v-bind:disabled="!veri_code">登陆</button>
      </div>
    </div>
    <div  class="ti" v-else>
      <div class="input">
        <div>联系邮箱:</div>
        <input type="email" placeholder="邮箱" v-model="usr_info.contact_email">
      </div>
      <div class="input">
        <div>开户银行:</div>
        <input type="email" placeholder="开户银行" v-model="usr_info.account_bank">
      </div>
      <div class="input">
        <div>银行账号:</div>
        <input type="email" placeholder="银行账号" v-model="usr_info.account_number">
      </div>
      <div class="input">
        <div>开户银行省市编码:</div>
        <input type="email" placeholder="开户银行省市编码" v-model="usr_info.bank_address_code">
      </div>
      <div class="input">
        <div>客服电话:</div>
        <input type="email" placeholder="客服电话" v-model="usr_info.contact_phone">
      </div>
      <div class="input">
        <div>商户简称:</div>
        <input type="email" placeholder="商户简称" v-model="usr_info.merchant_shortname">
      </div>
      <div class="input">
        <div>商品/服务描述:</div>
        <div>{{usr_info.product_desc}}</div>
      </div>
      <div class="input">
        <div>门店名称:</div>
        <div>{{usr_info.store_name}}</div>
      </div>
      <div class="input">
        <div>门店街道名称:</div>
        <div>{{usr_info.store_street}}</div>
      </div>

    </div>
  </div>
</template>

<script>
import _ from "lodash";
import moment from "moment";
import QRious from "qrious";
import util from "../common/util";
import ws from "../ws";
export default {
  name: "User",
  props: {
    msg: String
  },
  created: function() {

  },
  mounted() {
    // this.order = this.$route.query;
    this.token = sessionStorage.getItem('token');
    this.get_user_info();
  },
  data() {
    return {
      cooldown: '发送验证码',
      veri_code: '',
      contact_email: '',
      token: '',
      usr_info: {}
    };
  },
  computed: {
    total() {

    }
  },
  methods: {
    send_veri_code(){
      const self = this;
      self.cooldown = '发送中，请稍后……';
      $.ajax({
        type: "POST",
        url: "/send_veri_code_user",
        // timeout: 3000,
        contentType: "application/json; charset=utf-8",
        data: JSON.stringify({
          email: this.contact_email,
        }),
        dataType: "json"
      })
        .done(resp => {
          if(resp.ret == 0){         
            util.show_success_top('发送验证码成功，请在5分钟内输入验证码登陆');
            (function email_cool_down(count){
              setTimeout(()=>{
                if(count > 0){
                  self.cooldown = `(${count})`;
                  email_cool_down(count - 1);
                } else {
                  self.cooldown = '发送验证码';
                }
              }, 1000);              
            })(120);
          } else {
            util.show_error_top('发送验证码失败:' + resp.msg);
            self.cooldown = '发送验证码';
          }
        })
        .fail(err => {
          self.cooldown = '发送验证码';
          util.show_error_top('发送验证码失败:' + err);
          console.log("failed: ", err);
        });
    },
    login(){
      $.ajax({
        type: "POST",
        url: "/micro_user_login",
        // timeout: 3000,
        contentType: "application/json; charset=utf-8",
        data: JSON.stringify({
          email: this.contact_email,
          code: this.veri_code
        }),
        dataType: "json"
      })
        .done(resp => {
          if(resp.ret == 0){
            this.token = resp.token;
            sessionStorage.setItem('token', this.token);
            this.get_user_info();
          } else {
            util.show_error_top('验证码错误，登陆失败!');
          }
        })
        .fail(err => {
          util.show_error_top('验证邮箱失败:' + err);
        });
    },
    get_user_info(){
      if(!this.token) return;
      $.ajax({
        type: "POST",
        url: "/get_user_info",
        // timeout: 3000,
        contentType: "application/json; charset=utf-8",
        data: JSON.stringify({
          token: this.token,
        }),
        dataType: "json"
      })
        .done(resp => {
          if(resp.ret == 0){
            delete resp.ret;
            this.usr_info = resp;
          } else {
            util.show_error_top('获取用户信息失败:'+resp.msg);
          }
        })
        .fail(err => {
          util.show_error_top('获取用户信息失败:' + err);
        });
    }
  }
};
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped>
canvas{
  margin: 0.3em auto;
  width: 200px;
  /* height: 200px; */
}

.ti {
  opacity: .9;
  /* padding: .5em; */
  /* background-color: grey; */
  /* margin: 1.5em .5rem 0; */
  display: flex;
  /* align-items: center; */
  flex-flow: column;
  /* justify-content: space-between;
  flex-wrap: nowrap; */
}
.user {
  display: flex;
  /* justify-content: space-between; */
  flex-flow: column;
  overflow: hidden;
  /* font-weight: 700; */
}

.ti > div{
  color: white;
  margin-top: 1em;
  display: flex;
  flex-wrap: nowrap;
}
input {
  flex: 1;
  margin: 0.1em 1em;
}
.input {
  margin: 1em 1em 0;
  display: flex;
  align-items: center;
}

button {
  font-size: 1.2rem;
  margin: 0.5em .5rem;
  background-color: bisque;
  border-radius: 0.9em;
  color: #42b983;
}
button:disabled {
  background-color: #ccc;
  color: lightslategrey;
}
.caption{
  min-width: 4em;
}

</style>
