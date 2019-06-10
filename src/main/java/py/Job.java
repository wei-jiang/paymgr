package py;

import java.util.*;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.function.BiFunction;
import java.util.function.Function;
import java.util.stream.Collectors;

import com.github.wxpay.sdk.WXPay;
import com.google.gson.Gson;

import org.bson.Document;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class Job {
    private static final Logger logger = LoggerFactory.getLogger(Job.class);

    ScheduledExecutorService executor = Executors.newSingleThreadScheduledExecutor();
    Mongo mongo;
    WXPay wxpay;

    class RejectReason {
        String param_name;
        String reject_reason;
    }

    class AuditDetail {
        ArrayList<RejectReason> audit_detail;
    }

    public Job(WXPay wxpay, Mongo mongo) {
        this.mongo = mongo;
        this.wxpay = wxpay;
        executor.scheduleAtFixedRate(() -> checkApplyResult(), 1, 1, TimeUnit.MINUTES);
        // executor.scheduleAtFixedRate(() -> test(), 1, 1, TimeUnit.SECONDS);
        // executor.schedule(() -> test(), 1, TimeUnit.SECONDS);
    }

    public void test() {
        var json = "{\"audit_detail\": [{\"param_name\": \"account_number\",\"reject_reason\": \"银行账户不存在\"},{\"param_name \": \"mobile_phone\",\"reject_reason\": \"号码不存在\"}]}";
        AuditDetail reason = new Gson().fromJson(json, AuditDetail.class);
        reason.audit_detail.forEach(r -> {
            logger.info(r.reject_reason);
        });
        String result = reason.audit_detail.stream().map(r -> r.reject_reason + "; ").collect(Collectors.joining());
        logger.info(result);
    }

    public void checkApplyResult() {
        // logger.info("checkApplyResult period job ...");
        var mchs = mongo.findMchsByStatus("AUDITING");
        mchs.forEach(doc -> {
            // logger.info( doc.toJson() );
            var applyment_id = doc.get("applyment_id").toString();
            try {
                Map<String, String> retData = wxpay.queryMicroByApplyId(applyment_id);
                if ( !Util.IsWxRetSuccess(retData) ) return;
                logger.info( retData.toString() );
                String now = Util.getNowStr();
                // content, dt, op, payloads(general name, that )
                var noty_msg = new Document("dt", now);
                var retState = retData.get("applyment_state");
                var _id = doc.get("_id").toString();
                mongo.updateMch(_id, Map.of("status", retState) );
                switch (retState) {
                    case "REJECTED": {
                        AuditDetail ad = new Gson().fromJson(retData.get("applyment_state"), AuditDetail.class);
                        String reason = ad.audit_detail.stream().map(r -> r.reject_reason + "; ")
                                .collect(Collectors.joining());
                        noty_msg.append("content", "申请已驳回，原因：" + reason);
                        noty_msg.append("op", "重新申请");
                        break;
                    }
                    case "FROZEN": {
                        noty_msg.append("content", "商户已冻结");
                        noty_msg.append("op", "重新申请");
                        break;
                    }
                    case "TO_BE_SIGNED":
                    case "FINISH": {                      
                        var merchant_shortname = doc.get("merchant_shortname").toString();
                        var sign_url = retData.get("sign_url");
                        //for test
                        if(sign_url == null) {
                            if(doc.get("sign_url") == null){
                                sign_url = "https://pay.weixin.qq.com/public/apply_sign_mobile/showQrcode?merchantId=105143047&sign=62987c4fc548f65327a4d2ce6c2a47aa";
                            } else {
                                sign_url = doc.get("sign_url").toString();
                            }
                        }
                        
                        var token = Util.signSubMchId( retData.get("sub_mch_id") );
                        noty_msg.append("content", String.format("【%s】商户审核通过，请用商户认证微信号扫码签约", merchant_shortname));
                        noty_msg.append("op", "待签约");
                        noty_msg.append("sign_url", sign_url);
                        noty_msg.append("token", token);
                        noty_msg.append("merchant_shortname", merchant_shortname);
                        if(doc.get("sub_mch_id") == null && doc.get("sign_url") == null){
                            mongo.updateMch(_id, Map.of(
                                "sub_mch_id", retData.get("sub_mch_id"),
                                "sign_url", sign_url
                                ) 
                            );
                        }
                        // logger.info("sign_url={}", sign_url);                        
                        var html = Util.fillTemplate("reg_ok.ftl", Map.of("sign_url", sign_url, "token", QrCode.genQr(token)));
                        Mail.sendMail(String.format("【%s】微信商户注册成功", merchant_shortname), html, doc.get("contact_email").toString());
                        // in case throw exception, so put it behind
                        if(retState.equals("TO_BE_SIGNED")){
                            // TO_BE_SIGNED
                            var ret = wxpay.setJsApiPath(retData.get("sub_mch_id"), Secret.wxjsapiPath);
                        }                        
                        break;
                    }
                } //end switch
                var cli_id = doc.get("cli_id").toString();
                // if ( !WxWs.notify_msg(cli_id, noty_msg) ) {
                    noty_msg.put("cli_id", cli_id);
                    mongo.insertNotyMsg(noty_msg);
                // }
                
            } catch (Exception e) {
                e.printStackTrace();
            }

        });
    }
}