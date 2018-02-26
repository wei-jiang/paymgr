<template>
    <div>
      <v-toolbar>
        <v-spacer></v-spacer>
        <v-toolbar-items >
          <v-btn color="primary" @click="add_usr"><v-icon>add</v-icon>新增用户</v-btn>
        </v-toolbar-items>
      </v-toolbar>
      <v-layout row wrap>
          <v-layout row wrap xs6 v-for="u in users">
            <v-card xs6 color="cyan darken-2" class="white--text">
                <v-layout row>
                  <v-flex>
                    <v-text-field
                      v-model="u.name"
                      label="用户名称"
                    ></v-text-field>
                  </v-flex>
                </v-layout>
                <v-layout row>
                  <v-flex>
                    <v-text-field
                      label="邮箱"
                      v-model="u.email"
                    ></v-text-field>
                  </v-flex>
                </v-layout>
                <v-layout row>
                  <v-flex>
                    <v-text-field
                      label="密码"
                      v-model="u.password"
                    ></v-text-field>
                  </v-flex>
                </v-layout>

              <v-card-actions>
                  <v-btn flat dark @click.prevent="download_token(u)">下载token</v-btn>
                  <v-btn color="error" @click.prevent="del_usr(u)">删除</v-btn>
                  <v-btn color="info" @click.prevent="mod_usr(u)">修改</v-btn>
              </v-card-actions>
            </v-card>
            <v-card xs6 color="cyan darken-1" class="white--text" >
              <v-layout row>
                <v-flex>
                  <div>请在10分钟内导入用户信息，过期失效！</div>
                </v-flex>
              </v-layout>
              <v-layout column align-center>
                <canvas :id="u._id" style="width:200px; height:200px;"></canvas>
              </v-layout>
              <v-card-actions>
                <v-btn color="orange" @click.prevent="gen_reg_usr_info(u)" >生成用户注册信息</v-btn>
              </v-card-actions>
            </v-card>
          </v-layout>

        </v-layout>
    </div>     
</template>

<script>
import QRious from "qrious";
import net from "../net";
import util from "../common/util";

export default {
  name: "UserPage",
  beforeRouteEnter(to, from, next) {
    sessionStorage.getItem("usr_token") ? next() : next("/login");
  },
  data() {
    return {
      users: [],
      def_usr:{
        name:'张三',
        email:'eva@163.com',
        password:'123456'
      }
    };
  },
  computed: {
    mp_nickname() {
 
    }
  },
  created: function() {
    this.$root.$on("usr_changed", data => {
      this.get_users();
    });
  },
  methods: {    
    gen_reg_usr_info(u){
      net.emit_with_usr_token("gen_usr_reg_token", u, res => {
        // console.log(res);
        if (res.token) {
          let qr = new QRious({
            element: document.getElementById(u._id),
            foreground: "purple",
            size: 200,
            value: res.token
          });
        } else {
          let reason = res.msg || "未知";
          util.show_noty(`生成用户注册信息失败，原因：${reason}`);
        }
      });
    },
    download_token(u) {
      if( !(u.name && u.email && u.password) ) return util.show_noty(`请填写完整用户信息`);
      net.emit_with_usr_token("gen_usr_token", u, res => {
        if (res.ret == 0) {
          util.download_text(`${u.name}.txt`, res.token);
          util.show_noty(`token下载成功，请查看浏览器下载目录`);
        } else {
          util.show_noty(`下载token失败：${JSON.stringify(res.msg)}`);
        }
      });
    },
    del_usr(u) {
      util.show_confirm('确定删除吗？',()=>{
        net.emit_with_usr_token("del_usr", u);
      })        
    },
    mod_usr(u) {
      if( !(u.name && u.email && u.password) ) return util.show_noty(`请填写完整用户信息`);
      util.show_confirm('确定修改吗？',()=>{
        net.emit_with_usr_token("mod_usr", u);
      })      
    },
    add_usr() {
      net.emit_with_usr_token('add_usr', this.def_usr)
    },
    get_users() {
      net.emit_with_usr_token("get_usrs", '', res => {
        if (res.ret == 0) {
          this.users = res.usrs;
        } else {
          util.show_noty(`获取用户列表失败：${res.msg}`);
        }
      });
    }
  },
  mounted() {
    this.get_users();
  }
};
</script>

<style scoped>


</style>