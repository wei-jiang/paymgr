<template>
  <div class="home">
    <Ticket msg="Welcome to Your Vue.js App"/>
  </div>
</template>

<script>
// @ is an alias to /src
import Ticket from '@/components/Ticket.vue'

export default {
  name: 'home',
  components: {
    Ticket
  }
}
</script>
<style scoped>
.home {
  
}

</style>
