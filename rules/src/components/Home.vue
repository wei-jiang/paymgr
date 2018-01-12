<template>
  <v-container fluid>
    <v-slide-y-transition mode="out-in">
      <v-layout column align-center>
        <!-- <img src="static/img/v.png" alt="Vuetify.js" class="mb-5"> -->
        <v-container
          fluid
          style="min-height: 0;"
          grid-list-lg
        >
          <v-layout row wrap>
            <!-- <v-flex> -->
              <v-layout row wrap xs6 v-for="m in mchs">
              <v-card xs6 color="cyan darken-2" class="white--text">
                  <v-layout row>
                    <!-- <v-flex xs4>
                      <v-subheader>商户名称</v-subheader>
                    </v-flex> -->
                    <v-flex>
                      <v-text-field
                        v-model="m.name"
                        label="商户名称"
                      ></v-text-field>
                    </v-flex>
                  </v-layout>
                  <v-layout row>
                    <!-- <v-flex xs4>
                      <v-subheader>微信ID</v-subheader>
                    </v-flex> -->
                    <v-flex>
                      <v-text-field
                        label="微信ID"
                        v-model="m.wx_id"
                      ></v-text-field>
                    </v-flex>
                  </v-layout>
                  <v-layout row>
                    <!-- <v-flex xs4>
                      <v-subheader>支付宝ID</v-subheader>
                    </v-flex> -->
                    <v-flex>
                      <v-text-field
                        label="支付宝ID"
                        v-model="m.aly_id"
                      ></v-text-field>
                    </v-flex>
                  </v-layout>

                <v-card-actions>
                    <v-btn flat dark @click.prevent="download_token(m)">下载token</v-btn>
                    <v-btn color="error" @click.prevent="del_mch(m)">删除</v-btn>
                    <v-btn color="info" @click.prevent="mod_mch(m)">修改</v-btn>
                </v-card-actions>
              </v-card>
              <v-card xs6 color="cyan darken-1" class="white--text" >
                <v-layout row>
                  <v-flex>
                    <v-text-field
                      v-model="m.body"
                      label="商品名称"
                    ></v-text-field>
                  </v-flex>
                </v-layout>
                <v-layout row>
                  <v-flex>
                    <v-text-field
                      label="价格(分)"
                      v-model="m.total_fee"
                    ></v-text-field>
                  </v-flex>
                </v-layout>
                <v-layout column align-center>
                  <!-- <v-flex> -->
                    <canvas :id="m._id" style="width:200px; height:200px;"></canvas>
                  <!-- </v-flex> -->
                </v-layout>
                <v-card-actions>
                    <v-btn color="orange" @click.prevent="wx_qr(m)" :disabled="!m.wx_id">微信扫码</v-btn>
                    <v-btn color="pink" @click.prevent="aly_qr(m)" :disabled="!(m.ali && m.ali.app_auth_token)">支付宝扫码</v-btn>
                </v-card-actions>
              </v-card>
              </v-layout>
            <!-- </v-flex> -->
            
          </v-layout>
        </v-container>
        
      </v-layout>
    </v-slide-y-transition>
  </v-container>
</template>

<script>
import QRious from "qrious";
import net from "../net";
import util from "../common/util";

export default {
  name: "HomePage",
  beforeRouteEnter(to, from, next) {
    sessionStorage.getItem("token_id") ? next() : next("/login");
    console.log("beforeRouteEnter");
  },
  data() {
    return {
      mchs: [
        {
          name: "蔡伦竹海",
          wx_id: "123423414124",
          aly_id: "9989887776767"
        }
      ],
      info: "",
      wi: {
        openid: "",
        nickname: "",
        sex: "",
        language: "",
        city: "",
        province: "",
        country: "",
        headimgurl: ""
      }
    };
  },
  computed: {
    mp_nickname() {
      return wi.nickname;
    }
  },
  created: function() {
    this.$root.$on("mch_changed", data => {
      this.get_mchs();
    });
    this.$root.$on("pay_result", data => {
      util.show_noty(`${data.body},价格${data.total_fee}分，支付成功`);
    });
  },
  methods: {
    wx_qr(m) {
      if (!m.body || !m.total_fee) {
        return util.show_noty("请填写名称/价格");
      }
      m.token = sessionStorage.getItem("usr_token")
      net.emit("req_token", m, res => {
        if (res.ret == 0) {
          let data = {
            cli_id,
            out_trade_no: new Date().getTime().toString(),
            body: m.body,
            total_fee: m.total_fee,
            token: res.token
          };
          console.log(data);
          net.emit("req_wxpay_qr", data, res => {
            console.log(res);
            if (res.code_url) {
              let qr = new QRious({
                element: document.getElementById(m._id),
                size: 200,
                value: res.code_url
              });
            } else {
              let reason = res.msg || "未知";
              util.show_noty(`下单失败，原因：${reason}`);
            }
          });
        } else {
          util.show_noty(`您尚未登陆，获取商户token失败`);
        }
      });
    },
    aly_qr(m) {
      if (!m.body || !m.total_fee) {
        return util.show_noty("请填写名称/价格");
      }
      m.token = sessionStorage.getItem("usr_token")
      net.emit("req_token", m, res => {
        if (res.ret == 0) {
          let data = {
            cli_id,
            out_trade_no: new Date().getTime().toString(),
            body: m.body,
            total_fee: m.total_fee,
            token: res.token
          };
          console.log(data);
          net.emit("req_alipay_qr", data, res => {
            console.log(res);
            if (res.code_url) {
              let qr = new QRious({
                element: document.getElementById(m._id),
                foreground: "purple",
                size: 200,
                value: res.code_url
              });
            } else {
              let reason = res.msg || "未知";
              util.show_noty(`下单失败，原因：${reason}`);
            }
          });
        } else {
          util.show_noty(`您尚未登陆，获取商户token失败`);
        }
      });
    },
    get_mchs() {
      net.emit(
        "get_mchs",
        {
          token: sessionStorage.getItem("usr_token")
        },
        res => {
          if (res.ret == 0) {
            this.mchs = res.mchs;
          } else {
            util.show_noty(`您尚未登陆，获取商户列表失败`);
          }
        }
      );
    },
    del_mch(m) {
      net.emit("del_mch", m);
    },
    mod_mch(m) {
      net.emit("mod_mch", m);
    },
    download_token(m) {
      net.emit("req_token", m, res => {
        if (res.ret == 0) {
          util.download_text(`${m.name}.txt`, res.token);
        } else {
          util.show_noty(`您尚未登陆，下载token失败`);
        }
      });
    }
  },
  mounted() {
    console.log("mounted");
    this.get_mchs();
  }
};
</script>
<style scoped>
.footer {
  bottom: 0px;
  color: royalblue;
}
.count {
  color: blue;
  margin-left: auto;
}
</style>