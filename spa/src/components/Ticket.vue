<template>
  <div class="ticket">
    <img :src="id_front_img">
    <input id="id_front" type="file" @change="process_file($event, 'id_front')">
    <button class="tooltip" @click="open_img('id_front')">
      身份证正面
      <span class="tooltiptext">请上传身份证人像面照片</span>
    </button>
    <img :src="id_back_img">
    <input id="id_back" type="file" @change="process_file($event, 'id_back')">
    <button class="tooltip" @click="open_img('id_back')">
      身份证背面
      <span class="tooltiptext">请上传身份证国徽面照片</span>
    </button>
    <div class="input tooltip">
      <span class="tooltiptext">请填写小微商户本人身份证上的姓名</span>
      <div>身份证姓名:</div>
      <input placeholder="身份证姓名" v-model="id_card_name">
    </div>
    <div class="input tooltip">
      <span class="tooltiptext">该字段将进行加密处理后 提交到腾讯服务器</span>
      <div>身份证号码:</div>
      <input placeholder="身份证号码" v-model="id_card_number">
    </div>
    <div class="input tooltip">
      <span class="tooltiptext">结束时间不选代表“长期”</span>
      <div>身份证有效期:</div>
      <input type="date" placeholder="开始时间" v-model="id_valid_time_begin">
      <div>到</div>
      <input type="date" placeholder="结束时间" v-model="id_valid_time_end">
    </div>
    <div class="input tooltip">
      <span class="tooltiptext">必须与身份证姓名一致，该字段将进行加密处理后提交到腾讯服务器</span>
      <div>开户名称:</div>
      <input placeholder="开户名称" v-model="account_name">
    </div>
    <div class="input">
      <div>开户银行:</div>
      <select v-model="account_bank">
        <option>中国银行</option>
        <option>农业银行</option>
        <option>建设银行</option>
        <option>工商银行</option>
        <option>交通银行</option>
        <option>招商银行</option>
        <option>民生银行</option>
        <option>中信银行</option>
        <option>浦发银行</option>
        <option>兴业银行</option>
        <option>光大银行</option>
        <option>广发银行</option>
        <option>平安银行</option>
        <option>北京银行</option>
        <option>华夏银行</option>
        <option>邮政储蓄银行</option>
        <option>宁波银行</option>
      </select>
    </div>
    <div class="input tooltip">
      <span class="tooltiptext">须精确到市</span>
      <div>开户银行省市编码:</div>
      <select v-model="sel_bank_province" @change="sel_bank_city=''">
        <option v-for="(v,k) in pro_city_map">{{ k }}</option>
      </select>
      <select v-model="sel_bank_city">
        <option v-for="c in bank_citys">{{ c }}</option>
      </select>
      <!-- bank_address_code -->
    </div>
    <div class="input tooltip">
      <span class="tooltiptext">该字段将进行加密处理后提交到腾讯服务器</span>
      <div>银行账号:</div>
      <input placeholder="银行账号" v-model="account_number">
    </div>
    <div class="input tooltip">
      <span class="tooltiptext">门店场所：填写门店名称; 流动经营/便民服务：填写经营/服务名称; 线上商品/服务交易：填写线上店铺名称</span>
      <div>门店名称:</div>
      <input placeholder="门店名称" v-model="store_name">
    </div>
    <div class="input tooltip">
      <span class="tooltiptext">选择卖家所在地省市编码</span>
      <div>门店省市编码:</div>
      <select v-model="sel_shop_province" @change="sel_shop_city=''">
        <option v-for="(v,k) in pro_city_map">{{ k }}</option>
      </select>
      <select v-model="sel_shop_city">
        <option v-for="c in shop_citys">{{ c }}</option>
      </select>
      <!-- store_address_code -->
    </div>
    <div class="input tooltip">
      <span class="tooltiptext">门店场所：填写店铺详细地址，具体区/县及街道门牌号或大厦楼层; 流动经营/便民服务：填写“无"; 线上商品/服务交易：填写电商平台名称</span>
      <div>门店街道名称:</div>
      <input placeholder="门店街道名称" v-model="store_street">
    </div>
    <img :src="store_entrance_img">
    <input id="store_entrance" type="file" @change="process_file($event, 'store_entrance')">
    <button class="tooltip" @click="open_img('store_entrance')">门店门口照片
      <span class="tooltiptext">门店场所：提交门店门口照片，要求招牌清晰可见; 流动经营/便民服务：提交经营/服务现场照片; 线上商品/服务交易：提交店铺首页截图</span>
    </button>
    <img :src="store_indoor_img">
    <input id="store_indoor" type="file" @change="process_file($event, 'store_indoor')">
    <button class="tooltip" @click="open_img('store_indoor')">店内环境照片
      <span class="tooltiptext">门店场所：提交店内环境照片; 流动经营/便民服务：可提交另一张经营/服务现场照片; 线上商品/服务交易：提交店铺管理后台截图</span>
    </button>
    <div class="input tooltip">
      <span class="tooltiptext">将在支付完成页向买家展示，需与商家的实际经营场景相符</span>
      <div>商户简称:</div>
      <input placeholder="商户简称" v-model="merchant_shortname">
    </div>
    <div class="input tooltip">
      <span class="tooltiptext">在交易记录中向买家展示，请确保电话畅通以便平台回拨确认</span>
      <div>客服电话:</div>
      <input type="tel" placeholder="客服电话" v-model="service_phone">
    </div>
    <div class="input">
      <div>售卖商品/提供服务描述:</div>
      <select v-model="product_desc">
        <option>餐饮</option>
        <option>线下零售</option>
        <option>居民生活服务</option>
        <option>休闲娱乐</option>
        <option>交通出行</option>
        <option>其他</option>
      </select>
    </div>
    <div class="input tooltip">
      <span class="tooltiptext">和身份证姓名一致 ，该字段将进行加密处理</span>
      <div>联系人姓名:</div>
      <input placeholder="联系人姓名" v-model="contact">
    </div>
    <div class="input tooltip">
      <span class="tooltiptext">11位数字，手机号码 ，该字段将进行加密处理</span>
      <div>手机号码:</div>
      <input type="tel" placeholder="手机号码" v-model="contact_phone">
    </div>
    <div class="tooltip">
      <span class="tooltiptext">重要，用于发送申请结果和收款软件下载链接，及登录验证码</span>
      <div class="input">
        <div>联系邮箱:</div>
        <input type="email" placeholder="联系邮箱" v-model="contact_email">
        <button v-if="!email_valid" @click="send_veri_code()" :disabled="!contact_email || cooldown != '发送验证码'">{{cooldown}}</button>
      </div>
      <div class="input" v-if="!email_valid">
        <div>请输入验证码:</div>
        <input placeholder="验证码" v-model="veri_code">
        <button @click="verify_email()" v-bind:disabled="!veri_code">验证邮箱</button>
      </div>
    </div>
    <button @click="reg_micro()">申请入驻</button>
    <canvas id="qr"></canvas>
    <!-- {{ bank_address_code }} -->
    <!-- <button @click="test()">test</button> -->
  </div>
</template>

<script>
import _ from "lodash";
import moment from "moment";
import QRious from "qrious";
import util from "../common/util";
import ws from "../ws";
import { pro_city_code, pro_city_map } from "../common/pro_city_code";
export default {
  name: "Ticket",
  props: {
    msg: String
  },
  created: function() {
    this.$root.$on("req_reg_fee_wx_qr", data => {
      this.requesting = false;
      this.show_qr(data);
    });
    this.$root.$on("pay_success", data => {
      this.show_qr_flag = false;
      // this.$router.push({ path: "user", query: data });
      if(data.type == 'reg_fee'){
        sessionStorage.setItem('token', data.token);
        this.$router.replace('user');
      }
      
    });
  },
  mounted() {},
  data() {
    return {
      show_qr_flag: false,
      requesting: false,
      cooldown: '发送验证码',
      veri_code: '',
      email_valid: false,

      id_front_img: "",
      id_back_img: "",
      id_card_name: "",
      id_card_number: "",
      id_valid_time_begin: "",
      id_valid_time_end: "",
      account_name: "",
      account_bank: "",
      // bank_address_code: "",
      account_number: "",
      store_name: "",
      // store_address_code: "",
      store_street: "",
      store_entrance_img: "",
      store_indoor_img: "",
      merchant_shortname: "",
      service_phone: "",
      product_desc: "",
      contact: "",
      contact_phone: "",
      contact_email: "",
      pro_city_code,
      pro_city_map,
      sel_bank_province: "",
      sel_bank_city: "",
      sel_shop_province: "",
      sel_shop_city: ""
    };
  },
  computed: {
    bank_citys() {
      return this.pro_city_map[this.sel_bank_province];
    },
    shop_citys() {
      return this.pro_city_map[this.sel_shop_province];
    },
    bank_address_code() {
      const city_name = this.sel_bank_city
        ? `${this.sel_bank_province},${this.sel_bank_city}`
        : this.sel_bank_province;
      return this.pro_city_code[city_name];
    },
    store_address_code() {
      const city_name = this.sel_shop_city
        ? `${this.sel_shop_province},${this.sel_shop_city}`
        : this.sel_shop_province;
      return this.pro_city_code[city_name];
    }
  },
  methods: {
    test(){
      const data = {
        cmd: "req_reg_fee_wx_qr",
        _id: '5ce42b1c71dc1f4eb35c9adc',
        cli_id
      };
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
        this.show_qr_flag = true;
        util.show_alert_top_tm("请用微信扫码支付");
      } else {
        util.show_error_top(`请求支付失败：${data.msg}`);
      }
    },
    send_veri_code(){
      const self = this;
      self.cooldown = '发送中，请稍后……';
      $.ajax({
        type: "POST",
        url: "/send_veri_code_new",
        // timeout: 3000,
        contentType: "application/json; charset=utf-8",
        data: JSON.stringify({
          email: this.contact_email,
        }),
        dataType: "json"
      })
        .done(resp => {
          if(resp.ret == 0){         
            util.show_success_top('发送验证码成功，请在5分钟内输入验证码');
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
    verify_email(){
      $.ajax({
        type: "POST",
        url: "/verify_email",
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
            util.show_success_top('验证邮箱成功!');
            this.email_valid = true;
          } else {
            util.show_error_top('验证邮箱失败!');
          }
        })
        .fail(err => {
          util.show_error_top('验证邮箱失败:' + err);
        });
    },
    reg_micro() {
      if (!this.id_front_img)
        return util.show_alert_top_tm("请上传身份证正面照片");
      if (!this.id_back_img)
        return util.show_alert_top_tm("请上传身份证背面照片");
      if (!this.id_card_name) return util.show_alert_top_tm("请填写身份证姓名");
      if (!this.id_card_number) return util.show_alert_top_tm("请填写身份证号");
      if (!this.id_valid_time_begin)
        return util.show_alert_top_tm("请填写身份证起始日期");
      if (!this.account_name) return util.show_alert_top_tm("请填写开户名称");
      if (!this.account_bank) return util.show_alert_top_tm("请选择开户银行");
      if (!this.bank_address_code)
        return util.show_alert_top_tm("请选择开户银行省市编码");
      if (!this.account_number) return util.show_alert_top_tm("请填写银行账号");
      if (!this.store_name) return util.show_alert_top_tm("请填写门店名称");
      if (!this.store_address_code)
        return util.show_alert_top_tm("请选择门店省市编码");
      if (!this.store_street)
        return util.show_alert_top_tm("请填写门店街道名称");
      if (!this.store_entrance_img)
        return util.show_alert_top_tm("请上传门店入口照片");
      if (!this.store_indoor_img)
        return util.show_alert_top_tm("请上传门店室内照片");
      if (!this.merchant_shortname)
        return util.show_alert_top_tm("请填写商户简称");
      if (!this.service_phone) return util.show_alert_top_tm("请填写客服电话");
      if (!this.product_desc)
        return util.show_alert_top_tm("请选择商品/服务描述");
      if (!this.contact) return util.show_alert_top_tm("请填写联系人姓名");
      if (!this.contact_phone) return util.show_alert_top_tm("请填写手机号码");
      if (!this.email_valid) return util.show_alert_top_tm("请验证联系邮箱");
      $.ajax({
        type: "POST",
        url: "/reg_micro_mch",
        // timeout: 3000,
        contentType: "application/json; charset=utf-8",
        data: JSON.stringify({
          id_card_name: this.id_card_name,
          id_card_number: this.id_card_number,
          id_card_valid_time: `["${this.id_valid_time_begin}","${
            this.id_valid_time_end || '长期'
          }"]`,
          account_name: this.account_name,
          account_bank: this.account_bank,
          bank_address_code: this.bank_address_code,
          account_number: this.account_number,
          store_name: this.store_name,
          store_address_code: this.store_address_code,
          store_street: this.store_street,
          merchant_shortname: this.merchant_shortname,
          service_phone: this.service_phone,
          product_desc: this.product_desc,
          contact: this.contact,
          contact_phone: this.contact_phone,
          contact_email: this.contact_email
        }),
        dataType: "json"
      })
        .done(resp => {
          // console.log("success", resp);
          if(resp.ret == 0){
            util.show_success_top(`注册申请成功， 请支付【20】元 费用`)
            const data = {
              cmd: "req_reg_fee_wx_qr",
              _id: resp._id,
              cli_id
            };
            ws.send(data);
          } else {
            util.show_error_top(`注册失败：${resp.msg}`)
          }
        })
        .fail(err => {
          util.show_error_top(`注册失败：${err}`)
          console.log("failed: ", err);
        });
    },
    open_img(name) {
      $(`#${name}`).click();
    },
    process_file(event, name) {
      if (event.target.files.length == 0) return;
      let img_file = event.target.files[0];
      const imageType = /image.*/;
      const reader = new FileReader();
      if (!img_file.type.match(imageType)) {
        return util.show_alert_top_tm("请选择小于2M的图片文件");
      }
      if (img_file.size > 2 * 1024 * 1024) {
        return util.show_alert_top_tm("文件太大，请选择小于2M的图片文件");
      }
      reader.onload = e => {
        // post image to server
        const formData = new FormData();
        formData.append(name, $(`#${name}`)[0].files[0]);
        // $.each($('#id_front')[0].files, (i, file)=> {
        //     formData.append('files', file);
        //     console.log('append img file')
        // });
        $.ajax({
          url: `/${name}`,
          data: formData,
          cache: false,
          contentType: false,
          processData: false,
          type: "POST"
        })
          .done(res => {
            if (res.ret != 0) {
              console.log(res);
              util.show_error_top(`上传文件失败: ${res.msg}`);
            } else {
              // upload to wx success, so display it
              this[`${name}_img`] = e.target.result;
            }
          })
          .fail(err => {
            util.show_error_top(`上传文件失败: ${err}`);
          });
      };
      reader.readAsDataURL(img_file);
    },

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
.count {
  display: flex;
  align-items: center;
}
.ti {
  border: 2px inset grey;
  margin: 0.5em 0.5rem 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: nowrap;
}
.ticket {
  display: flex;
  /* justify-content: space-between; */
  flex-flow: column;
  overflow: hidden;
  /* font-weight: 700; */
}

button {
  font-size: 1.2rem;
  margin: 0.5em 0.5rem;
  background-color: bisque;
  border-radius: 0.9em;
  color: #42b983;
}
button:disabled {
  background-color: #ccc;
  color: lightslategrey;
}
.scan {
  background-color: saddlebrown;
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
input[type="file"] {
  display: none;
}
img {
  max-width: 100%;
  max-height: 30%;
}
</style>
