package py;

import java.util.*;
import java.util.function.BiFunction;
import java.util.function.Function;

import org.bson.Document;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
public class EvtSys {
    private static final Logger logger = LoggerFactory.getLogger(EvtSys.class);
    // Map<String, Consumer<String>> commands = new HashMap<>();
    private static final Map<String, BiFunction<String, Document, Document>> handlers = new HashMap<>();
    Mongo mongo;
    public EvtSys(Mongo mongo){
        this.mongo = mongo;
        handlers.put("reg_fee", (data, order)->{
            // data suppose to be _id 
            logger.info("{} pay reg fee successful", data);
            try{
                var doc = mongo.findMchBy_id(data);     
                if(doc == null) throw new Exception("can not find target mch");       
                mongo.updateMch(data, Map.of("status", "paid") );
                var token = Util.signSubMchId( doc.get("sub_mch_id").toString() );
                var sign_url =QrCode.genQr( doc.get("sign_url").toString() );
                var html = Util.fillTemplate("reg_ok.ftl", Map.of("sign_url", sign_url, "token", QrCode.genQr(token)));
                Mail.sendMail("微信商户注册成功【飘云软件】", html, doc.get("contact_email").toString());

                var cli_id = doc.get("cli_id").toString();
                var noty_msg = new Document("dt", Util.getNowStr());
                noty_msg.append("content", "微信商户注册成功， 请查看邮件扫码签约+使用");
                noty_msg.append("op", "sign");
                if ( !WxWs.notify_msg(cli_id, noty_msg) ) {
                    mongo.insertNotyMsg(noty_msg);
                }
            }catch (Exception e) {
                // unlikely
                e.printStackTrace();
            }
            return order;
        } );
    }
    public Document handle(String cmd, String data, Document order){
        var dealer = handlers.get(cmd);
        if( dealer != null) {
            order = dealer.apply(data, order);
        }
        return order;
    }
}