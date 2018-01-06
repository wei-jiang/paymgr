const java = require("java");

java.classpath.push("../jar/kotlin_bridge-all.jar");
java.asyncOptions = {
    syncSuffix: "Sync",
    asyncSuffix: "",
    promiseSuffix: "Promise",   // Generate methods returning promises, using the suffix Promise.
    promisify: require("when/node").lift
};

let AliPay = java.import('freego.AliPay');

//winston is global
function deal_aly_pay(app, io, db) {
}
module.exports = deal_aly_pay;