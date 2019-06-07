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
        // logger.info("period job ...");
        var mchs = mongo.findMchsByStatus("applying");
        mchs.forEach(doc -> {
            var applyment_id = doc.get("applyment_id").toString();
            try {
                Map<String, String> retData = wxpay.queryMicroByApplyId(applyment_id);
                if ( !Util.IsWxRetSuccess(retData) ) return;
                String now = Util.getNowStr();
                // content, dt, op, payload
                var noty_msg = new Document("dt", now);
                var retState = retData.get("applyment_state");
                var _id = doc.get("_id").toString();
                switch (retState) {
                    case "REJECTED": {
                        AuditDetail ad = new Gson().fromJson(retData.get("applyment_state"), AuditDetail.class);
                        String reason = ad.audit_detail.stream().map(r -> r.reject_reason + "; ")
                                .collect(Collectors.joining());
                        noty_msg.append("content", "申请已驳回，原因：" + reason);
                        noty_msg.append("op", "reapply");
                        mongo.updateMch(_id, Map.of("status", "rejected") );
                        break;
                    }
                    case "FROZEN": {
                        noty_msg.append("content", "商户已冻结");
                        noty_msg.append("op", "reapply");
                        mongo.updateMch(_id, Map.of("status", "frozen") );
                        break;
                    }
                    case "TO_BE_SIGNED":
                    case "FINISH": {
                        noty_msg.append("content", "商户审核通过，待支付&签约");
                        noty_msg.append("op", "pay_fee");
                        noty_msg.append("payload", _id);
                        mongo.updateMch(_id, Map.of(
                            "status", "to_be_signed",
                            "sub_mch_id", retData.get("sub_mch_id"),
                            "sign_url", retData.get("sign_url")
                            ) 
                        );
                        logger.info("sign_url={}", retData.get("sign_url"));
                        break;
                    }
                }
                var cli_id = doc.get("cli_id").toString();
                if ( !WxWs.notify_msg(cli_id, noty_msg) ) {
                    mongo.insertNotyMsg(noty_msg);
                }
                
            } catch (Exception e) {
                e.printStackTrace();
            }

        });
    }
}