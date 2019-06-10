package py;

import com.github.wxpay.sdk.WXPay;
import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.github.wxpay.sdk.WXMisc;
import java.lang.reflect.Type;
import java.nio.file.*;

import com.google.gson.reflect.TypeToken;
import java.io.*;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.Properties;
import io.javalin.Javalin;
import io.javalin.core.util.FileUtil;
import io.javalin.json.JavalinJson;
import io.javalin.websocket.WsSession;
import org.bson.Document;

import org.eclipse.jetty.websocket.api.Session;
import org.eclipse.jetty.websocket.api.UpgradeRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import static py.Util.toJson;

public class WxWs {
    private static final Logger logger = LoggerFactory.getLogger(WxWs.class);
    Javalin app;
    WXPay wxpay;
    Mongo mongo;

    static Type MapType = new TypeToken<Map<String, String>>() {
    }.getType();
    private static Map<WsSession, String> sock2id = new ConcurrentHashMap<>();
    private static Map<String, WsSession> id2sock = new ConcurrentHashMap<>();

    public WxWs(Javalin app, WXPay wxpay, Mongo mongo) {
        this.app = app;
        this.wxpay = wxpay;
        this.mongo = mongo;
        app.ws("/wx_pay", ws -> {
            ws.onConnect(session -> {

            });
            ws.onClose((session, status, message) -> {
                cli_offline(session);
            });
            ws.onMessage((session, message) -> {
                try {
                    if( !message.isEmpty() ){
                        Map<String, String> data = Util.jsonStrToMap(message);
                        if (data.get("cmd") == null)
                            throw new Exception("invalid request");
                        handle_msg(data, session);
                    }
                    
                } catch (Exception e) {
                    e.printStackTrace();
                    session.close();
                }
            });
        });
    }

    private void handle_msg(Map<String, String> data, WsSession sock) {
        switch (data.get("cmd")) {
        case "reg_cli_id": {
            var cli_id = data.get("cli_id");
            if (cli_id == null) {
                sock.close();
                break;
            }
            cli_online(cli_id, sock);
            List<Document> paids = mongo.findPendingPaid(cli_id);
            paids.forEach(o -> {
                if (notify_pay_success(o.get("cli_id").toString(), o)) {
                    mongo.delPoByOid(o.get("out_trade_no").toString());
                }
            });
            // noty msg
            List<Document> notys = mongo.findNotyByField("cli_id", cli_id);
            notys.forEach(doc -> {
                if (notify_msg(cli_id, doc)) {
                    mongo.delNotyBy_id(doc.get("_id").toString());
                }
            });
        }
            break;
        case "req_reg_fee_wx_qr": {
            // client side:
            // const data = {
            //     cmd: "req_reg_fee_wx_qr",
            //     _id: resp._id,
            //     cli_id
            //   };
            //   ws.send(data);
            var reg_fee = new HashMap<String, String>();
            reg_fee.put("cmd", data.get("cmd"));
            reg_fee.put("cli_id", data.get("cli_id"));
            reg_fee.put("total_fee", "2000");
            reg_fee.put("total_fee", "1");
            reg_fee.put("attach", "reg_fee," + data.get("_id"));
            reg_fee.put("body", "微信小微商户注册费");
            try {
                reqWxQr(reg_fee, sock, Secret.sub_mch_id);
            } catch (Exception e) {
                sock.send(toJson(Map.of("ret", -1, "msg", e.getMessage())));
            }
        }
            break;
        case "req_wx_qr_by_token": {
            var token = data.get("token");
            try {
                var sub_mch_id = Util.verifyToken(token).get("sub_mch_id");
                // use extra parameter and remove it
                data.remove("token");
                reqWxQr(data, sock, sub_mch_id);
            } catch (Exception e) {
                sock.send(toJson(Map.of("ret", -1, "msg", e.getMessage())));
                // sock.close();
                // e.printStackTrace();
            }
        }
            break;
        case "req_wx_qr_by_id_num": {
            var idNum = data.get("id_num");
            try {
                var doc = mongo.findMchByField("id_card_number", idNum);
                if (doc == null)
                    throw new Exception("身份证号不存在");
                var sub_mch_id = doc.get("sub_mch_id").toString();
                reqWxQr(data, sock, sub_mch_id);
            } catch (Exception e) {
                data.put("ret", "-1");
                data.put("msg", e.getMessage());
                sock.send(toJson(data));
                // sock.send(toJson(Map.of("ret", -1, "msg", e.getMessage())));
            }
        }
            break;
        case "req_wx_qr_by_sn": {
            // mch short name
            var sn = data.get("short_name");
            try {
                // logger.info("short_name={}", sn);
                var doc = mongo.findMchByField("merchant_shortname", sn);
                if (doc == null)
                    throw new Exception("商户简称不存在");
                var sub_mch_id = doc.get("sub_mch_id").toString();
                reqWxQr(data, sock, sub_mch_id);
            } catch (Exception e) {
                data.put("ret", "-1");
                data.put("msg", e.getMessage());
                sock.send(toJson(data));
            }
        }
            break;
        default:

            break;
        }

    }

    void reqWxQr(Map<String, String> data, WsSession sock, String sub_mch_id) throws Exception {
        if (data.get("body") == null || data.get("total_fee") == null || data.get("cli_id") == null)
            throw new Exception("参数错误");
        // always behide reverse proxy
        var cli_ip = sock.header("x-forwarded-for");
        if (cli_ip == null)
            cli_ip = "222.244.74.216";
        // logger.info("cli_ip={}", cli_ip);
        var out_trade_no = Util.getOutTradeNo();
        var reqData = new HashMap<String, String>();
        reqData.put("body", data.get("body"));
        reqData.put("sub_mch_id", sub_mch_id);
        reqData.put("out_trade_no", out_trade_no);
        if(data.get("attach") != null) reqData.put("attach", data.get("attach"));
        reqData.put("total_fee", data.get("total_fee"));
        reqData.put("spbill_create_ip", cli_ip);
        reqData.put("trade_type", "NATIVE"); // 此处指定为扫码支付
        // shallow copy of the map.
        Map<String, String> res = wxpay.unifiedOrder(new HashMap<String, String>(reqData));
        logger.info( res.toString() );
        Util.checkWxRet(res);
        reqData.put("cli_id", data.get("cli_id"));
        reqData.remove("attach");
        mongo.insertPendingOrder(reqData);
        // send back result with original data
        data.put("ret", "0");
        data.put("code_url", res.get("code_url"));
        sock.send(toJson(data));
    }
    public static Boolean notify_client(String cli_id, Document doc) {
        var t_sock = id2sock.get(cli_id);
        if (t_sock != null) {
            var json = doc.toJson();
            logger.info(String.format("websocket notify %s: %s", cli_id, json));
            t_sock.send(json);
            return true;
        }
        return false;
    }
    public static Boolean notify_pay_success(String cli_id, Document o) {
        Document doc = Document.parse(o.toJson());
        doc.put("cmd", "pay_success");
        return notify_client(cli_id, doc);
    }
    public static Boolean notify_msg(String cli_id, Document o) {
        Document doc = Document.parse(o.toJson());
        doc.put("cmd", "noty_msg");
        return notify_client(cli_id, doc);
    }
    private void cli_online(String id, WsSession session) {
        if (id2sock.get(id) != null) {
            WsSession old_sock = id2sock.get(id);
            logger.info("same client [{}] online, dump old one", id);
            old_sock.close();
            sock2id.remove(old_sock);           
        }
        id2sock.put(id, session);
        sock2id.put(session, id);
        // session.setIdleTimeout(3600 * 1000); // ms this will result in client not get close notified?
        logger.info(String.format("cli_online [%s] id2sock.size=%d && sock2id.size=%d", id, id2sock.size(), sock2id.size()));
    }

    

    private static void cli_offline(WsSession session) {
        if (sock2id.get(session) != null) {
            String cli_id = sock2id.get(session);
            // logger.info("$cli_id offline")
            id2sock.remove(cli_id);
            sock2id.remove(session);
            logger.info(String.format("cli_offline [%s] id2sock.size=%d && sock2id.size=%d", cli_id, id2sock.size(), sock2id.size()));
        } else {
            logger.info(String.format("cli_offline not found session id2sock.size=%d && sock2id.size=%d", id2sock.size(), sock2id.size()));
        }
        
    }

    // Sends a message from one user to all users, along with a list of current
    // usernames
    private static void broadcastMessage(String message) {
        sock2id.keySet().stream().filter(Session::isOpen).forEach(session -> {
            session.send(new Gson().toJson(Map.of("ret", 0, "media_id", "media_id", "_id", "_id")));
        });
    }

}