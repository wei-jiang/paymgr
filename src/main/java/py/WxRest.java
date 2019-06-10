package py;

import com.github.wxpay.sdk.WXPay;
import com.github.wxpay.sdk.WXPayConstants;
import com.github.wxpay.sdk.WXPayUtil;
import com.google.gson.Gson;
import com.github.wxpay.sdk.WXMisc;
import java.lang.reflect.Type;
import com.google.gson.reflect.TypeToken;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.IOException;
import java.io.OutputStreamWriter;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

import io.javalin.Context;
import io.javalin.Javalin;
import io.javalin.UploadedFile;
import io.javalin.core.util.FileUtil;

import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import org.apache.commons.io.FileUtils;
import org.apache.commons.io.FilenameUtils;
import org.apache.commons.lang3.RandomStringUtils;
import org.bson.Document;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import freemarker.template.Template;
import static py.Util.jsonToMap;

public class WxRest {
    private static final Logger logger = LoggerFactory.getLogger(WxRest.class);
    Javalin app;
    WXPay wxpay;
    Mongo mongo;
    EvtSys evtSys;

    public WxRest(Javalin app, WXPay wxpay, Mongo mongo) {
        this.app = app;
        this.wxpay = wxpay;
        this.mongo = mongo;
        evtSys = new EvtSys(mongo);
        // By default URLs must be lowercase. Change casing or call
        // `app.enableCaseSensitiveUrls()` to allow mixed casing
        app.post("/wxpay/notify_refund", ctx -> {
            String notifyData = ctx.body(); // 退款结果通知的xml格式数据
            // logger.info("退款结果通知:{}", notifyData);
            Map<String, String> notifyMap = WXPayUtil.xmlToMap(notifyData); // 转换成map
            var req_info = notifyMap.get("req_info");
            var refundData = Util.decodeRefundData(req_info);
            // logger.info("退款数据:{}", refundData);
            var refundMap = WXPayUtil.xmlToMap(refundData);
            logger.info("退款Map:{}", refundMap.toString());
            int refund_fee = Integer.parseInt( refundMap.get("refund_fee") );
            var out_trade_no = refundMap.get("out_trade_no");
            var refund_status = refundMap.get("refund_status");
            if(refund_status.equals("SUCCESS")){
                logger.info("out_trade_no={}, refund_fee={}", out_trade_no, refund_fee);
                mongo.updateRefundOrder(out_trade_no, refund_fee);
            }
            ///////////////////////////////////////////////////////
            Map<String, String> retData = new HashMap<String, String>();
            retData.put("return_code", "SUCCESS");
            retData.put("return_msg", "OK");
            String retBody = WXPayUtil.mapToXml(retData);
            ctx.result(retBody);
        });
        app.post("/wxpay/notify", ctx -> {
            String notifyData = ctx.body(); // 支付结果通知的xml格式数据
            logger.info("支付结果通知:{}", notifyData);
            Map<String, String> notifyMap = WXPayUtil.xmlToMap(notifyData); // 转换成map
            if (wxpay.isPayResultNotifySignatureValid(notifyMap)) {
                // 签名正确,进行处理。
                // 注意特殊情况：订单已经退款，但收到了支付结果成功的通知，不应把商户侧订单状态从退款改成支付成功
                if (!Util.IsWxRetSuccess(notifyMap)) {
                    logger.info(Util.wxErrMsg(notifyMap));
                    return;
                }
                var out_trade_no = notifyMap.get("out_trade_no");
                var doc = mongo.findPoByOid(out_trade_no);
                if (doc != null) {
                    // var cli_id = doc.remove("cli_id");
                    doc.remove("createdAt");
                    doc.append("transaction_id", notifyMap.get("transaction_id"));
                    mongo.insertSuccessOrder(doc);
                    mongo.delPoByOid(out_trade_no);
                    // var attach = notifyMap.get("attach");
                    // if (attach != null) {
                    //     var payload = attach.split(",");
                    //     var cmd = payload[0];
                    //     var data = payload.length >= 2 ? payload[1] : null;
                    //     evtSys.handle(cmd, data, doc);
                    //     mongo.delPoByOid(out_trade_no);
                    // } else {
                    //     if(cli_id == null){
                    //         mongo.delPoByOid(out_trade_no);
                    //     } else {
                    //         var cid = cli_id.toString();
                    //         if (WxWs.notify_pay_success(cid, doc)) {
                    //             logger.info("notify client successful, cli_id={}; out_trade_no={}", cid, out_trade_no);
                    //             mongo.delPoByOid(out_trade_no);
                    //         } else {
                    //             mongo.updatePoStatus(out_trade_no, "paid");
                    //             logger.info("client offlined, notification to be continued");
                    //         }
                    //     }
                    // }    
                }
            } else {
                // 签名错误，如果数据里没有sign字段，也认为是签名错误
                logger.info("微信通知签名错误");
            }
            Map<String, String> retData = new HashMap<String, String>();
            retData.put("return_code", "SUCCESS");
            retData.put("return_msg", "OK");
            String retBody = WXPayUtil.mapToXml(retData);
            ctx.result(retBody);
        });
        app.post("/id_front", ctx -> {
            this.saveImg(ctx, "id_front");
        });
        app.post("/id_back", ctx -> {
            this.saveImg(ctx, "id_back");
        });
        app.post("/store_entrance", ctx -> {
            this.saveImg(ctx, "store_entrance");
        });
        app.post("/store_indoor", ctx -> {
            this.saveImg(ctx, "store_indoor");
        });
        app.get("/qs", ctx -> {
            ctx.json(ctx.headerMap());
        });
        app.get("/gzh_relay", ctx -> {
            var rurl = ctx.queryParam("rurl");
            var token = ctx.queryParam("token");
            var total_fee = ctx.queryParam("total_fee");
            var out_trade_no = ctx.queryParam("out_trade_no");
            var body = ctx.queryParam("body");
            var cli_id = ctx.queryParam("cli_id");           
            try{               
                if(rurl == null || token == null || total_fee == null || body == null) throw new Exception("参数不正确");
                Map<String, String> data = new HashMap<>();
                var cli_ip = ctx.header("x-forwarded-for");  
                data.put("token", token);   //will be replaced by sub_mch_id
                var sub_mch_id = Util.getSubMchId(data);
                data.put("sub_mch_id", sub_mch_id);
                if( out_trade_no == null ) {
                    data.put("out_trade_no", Util.getOutTradeNo());
                } else {
                    data.put("out_trade_no", out_trade_no);
                }
                data.put("total_fee", total_fee);
                data.put("body", body);
                data.put("spbill_create_ip", cli_ip);
                data.put("trade_type", "JSAPI");

                data.put("rurl", rurl);
                data.put("cli_id", cli_id);      
                ctx.sessionAttribute("gzh_data", data);
                var qs = Util.queryString( Map.of("rurl", "/gzh_pay") );
                ctx.redirect("/node/wx/uid?" + qs);
            }catch(Exception e){
                Map<String, String> resData = new HashMap<>();
                resData.put("ret", "-1");
                resData.put("msg", e.getMessage());
                ctx.json(resData);
            }
        });
        app.get("/gzh_pay", ctx -> {
            String openid = ctx.queryParam("openid");
            Map<String, String> data = ctx.sessionAttribute("gzh_data");
            try{
                if(openid == null || data == null ) throw new Exception("gzh_pay 参数不正确");
                logger.info("openid={}", openid);
                data.put("openid", openid);
                var reqData = new HashMap<String, String>(data);
                String rurl = reqData.remove("rurl");
                reqData.remove("cli_id");
                Map<String, String> res = wxpay.unifiedOrder(reqData);
                logger.info( res.toString() );
                Util.checkWxRet(res);
                mongo.insertPendingOrder(data);
                data.clear();
                String timeStamp = String.valueOf( (new Date()).getTime() );
                data.put("appId", PyConfig.appId);
                data.put("timeStamp", timeStamp);
                data.put("nonceStr", res.get("nonce_str"));
                data.put("signType", WXPayConstants.HMACSHA256);
                data.put("package", "prepay_id="+res.get("prepay_id") );
                data.put("paySign", wxpay.signData(data) );
                // 分 to 元
                var total_fee = reqData.get("total_fee");
                total_fee = String.format("%.02f", Integer.parseInt(total_fee)/100.0);
                data.put("out_trade_no", reqData.get("out_trade_no"));
                data.put("total_fee", total_fee);
                data.put("body", reqData.get("body"));
                data.put("rurl", rurl);
                ctx.render("gzh_pay.ftl", data);
            }catch(Exception e){
                e.printStackTrace();
                Map<String, String> resData = new HashMap<>();
                resData.put("ret", "-1");
                resData.put("msg", e.getMessage());
                ctx.json(resData);
            }
        });
        app.post("/clear_session", ctx -> {
            var data = jsonToMap(ctx);            
            try {
                var sub_mch_id = Util.getSubMchId(data);
                ctx.sessionAttribute("_id", null);
                data.put("ret", "0");
            } catch (Exception e) {
                data.put("ret", "-1");
                data.put("msg", e.getMessage());
            }
            ctx.json(data);
        });
        app.post("/reg_micro_mch", ctx -> {
            try {
                String _id = ctx.sessionAttribute("_id");
                if (_id == null || _id.isEmpty()) throw new Exception("no prerequisite info");
                Map<String, String> data = jsonToMap(ctx);
                if( 
                    data.get("cli_id") == null
                    || data.get("id_card_name") == null 
                    || data.get("id_card_number") == null 
                    || data.get("id_card_valid_time") == null 
                    || data.get("account_name") == null
                    || data.get("account_bank") == null
                    || data.get("bank_address_code") == null
                    || data.get("account_number") == null
                    || data.get("store_name") == null
                    || data.get("store_address_code") == null
                    || data.get("store_street") == null
                    || data.get("merchant_shortname") == null
                    || data.get("service_phone") == null
                    || data.get("product_desc") == null
                    || data.get("contact") == null
                    || data.get("contact_phone") == null
                    || data.get("contact_email") == null
                ) throw new Exception("参数不正确");
                Document doc = setMchField(_id, data);
                data.put("business_code", doc.get("_id").toString());
                data.put("id_card_copy", doc.get("id_front_media_id").toString());
                data.put("id_card_national", doc.get("id_back_media_id").toString());
                data.put("store_entrance_pic", doc.get("store_entrance_media_id").toString());
                data.put("indoor_pic", doc.get("store_indoor_media_id").toString());
                data.remove("cli_id");
                Map<String, String> res = wxpay.regMicro(data);
                Util.checkWxRet(res);
                setMchField(_id, Map.of(
                    "applyment_id", res.get("applyment_id"),
                    "status", "AUDITING"
                    )
                );
                // and wait for background thread to check result
                ctx.json(Map.of("ret", 0));    
            } catch (Exception e) {
                e.printStackTrace();
                ctx.json(Map.of("ret", -1, "msg", e.getMessage()));
            }
        });
        app.post("/change_micro_contact_info", ctx -> {
            // token && mobile_phone || email || merchant_name
            Map<String, String> data = jsonToMap(ctx);
            var token = data.get("token");
            try {
                var email = Util.verifyToken(token).get("email");
                var doc = mongo.findMchByField("contact_email", email);
                if (doc == null)
                    throw new Exception("邮箱不存在");
                if (doc.get("sub_mch_id") == null)
                    throw new Exception("商户尚未开通");

                data.put("sub_mch_id", doc.get("sub_mch_id").toString());
                Map<String, String> res = wxpay.changeMicroContactInfo(data);
                Util.checkWxRet(res);
                // field name are different, so
                setMchField(doc.get("_id").toString(), Map.of("contact_phone", data.get("mobile_phone"),
                        "contact_email", data.get("email"), "merchant_shortname", data.get("merchant_name")));
                ctx.json(Map.of("ret", 0));
            } catch (Exception e) {
                logger.info(e.getMessage());
                ctx.json(Map.of("ret", -1, "msg", e.getMessage()));
            }
        });
        app.post("/change_micro_bank", ctx -> {
            Map<String, String> data = jsonToMap(ctx);
            var token = data.get("token");
            try {
                var email = Util.verifyToken(token).get("email");
                var doc = mongo.findMchByField("contact_email", email);
                if (doc == null)
                    throw new Exception("邮箱不存在");
                if (doc.get("sub_mch_id") == null)
                    throw new Exception("商户尚未开通");

                data.put("sub_mch_id", doc.get("sub_mch_id").toString());
                Map<String, String> res = wxpay.changeMicroBankCard(data);
                if (!(res.get("return_code").equals("SUCCESS")) && res.get("result_code").equals("SUCCESS")) {
                    throw new Exception(
                            res.get("err_code_des") == null ? res.get("return_msg") : res.get("err_code_des"));
                }
                data.remove("token");
                setMchField(doc.get("_id").toString(), data);
                ctx.json(Map.of("ret", 0));
            } catch (Exception e) {
                logger.info(e.getMessage());
                ctx.json(Map.of("ret", -1, "msg", e.getMessage()));
            }
        });
        app.post("/send_veri_code_mch", ctx -> {
            var data = jsonToMap(ctx);
            try {
                var sub_mch_id = Util.getSubMchId(data);
                var doc = mongo.findMchByField("sub_mch_id", sub_mch_id);
                if (doc == null) throw new Exception("商户不存在");
                data.put("email", doc.get("contact_email").toString() );
                sendVeriCode(data, ctx);
            } catch (Exception e) {
                Util.fillErrorMsg(data, e.getMessage());
                ctx.json(data);
            }   
        });
        app.post("/send_veri_code_user", ctx -> {
            var data = jsonToMap(ctx);
            var email = data.get("email");
            var doc = mongo.findMchByField("contact_email", email);
            if (doc == null) {
                ctx.json(Map.of("ret", -1, "msg", "邮箱不存在"));
                return;
            }
            logger.info("user exist, do send code");
            sendVeriCode(data, ctx);
        });
        app.post("/send_veri_code_new", ctx -> {
            var data = jsonToMap(ctx);
            var email = data.get("email");
            var doc = mongo.findMchByField("contact_email", email);
            if (doc != null) {
                data.put("ret", "-1");
                data.put("msg", "邮箱已存在，请更换新邮箱注册，或用此邮箱登陆");
                ctx.json(data);
            } else {
                sendVeriCode(data, ctx);
            }

        });
        app.post("/micro_user_login", ctx -> {
            var data = jsonToMap(ctx);
            var email = data.get("email");
            var code = data.get("code");
            if (mongo.checkVeriCode(email, code)) {
                var doc = mongo.findMchByField("contact_email", email);
                if (doc == null) {
                    data.put("ret", "-1");
                    data.put("msg", "邮箱不存在");
                } else {
                    var token = Util.signToken(Map.of("email", email));
                    data.put("ret", "0");
                    data.put("token", token);
                }
            } else {
                data.put("ret", "-1");
                data.put("msg", "验证码错误");
            }
            ctx.json(data);
        });
        app.post("/get_user_info", ctx -> {
            var data = jsonToMap(ctx);
            var token = data.get("token");
            try {
                var email = Util.verifyToken(token).get("email");
                var doc = mongo.findMchByField("contact_email", email);
                if (doc == null)
                    throw new Exception("邮箱不存在");
                data.put("account_name", doc.get("account_name").toString());
                data.put("account_bank", doc.get("account_bank").toString());
                data.put("account_number", doc.get("account_number").toString());
                data.put("bank_address_code", doc.get("bank_address_code").toString());
                data.put("contact_email", doc.get("contact_email").toString());
                data.put("contact_phone", doc.get("contact_phone").toString());
                data.put("merchant_shortname", doc.get("merchant_shortname").toString());
                data.put("product_desc", doc.get("product_desc").toString());
                data.put("store_name", doc.get("store_name").toString());
                data.put("store_street", doc.get("store_street").toString());
                data.put("ret", "0");
            } catch (Exception e) {
                data.put("ret", "-1");
                data.put("msg", e.getMessage());
            }
            data.remove("token");
            ctx.json(data);
        });
        app.post("/verify_email", ctx -> {
            var data = jsonToMap(ctx);
            var email = data.get("email");
            var code = data.get("code");
            if (mongo.checkVeriCode(email, code)) {
                data.put("ret", "0");
            } else {
                data.put("ret", "-1");
            }
            ctx.json(data);
        });
        app.post("/test", ctx -> {
            var data = jsonToMap(ctx);
            logger.info(data.get("name"));
            CompletableFuture<String> completionFuture = new CompletableFuture<>();
            Executors.newSingleThreadScheduledExecutor().schedule(() -> {
                logger.info("java timeout!");
                completionFuture.complete(data.get("name"));
            }, 3, TimeUnit.SECONDS);
            // ctx.json(data);
            ctx.result(completionFuture);
        });
        // rest for wxpay, every request data must have token
        app.post("/wx/poll_order_query", ctx -> {
            var data = jsonToMap(ctx);            
            try {
                if( data.get("token") == null || data.get("out_trade_no") == null) throw new Exception("参数不正确");
                var sub_mch_id = Util.getSubMchId(data);
                var doc = mongo.findOrderByFields( Map.of(
                    "sub_mch_id", sub_mch_id,
                    "out_trade_no", data.get("out_trade_no")
                ) );
                if(doc == null) throw new Exception("not found");
                data.put("ret", "0");
            } catch (Exception e) {
                data.put("ret", "-1");
                data.put("msg", e.getMessage());
            }
            ctx.json(data);
        });
        app.post("/wx/poll_noty", ctx -> {
            var data = jsonToMap(ctx);            
            try {
                if(data.get("cli_id") == null) throw new Exception("参数不正确");
                var notys = mongo.findNotyByFields( Map.of(
                    "cli_id", data.get("cli_id")
                ) );
                var retData = new Document("ret", "0").append("notys", notys);
                ctx.json(retData);
                mongo.delNotyByCli_id( data.get("cli_id") );
            } catch (Exception e) {
                data.put("ret", "-1");
                data.put("msg", e.getMessage());
                ctx.json(data);
            }           
        });
        app.post("/wx/unified_order", ctx -> {
            var data = jsonToMap(ctx);
            try {
                if( data.get("token") == null || data.get("cli_id") == null || data.get("total_fee") == null || data.get("body") == null) throw new Exception("参数不正确");
                var sub_mch_id = Util.getSubMchId(data);
                var cli_ip = ctx.header("x-forwarded-for");
                if (cli_ip == null) cli_ip = "222.244.74.216";
                if( data.get("out_trade_no") == null ) data.put("out_trade_no", Util.getOutTradeNo());
                data.put("sub_mch_id", sub_mch_id);
                data.put("spbill_create_ip", cli_ip);
                data.put("trade_type", "NATIVE"); // 此处指定为扫码支付
                var reqData = new HashMap<String, String>(data);
                reqData.remove("attach");
                reqData.remove("cli_id");
                Map<String, String> resp = wxpay.unifiedOrder(reqData);
                Util.checkWxRet(resp);
                mongo.insertPendingOrder(data);
                data = resp;
                data.put("ret", "0");
            } catch (Exception e) {
                Util.fillErrorMsg(data, e.getMessage());
            }
            ctx.json(data);
        });
        app.post("/wx/orderquery", ctx -> {
            var data = jsonToMap(ctx);
            try {
                var sub_mch_id = Util.getSubMchId(data);
                // logger.info(data.get("out_trade_no"));
                data.put("sub_mch_id", sub_mch_id);
                Map<String, String> resp = wxpay.orderQuery(data);
                Util.checkWxRet(resp);
                data = resp;
                data.put("ret", "0");
            } catch (Exception e) {
                Util.fillErrorMsg(data, e.getMessage());
            }
            ctx.json(data);
        });
        app.post("/wx/refundquery", ctx -> {
            var data = jsonToMap(ctx);
            try {
                var sub_mch_id = Util.getSubMchId(data);
                // logger.info(data.get("out_trade_no"));
                data.put("sub_mch_id", sub_mch_id);
                Map<String, String> resp = wxpay.refundQuery(data);
                Util.checkWxRet(resp);
                data = resp;
                data.put("ret", "0");
            } catch (Exception e) {
                Util.fillErrorMsg(data, e.getMessage());
            }
            ctx.json(data);
        });
        app.post("/wx/downloadbill", ctx -> {
            var data = jsonToMap(ctx);
            try {
                var sub_mch_id = Util.getSubMchId(data);
                if (data.get("bill_date") == null) {
                    String today = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd"));
                    data.put("bill_date", today);
                }
                data.put("bill_type", "ALL");
                data.put("sub_mch_id", sub_mch_id);
                Map<String, String> resp = wxpay.downloadBill(data);
                Util.checkWxRet(resp);
                data = resp;
                data.put("ret", "0");
            } catch (Exception e) {
                Util.fillErrorMsg(data, e.getMessage());
            }
            ctx.json(data);
        });
        // actually this is no use, can not short usual url
        app.post("/wx/shorturl", ctx -> {
            var data = jsonToMap(ctx);
            try {
                var sub_mch_id = Util.getSubMchId(data);
                data.put("sub_mch_id", sub_mch_id);
                Map<String, String> resp = wxpay.shortUrl(data);
                logger.info(resp.toString());
                Util.checkWxRet(resp);
                data = resp;
                data.put("ret", "0");
            } catch (Exception e) {
                Util.fillErrorMsg(data, e.getMessage());
            }
            ctx.json(data);
        });
        app.post("/wx/vericode_refund", ctx -> {
            var data = jsonToMap(ctx);           
            try {
                // all refund
                if( data.get("token") == null 
                    || data.get("code") == null 
                    || data.get("out_trade_no") == null 
                ) throw new Exception("参数不正确");
                var sub_mch_id = Util.getSubMchId(data);
                var doc = mongo.findMchByField("sub_mch_id", sub_mch_id);
                if(doc == null ) throw new Exception("商户不存在");
                if( !mongo.checkVeriCodeDel( doc.get("contact_email").toString(), data.get("code")) ) 
                    throw new Exception("验证码不正确");
                doc = mongo.findOrderByOid(data.get("out_trade_no"));
                if(doc == null ) throw new Exception("订单不存在");
                data.clear();
                data.put("out_trade_no", doc.get("out_trade_no").toString());
                data.put("out_refund_no", doc.get("out_trade_no").toString());
                data.put("total_fee", doc.get("total_fee").toString());
                data.put("refund_fee", doc.get("total_fee").toString());
                data.put("sub_mch_id", sub_mch_id);
                data.put("notify_url", Secret.refundNotifyUrl);
                Map<String, String> resp = wxpay.refund(data);
                logger.info(resp.toString());
                Util.checkWxRet(resp);
                data = resp;
                data.put("ret", "0");
            } catch (Exception e) {
                Util.fillErrorMsg(data, e.getMessage());
            }
            ctx.json(data);
        });
        app.post("/wx/refund", ctx -> {
            var data = jsonToMap(ctx);
            if( data.get("token") == null 
                || data.get("out_trade_no") == null 
                || data.get("out_refund_no") == null 
                || data.get("total_fee") == null
                || data.get("refund_fee") == null
            ) throw new Exception("参数不正确");
            try {
                var sub_mch_id = Util.getSubMchId(data);
                data.put("sub_mch_id", sub_mch_id);
                data.put("notify_url", Secret.refundNotifyUrl);
                Map<String, String> resp = wxpay.refund(data);
                logger.info(resp.toString());
                Util.checkWxRet(resp);
                data = resp;
                data.put("ret", "0");
            } catch (Exception e) {
                Util.fillErrorMsg(data, e.getMessage());
            }
            ctx.json(data);
        });
        app.post("/wx/reverse", ctx -> {
            var data = jsonToMap(ctx);
            try {
                var sub_mch_id = Util.getSubMchId(data);
                data.put("sub_mch_id", sub_mch_id);
                Map<String, String> resp = wxpay.reverse(data);
                logger.info(resp.toString());
                Util.checkWxRet(resp);
                data = resp;
                data.put("ret", "0");
            } catch (Exception e) {
                Util.fillErrorMsg(data, e.getMessage());
            }
            ctx.json(data);
        });
        app.post("/default_mch", ctx -> {           
            var data = jsonToMap(ctx);
            try {
                if( data.get("cli_id") == null ) throw new Exception("参数不正确");
                data.remove("cli_id");
                var doc = mongo.findMchByField("contact_email", Secret.adminEmail);
                if(doc == null || doc.get("sub_mch_id") == null) throw new Exception("商户未开通");
                var token = Util.signSubMchId( doc.get("sub_mch_id").toString() );
                data.put("token", token);
                putMchInfo(data, doc);
            } catch (Exception e) {
                Util.fillErrorMsg(data, e.getMessage());
            }
            ctx.json(data);
        });
        app.post("/read_mch", ctx -> {           
            var data = jsonToMap(ctx);
            try {
                if( data.get("token") == null ) throw new Exception("参数不正确");
                var sub_mch_id = Util.verifyToken(data.get("token")).get("sub_mch_id");
                var doc = mongo.findMchByField("sub_mch_id", sub_mch_id);
                if(doc == null || doc.get("sub_mch_id") == null) throw new Exception("商户未开通");
                putMchInfo(data, doc);
            } catch (Exception e) {
                Util.fillErrorMsg(data, e.getMessage());
            }
            ctx.json(data);
        });
        app.post("/wx/close_order", ctx -> {
            var data = jsonToMap(ctx);
            try {
                var sub_mch_id = Util.getSubMchId(data);
                data.put("sub_mch_id", sub_mch_id);
                Map<String, String> resp = wxpay.closeOrder(data);
                logger.info(resp.toString());
                Util.checkWxRet(resp);
                data = resp;
                data.put("ret", "0");
            } catch (Exception e) {
                Util.fillErrorMsg(data, e.getMessage());
            }
            ctx.json(data);
        });
        app.post("/wx/micro_pay", ctx -> {
            var data = jsonToMap(ctx);
            try {
                if( data.get("token") == null || data.get("auth_code") == null || data.get("total_fee") == null || data.get("body") == null) throw new Exception("参数不正确");
                var sub_mch_id = Util.getSubMchId(data);
                var cli_ip = ctx.header("x-forwarded-for");
                if (cli_ip == null) cli_ip = "222.244.74.216";
                if( data.get("out_trade_no") == null ) data.put("out_trade_no", Util.getOutTradeNo());
                data.put("sub_mch_id", sub_mch_id);
                data.put("spbill_create_ip", cli_ip);
                Map<String, String> resp = wxpay.microPay(new HashMap<String, String>(data));
                logger.info(resp.toString());
                Util.checkWxRet(resp);
                data.remove("auth_code");
                data.put("trade_type", resp.get("trade_type"));
                data.put("transaction_id", resp.get("transaction_id"));
                mongo.insertSuccessOrder(data);
                data.put("ret", "0");
            } catch (Exception e) {
                Util.fillErrorMsg(data, e.getMessage());
            }
            ctx.json(data);
        });
    }

    Map<String, String> putMchInfo(Map<String, String> data, Document doc){
        // 身份证 	显示前 1 位 + *(实际位数) + 后 1 位，如： 3****************3
        // 银行卡 	显示前 6 位 + *(实际位数) + 后 4 位，如：622575******1496
        // 手机号 	显示前 3 位 + **** + 后 4 位，如：137****9050
        data.put("account_bank", doc.get("account_bank").toString());
        data.put("account_name", Util.maskBottomPart(doc.get("account_name").toString(), 1));
        data.put("account_number", Util.maskCenter(doc.get("account_number").toString(), 6, 4) );
        data.put("contact_email", Util.maskEmail(doc.get("contact_email").toString()));
        data.put("contact_phone", Util.maskCenter(doc.get("contact_phone").toString(), 3, 4));
        data.put("id_card_number", Util.maskCenter(doc.get("id_card_number").toString(), 1, 1));
        data.put("merchant_shortname", doc.get("merchant_shortname").toString());
        data.put("product_desc", doc.get("product_desc").toString());
        data.put("service_phone", Util.maskCenter(doc.get("service_phone").toString(), 3, 4));
        data.put("ret", "0");
        return data;
    }

    void sendVeriCode(Map<String, String> data, Context ctx) {
        CompletableFuture<Map<String, String>> completionFuture = new CompletableFuture<>();
        Executors.newSingleThreadExecutor().submit(() -> {
            var email = data.get("email");
            var code = RandomStringUtils.random(6, false, true);
            try {
                mongo.insertVeriCode(email, code);
                // logger.info("email={}, code={}", email, code);
                Template temp = Util.freemarker.getTemplate("veri_email.ftl");
                var bos = new ByteArrayOutputStream();
                temp.process(new HashMap<String, String>() {
                    {
                        put("code", code);
                    }
                }, new OutputStreamWriter(bos, StandardCharsets.UTF_8));
                // logger.info("begin send mail {}", bos.toString());
                Mail.sendMail("微信小微商户邮箱验证", bos.toString(), email);
                data.put("ret", "0");
            } catch (Exception e) {
                e.printStackTrace();
                data.put("ret", "-1");
                data.put("msg", e.getMessage());
            }
            completionFuture.complete(data);
        });
        ctx.json(completionFuture);
    }

    void saveImg(Context ctx, String imgField) throws Exception {
        String _id = ctx.sessionAttribute("_id");
        UploadedFile img = ctx.uploadedFile(imgField);
        UUID uuid = UUID.randomUUID();
        var imgName = uuid.toString() + "." + FilenameUtils.getExtension(img.getName());
        String filePath = "/data/upload/" + imgName;
        logger.info("imgPath=" + filePath);
        try {
            FileUtil.streamToFile(img.getContent(), filePath);
            Map<String, String> res = wxpay.upload(new File(filePath));
            if (!(res.get("return_code").equals("SUCCESS") && res.get("result_code").equals("SUCCESS"))) {
                throw new Exception(res.get("err_code_des") == null ? res.get("return_msg") : res.get("err_code_des"));
            }
            String media_id = res.get("media_id");
            var imgPathField = String.format("%s_img_path", imgField);
            var imgMediaIdField = String.format("%s_media_id", imgField);
            // turn immutable map to mutable
            Document doc = setMchField(_id, new HashMap<>(Map.of(imgPathField, imgName, imgMediaIdField, media_id)));
            if (_id == null || _id.isEmpty()) {
                _id = doc.get("_id").toString();
            } else if( doc.get(imgPathField) != null && doc.get(imgMediaIdField) != null ){
                // save old image
                Map<String, String> oldImg = new HashMap<>();
                oldImg.put(imgPathField, doc.get(imgPathField).toString());
                oldImg.put(imgMediaIdField, doc.get(imgMediaIdField).toString());
                oldImg.put("type", "image");
                mongo.insertMedia(oldImg);
            }
            // set session id
            ctx.sessionAttribute("_id", _id);
            ctx.json(Map.of("ret", 0, "media_id", media_id, "_id", _id));
        } catch (Exception e) {
            e.printStackTrace();
            // try {
            //     // notify wx also delete img, but there is no official api
            //     Files.deleteIfExists(Paths.get(filePath));
            // } catch (Exception ex) {
            //     // TODO: handle exception
            // }
            ctx.json(Map.of("ret", -1, "msg", e.getMessage()));
            // Map.ofEntries(
            // entry("a", "b"),
            // entry("c", "d")
            // );
        }
    }

    Document setMchField(String _id, Map<String, String> fields) {
        if (_id == null || _id.isEmpty()) {
            fields.put("create_time",
                    LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss.SSS")));
            fields.put("status", "draft");
            return this.mongo.insertMch(fields);
        } else {
            Document doc = this.mongo.updateMch(_id, fields);
            // do not delete image
            // fields.forEach((k, v) -> {
            // if (k.endsWith("_img_path")) {
            // try {
            // String previousImg = doc.get(k).toString();
            // // logger.info("delete old img = " + previousImg);
            // Files.deleteIfExists(Paths.get(previousImg));
            // } catch (IOException e) {
            // // TODO Auto-generated catch block
            // e.printStackTrace();
            // }
            // }
            // });
            return doc;
        }
    }
}