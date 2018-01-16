<template>
    <div>
        this is order page
    </div>     
</template>

<script>
import QRious from "qrious";
import net from "../net";
import util from "../common/util";

export default {
  name: "OrderPage",
  beforeRouteEnter(to, from, next) {
    sessionStorage.getItem("usr_token") ? next() : next("/login");
  },
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

    });
  },
  methods: {    
    login() {
      
    }
  },
  mounted() {

  }
};
</script>

<style scoped>


</style>