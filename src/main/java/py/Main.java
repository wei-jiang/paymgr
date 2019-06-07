package py;

import com.github.wxpay.sdk.WXPay;
import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.github.wxpay.sdk.WXMisc;
import java.lang.reflect.Type;
import java.nio.file.*;

import com.google.gson.reflect.TypeToken;
import java.io.*;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import java.util.Properties;
import io.javalin.Javalin;
import io.javalin.core.util.FileUtil;
import io.javalin.json.JavalinJson;
import io.javalin.rendering.JavalinRenderer;
import io.javalin.rendering.template.JavalinFreemarker;

import org.apache.commons.io.FileUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import static py.Util.jsonToMap;
public class Main {
    private static final Logger logger = LoggerFactory.getLogger(Main.class);

    public static void main(String[] args) throws Exception {
        // Test.test();
        Util.initFreeMarker();
        // JavalinRenderer.register(JavalinFreemarker.INSTANCE, ".ftl");
        Gson gson = new GsonBuilder().create();
        JavalinJson.setFromJsonMapper(gson::fromJson);
        JavalinJson.setToJsonMapper(gson::toJson);
        Mongo mongo = new Mongo();
        // mongo.findById("5cdec6776f8ebe488cf11b63");
        PyConfig config = new PyConfig();
        WXPay wxpay = new WXPay(config, Secret.notifyUrl);
        // for test
        // var ret = wxpay.setJsApiPath(Secret.sub_mch_id, Secret.wxjsapiPath);
        // logger.info(ret.toString());
        // wxpay.queryMicroByApplyId("2000002125333664");
        // wxpay.queryMicroByBusiCode("5ce42b1c71dc1f4eb35c9adc");
        // multiple static files merges
        Javalin app = Javalin.create()
        .enableStaticFiles("/public")
        .enableStaticFiles("/static")
        .exception(Exception.class, (e, ctx) -> {
            // handle general exceptions here
            e.printStackTrace();
            ctx.status(507);
        })
        .sessionHandler( () -> Util.fileSessionHandler() )
        .start(7902);
        
        new WxRest(app, wxpay, mongo);
        new WxWs(app, wxpay, mongo);
        new Job(wxpay, mongo);
        app.get("/qr", ctx -> {           
            // QrCode.genQr(content)
            ctx.render("qr_code.ftl", Map.of());
        });
        app.post("/qr", ctx -> {           
            Map<String, String> data = jsonToMap(ctx);
            try {
                var content = data.get("content");
                if(content == null) throw new Exception("no content");
                var qrUrl = QrCode.genQr(content);
                data.put("ret", "0");
                data.put("data_url", qrUrl);
            } catch (Exception e) {
                data.put("ret", "-1");
                data.put("msg", e.getMessage());
            }            
            ctx.json(data);
        });
        app.post("/send_problem", ctx -> {           
            Map<String, String> data = jsonToMap(ctx);
            try {
                var message = data.get("message");
                var contact_email = data.get("contact_email");
                if(message == null || contact_email == null) throw new Exception("内容不全");
                Mail.sendMail("from: "+contact_email, message, Secret.supportEmail);
                data.put("ret", "0");
            } catch (Exception e) {
                data.put("ret", "-1");
                data.put("msg", e.getMessage());
            }            
            ctx.json(data);
        });
        app.get("/session_test", ctx -> {
            String st = ctx.sessionAttribute("session_test");
            if(st == null) {
                st = "0";
            } else {
                int i = Integer.parseInt(st) + 1;
                st = String.valueOf(i);
            }
            ctx.sessionAttribute("session_test", st);
            ctx.result(st);
        });
        app.get("/test", ctx -> {
            // String cli_ip = ctx.header("x-forwarded-for");
            // if(cli_ip == null) cli_ip = ctx.ip();
            // logger.info("cli_ip={}", cli_ip);
            // var content = cli_ip;
            // var html = Util.fillTemplate("qr_code.ftl", Map.of("content", content, "qr", QrCode.genQr(content)));
            // Mail.sendMail("测试qr邮件", html, null);
   
            // ctx.result("you ip:"+cli_ip);
            // this is got array parameters
            ctx.json( ctx.queryParamMap() );
        });
        app.post("/upload", ctx -> {
            ctx.uploadedFiles("files").forEach(file -> {
                String filePath = "upload/" + file.getName();
                FileUtil.streamToFile(file.getContent(), filePath);
                logger.info("file.getName()={}", file.getName());
                try {
                    Map<String, String> res = wxpay.upload(new File(filePath));
                    String json = new Gson().toJson(res);
                    System.out.println(json);
                } catch (Exception e) {

                }
            });
            ctx.result("image saved");
        });

    }
}