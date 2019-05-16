const CronJob = require('cron').CronJob;
const mail = require('./mail');
const stat = require('./stat');

const job = new CronJob('55 59 23 * * *', ()=> {
  // console.log('send report mail');
  // mail.send('test email', 'test content')
  stat.do_job()
}, null, false, 'Asia/Shanghai');

module.exports = {
  start : ()=>{
    console.log()
    //pm2 first node
    if(typeof process.env.NODE_APP_INSTANCE == 'undefined' || process.env.NODE_APP_INSTANCE == 0) {
      //schedule your cron job here since this part will be executed for only one cluster
      job.start()
    }    
  }
}
