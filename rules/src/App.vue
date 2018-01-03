<template>
  <v-app light>
    <v-navigation-drawer
      fixed
      :mini-variant="miniVariant"
      :clipped="clipped"
      v-model="drawer"
      app
    >
      <v-list>
        <v-list-tile
          value="true"
          v-for="(item, i) in items"
          :key="i"
          exact
        >
          <v-list-tile-action>
            <v-icon light v-html="item.icon"></v-icon>
          </v-list-tile-action>
          <v-list-tile-content>
            <v-list-tile-title v-text="item.title"></v-list-tile-title>
          </v-list-tile-content>
        </v-list-tile>
      </v-list>
    </v-navigation-drawer>
    <v-toolbar fixed app :clipped-left="clipped">
      <v-toolbar-side-icon @click.stop="drawer = !drawer" light></v-toolbar-side-icon>
      <v-btn
        icon
        light
        @click.stop="miniVariant = !miniVariant"
      >
        <v-icon v-html="miniVariant ? 'chevron_right' : 'chevron_left'"></v-icon>
      </v-btn>
      <v-btn
        icon
        light
        @click.stop="clipped = !clipped"
      >
        <v-icon>web</v-icon>
      </v-btn>
      <v-btn
        icon
        light
        @click.stop="fixed = !fixed"
      >
        <v-icon>remove</v-icon>
      </v-btn>
      <v-toolbar-title v-text="title"></v-toolbar-title>
      <v-spacer></v-spacer>
      <v-btn
        icon
        light
        @click.stop="rightDrawer = !rightDrawer"
      >
        <v-icon>add</v-icon>
      </v-btn>
    </v-toolbar>
    <v-content>
      <router-view></router-view>
    </v-content>
    <v-navigation-drawer
      temporary
      :right="right"
      v-model="rightDrawer"
      fixed
    >
      <v-container fluid>
        <v-layout row>

          <v-flex xs10>
            <v-text-field
              v-model="mch.name"
              label="商户名称"
            ></v-text-field>
          </v-flex>
        </v-layout>
        <v-layout row>

          <v-flex xs10>
            <v-text-field
              label="微信ID"
              v-model="mch.wx_id"
            ></v-text-field>
          </v-flex>
        </v-layout>
        <v-layout row>

          <v-flex xs10>
            <v-text-field
              label="支付宝ID"
              v-model="mch.aly_id"
            ></v-text-field>
          </v-flex>
        </v-layout>
        <v-layout row>

          <v-flex xs10>
            <v-text-field
              label="token"
              v-model="token"
              multi-line
            ></v-text-field>
          </v-flex>
        </v-layout>
        <v-divider></v-divider>
        <v-layout row>
            <v-btn color="success" @click.prevent="gen_token">生成token</v-btn>
            <!-- <v-btn color="success" @click.prevent="download_token">下载token</v-btn> -->
            <v-btn color="info" @click.prevent="add_mch">添加商户</v-btn>
        </v-layout>
      </v-container>
    </v-navigation-drawer>
    <v-footer :fixed="fixed" app>
      <span>&copy; freego 2018</span>
    </v-footer>
  </v-app>
</template>

<script>
import util from "./common/util";
import net from "./net";

export default {
  data() {
    return {
      token:'',
      mch:{
        name:'',
        wx_id:'',
        aly_id:''
      },
      clipped: false,
      drawer: true,
      fixed: false,
      items: [
        {
          icon: "bubble_chart",
          title: "商户列表"
        }
      ],
      miniVariant: false,
      right: true,
      rightDrawer: false,
      title: "智慧旅游支付平台"
    };
  },
  methods: {
    clear(){
      this.mch = {
        name:'',
        wx_id:'',
        aly_id:''
      }
      this.token = ''
    },
    is_filled(){
      return this.mch.name && this.mch.wx_id && this.mch.aly_id;
    },
    download_token(){
      if(this.token){
        util.download_text(`${this.mch.name}.txt`, this.token)
        util.show_noty('已下载商户token')
      } else{
        util.show_noty('token 为空')
      }      
    },
    gen_token() {
      if( this.is_filled() ){
        net.emit('req_token', this.mch, token=>{
          this.token = token
        })

      } else {
        util.show_noty('请填写商户信息')
      }
      
    },
    add_mch() {
      if( this.is_filled() ){
        net.emit('add_mch', this.mch)
        this.clear()
      } else {
        util.show_noty('请填写商户信息')
      }
    }
  }
};
</script>
<style src='noty/lib/noty.css'>
    /* global styles */
</style> 