<template>
  <div id="app">
    <header>      
      <div id="nav">
        <router-link to="/">商户注册</router-link> |
        <router-link to="/user">用户登陆</router-link> |
        <router-link to="/test">支付测试</router-link>
      </div>
    </header>
    <div class="content">
      <router-view/>
    </div>
    <footer>【飘云软件】微信小微商户管理</footer>
  </div>
</template>

<style>
:root {
  box-sizing: border-box;
  font-size: calc(1vw + 0.7em);
}
body {
  margin: 0;
  font-family: Helvetica, Arial, sans-serif;
}
#app {
  font-family: "Avenir", Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
}
header {
  background-color: rgb(132, 226, 69);
}
footer {
  /* bottom: 0;
  position: fixed; */
  background-color: lightgray;
}
header,
footer {
  text-align: center;
  min-width: 100%;
  min-height: 2rem;
  line-height: 2em;
}
.content {
  display: flex;
  flex-flow: column;
  /* background-image: url("./assets/bg.jpg"); */
  background-color: lightskyblue;
  background-position: center;
  background-repeat: no-repeat;
  background-size: cover;
  min-height: calc(100vh - 4rem);
}
/* -------------------------------------------------------------------------------- */
/* Tooltip container */
.tooltip {
  position: relative;
  display: inline-block;
  border-bottom: 1px dotted black; /* If you want dots under the hoverable text */
}

/* Tooltip text */
.tooltip .tooltiptext {
  visibility: hidden;
  /* width: 7rem; */
  background-color: black;
  color: #fff;
  text-align: center;
  padding: 5px 0;
  border-radius: 6px;
  /* Position the tooltip text  */
  top: 100%;
  left: 50%; 
  margin-left: -60px; /* Use half of the width (120/2 = 60), to center the tooltip */
  
  position: absolute;
  z-index: 1;
}

/* Show the tooltip text when you mouse over the tooltip container */
.tooltip:hover .tooltiptext {
  visibility: visible;
}
</style>
