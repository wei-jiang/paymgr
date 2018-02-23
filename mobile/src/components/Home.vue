<template>
  <home data-page="true">
    <header class="header-bar">
      <div class="center">
        <h1 class="title">商户列表</h1>
      </div>
    </header>
    <div class="content">
      <div style="display:flex;text-align:center;">
        <div>智慧旅游</div>
        <button style="margin-left:auto;" class="btn btn-flat" @click="go_to_buy('智慧旅游')">
          <i class="icon icon-arrow-forward with-circle"></i>
        </button>
      </div>          

      <ul class="list">
        <li class="divider">已入驻子商户</li>
        <li class="padded-list" v-for="m in mchs" >
          <div style="display:flex;">
            <span>{{m.name}}</span>
            <button style="margin-left:auto;" class="btn btn-flat" @click="go_to_buy(m)" :disabled="!is_pay_available(m)">
              {{pay_caption(m)}}<i class="icon icon-arrow-forward with-circle"></i>
            </button>
          </div>          
        </li>
      </ul>

    </div>
  </home>
</template>

<script>
import _ from 'lodash'
import net from "../net";
import util from "../common/util";
import def from "../common/def";
export default {
  name: "PhononHomePage",
  props: {
    app: {
      type: Object,
      require: true
    }
  },
  data() {
    return {
      mchs: []

    };
  },
  computed: {
    mp_nickname() {

    }
  },
  created: function() {
    // this.$root.$on("pay_result", data => {
    //   util.show_noty(`${data.body},价格${data.total_fee}分，支付成功`);
    // });
  },
  methods: {
    go_to_buy(m) {
      // <a class="pull-right" :href="`#!pay/${m.name}`"></a>
      phonon.navigator().changePage("buy", m.name);
    },
    is_pay_available(m){
      return m.pay_type & window.usr_info.pay_type
    },
    pay_caption(m){
      let pt = this.is_pay_available(m)
      if(pt){
        return ''//def.get_pay_caption(pt) + '支付'
      }
      return def.get_pay_caption( window.usr_info.pay_type ) + '支付' + '未开通'
    },
    get_mchs() {
      net.get_mchs(res=>{
        if(res.ret == 0){
          window.mchs = this.mchs = res.mchs
        } else {
          util.show_noty(`获取商户列表失败: ${res.msg}`);
        }
        
      })
    }
  },
  mounted() {
    this.app.on({ page: "home", preventClose: false, content: null });
    this.get_mchs()
  }
};
</script>
