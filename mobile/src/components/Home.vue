<template>
  <home data-page="true">
    <header class="header-bar">
      <div class="center">
        <h1 class="title">商户列表</h1>
      </div>
    </header>
    <div class="content">

      <ul class="list">
        <li class="divider">已入驻子商户</li>
        <li  v-for="m in mchs">
          <span class="padded-list">{{m.name}}</span>
          <a class="pull-right icon icon-arrow-forward with-circle" :href="`#!pay/${m.name}`"></a>
        </li>
      </ul>

    </div>
  </home>
</template>

<script>
import _ from 'lodash'
import net from "../net";
import util from "../common/util";
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
