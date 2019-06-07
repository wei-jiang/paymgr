package py;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.OutputStreamWriter;
import java.io.Writer;
import java.nio.charset.Charset;
import java.security.MessageDigest;
import java.util.Base64;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.lang.reflect.Type;
import java.util.stream.Collectors;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import javax.crypto.Cipher;
import javax.crypto.spec.SecretKeySpec;

import com.auth0.jwt.JWT;
import com.auth0.jwt.JWTVerifier;
import com.auth0.jwt.algorithms.Algorithm;
import com.auth0.jwt.interfaces.Claim;
import com.auth0.jwt.interfaces.DecodedJWT;
import com.google.gson.Gson;
import com.google.gson.reflect.TypeToken;

import org.apache.commons.codec.digest.DigestUtils;
import org.apache.http.client.utils.URLEncodedUtils;
import org.apache.http.message.BasicNameValuePair;
import org.apache.commons.io.FileUtils;
import org.apache.commons.lang3.RandomStringUtils;
import freemarker.template.*;
import io.javalin.rendering.JavalinRenderer;
import io.javalin.rendering.template.JavalinFreemarker;
import io.javalin.Context;

import org.eclipse.jetty.server.session.DefaultSessionCache;
import org.eclipse.jetty.server.session.FileSessionDataStore;
import org.eclipse.jetty.server.session.SessionCache;
import org.eclipse.jetty.server.session.SessionHandler;

public class Util {
    public static Configuration freemarker = new Configuration(Configuration.VERSION_2_3_28);
    static Type MapType = new TypeToken<Map<String, String>>() {}.getType();
    static void initFreeMarker(){
        freemarker.setClassForTemplateLoading(Util.class, "/views");
        freemarker.setDefaultEncoding("UTF-8");
        freemarker.setTemplateExceptionHandler(TemplateExceptionHandler.RETHROW_HANDLER);
        freemarker.setLogTemplateExceptions(false);
        freemarker.setWrapUncheckedExceptions(true);
        JavalinFreemarker.configure(freemarker);
        System.out.println( "initialize freemarker----------------------------------------------------");
    }
    public static String fillTemplate(String tmlp, Map<String, String> data) throws Exception {
        /* Create a data-model */
        /* Get the template (uses cache internally) */
        Template temp = freemarker.getTemplate(tmlp);
        /* Merge data-model with template */
        var bos = new ByteArrayOutputStream();
        Writer out = new OutputStreamWriter(bos);
        temp.process(data, out);
        return bos.toString();
    }

    public static String signSubMchId(String sub_mch_id) throws Exception {
        Algorithm algorithm = Algorithm.HMAC256(Secret.tokenPass);
        var jwt = JWT.create().withClaim("sub_mch_id", sub_mch_id)
        // .withIssuer("piaoyun")
        ;
        String token = jwt.sign(algorithm);
        return token;
    }

    public static String signToken(Map<String, String> data) throws Exception {
        Algorithm algorithm = Algorithm.HMAC256(Secret.tokenPass);
        var jwt = JWT.create().withExpiresAt(new Date(System.currentTimeMillis() + (60 * 60 * 1000))) // 60 minutes
                // .withIssuer("piaoyun")
                ;
        for (Map.Entry<String, String> entry : data.entrySet()) {
            jwt.withClaim(entry.getKey(), entry.getValue());
        }
        String token = jwt.sign(algorithm);
        return token;
    }

    public static Map<String, String> verifyToken(String token) throws Exception {
        JWTVerifier verifier = JWT.require(Algorithm.HMAC256(Secret.tokenPass))
        // .withIssuer("piaoyun")
        .build();
        DecodedJWT jwt = verifier.verify(token);
        var claims = jwt.getClaims();
        Map<String, String> data = new HashMap<String, String>();
        for (var entry : claims.entrySet()) {
            // this will filter out no string field
            data.put(entry.getKey(), entry.getValue().asString());
        }
        return data;

    }

    public static void checkWxRet(Map<String, String> res) throws Exception {
        if (!IsWxRetSuccess(res))
            throw new Exception(Util.wxErrMsg(res));
    }

    public static String wxErrMsg(Map<String, String> res) {
        return res.get("err_code_des") == null ? res.get("return_msg") : res.get("err_code_des");
    }

    public static Boolean IsWxRetSuccess(Map<String, String> res) {
        return res.get("return_code").equals("SUCCESS") && res.get("result_code").equals("SUCCESS");
    }

    public static void fillErrorMsg(Map<String, String> data, String msg) {
        data.clear();
        data.put("ret", "-1");
        data.put("msg", msg);
    }
    private static final String ALGORITHM = "AES";  
    private static final String ALGORITHM_MODE_PADDING = "AES/ECB/PKCS5Padding";  
    private static SecretKeySpec key = new SecretKeySpec(DigestUtils.md5Hex(PyConfig.key.getBytes()).toLowerCase().getBytes(), ALGORITHM);
    public static String decodeRefundData(String refundData) throws Exception {
        byte[] decodedBytes = Base64.getDecoder().decode(refundData);
        Cipher cipher = Cipher.getInstance(ALGORITHM_MODE_PADDING);  
        cipher.init(Cipher.DECRYPT_MODE, key);  
        return new String(cipher.doFinal(decodedBytes)); 
    }
    public static String getSubMchId(Map<String, String> data) throws Exception {
        var token = data.get("token");
        if (token == null)
            throw new Exception("no access token");
        var sub_mch_id = verifyToken(token).get("sub_mch_id");
        // use extra parameter and remove it
        data.remove("token");
        return sub_mch_id;
    }

    public static Map<String, String> jsonStrToMap(String json) {
        return new Gson().fromJson(json, MapType);
    }
    public static Map<String, String> jsonToMap(Context ctx) {
        // Type type = new TypeToken<Map<String, String>>() {}.getType();
        @SuppressWarnings("unchecked")
        Map<String, String> data = ctx.bodyAsClass(new HashMap<String, String>().getClass());
        return data;
    }
    public static String queryString(Map<String, String> qm) {
        List<BasicNameValuePair> nameValuePairs = qm.entrySet().stream()
        .map(entry -> new BasicNameValuePair(entry.getKey(), entry.getValue()))
        .collect(Collectors.toList());

        var qs = URLEncodedUtils.format(nameValuePairs, Charset.forName("UTF-8"));
        return qs;
    }
    public static String getNowStr() {
        return LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"));
    }
    public static String getOutTradeNo() {
        String now = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMddHHmmssSSS"));
        return RandomStringUtils.randomAlphanumeric(5) + now;
    }
    public static SessionHandler fileSessionHandler() {
        SessionHandler sessionHandler = new SessionHandler();
        SessionCache sessionCache = new DefaultSessionCache(sessionHandler);
        sessionCache.setSessionDataStore(fileSessionDataStore());
        sessionHandler.setSessionCache(sessionCache);
        sessionHandler.setHttpOnly(true);
        // make additional changes to your SessionHandler here
        return sessionHandler;
    }
    
    public static FileSessionDataStore fileSessionDataStore() {
        FileSessionDataStore fileSessionDataStore = new FileSessionDataStore();
        File baseDir = new File(System.getProperty("java.io.tmpdir"));
        File storeDir = new File(baseDir, "javalin-session-store");
        storeDir.mkdir();
        fileSessionDataStore.setStoreDir(storeDir);
        return fileSessionDataStore;
    }
    public static String maskTopPart(String str, int rest_count) {
        var star = "*";
        var beginIndex = str.length() - rest_count;
        return star.repeat(beginIndex) + str.substring(beginIndex);
    }
    public static String maskBottomPart(String str, int rest_count) {
        var star = "*";
        var remain = str.length() - rest_count;
        return  str.substring(0, rest_count) + star.repeat(remain);
    }
    public static String maskEmail(String email) {
        return  email.replaceAll("(^[^@]{3}|(?!^)\\G)[^@]", "$1*");
    }
    // mask 75% of left of the string
    public static String maskTopAlnum(String input) {
        int length = input.length() - input.length()/4;
        String s = input.substring(0, length);
        String res = s.replaceAll("[A-Za-z0-9]", "*") + input.substring(length);
        return res;
    }
    public static String maskCenter(String str, int left_count, int right_count) {
        var star = "*";
        var maskCount = str.length() - left_count - right_count;
        return  str.substring(0, left_count) + star.repeat(maskCount) + str.substring(str.length() - right_count);
    }
}