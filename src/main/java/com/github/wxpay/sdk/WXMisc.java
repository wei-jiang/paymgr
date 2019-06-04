package com.github.wxpay.sdk;

import java.io.*;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.security.KeyStore;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.HashMap;
import java.util.Map;
import java.security.PublicKey;
import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import javax.security.cert.X509Certificate;
import java.util.Base64;
import javax.net.ssl.KeyManagerFactory;
import javax.net.ssl.SSLContext;

import com.github.wxpay.sdk.WXPayConstants.SignType;
import com.google.gson.Gson;
import com.google.gson.JsonObject;

import org.apache.commons.codec.binary.Hex;
import org.apache.commons.io.FileUtils;
import org.apache.http.client.config.RequestConfig;
import org.apache.http.client.HttpClient;
import org.apache.http.HttpEntity;
import org.apache.http.HttpResponse;
import org.apache.http.client.methods.HttpPost;
import org.apache.http.config.RegistryBuilder;
import org.apache.http.conn.socket.ConnectionSocketFactory;
import org.apache.http.conn.socket.PlainConnectionSocketFactory;
import org.apache.http.conn.ssl.DefaultHostnameVerifier;
import org.apache.http.conn.ssl.SSLConnectionSocketFactory;
import org.apache.http.entity.ContentType;
import org.apache.http.entity.mime.MultipartEntityBuilder;
import org.apache.http.impl.client.HttpClientBuilder;
import org.apache.http.impl.conn.BasicHttpClientConnectionManager;
import org.apache.http.protocol.HTTP;
import org.apache.http.util.EntityUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class WXMisc {

    private WXPayConfig config;
    private WXPay wxpay;
    private SignType signType;
    private static final Logger logger = LoggerFactory.getLogger(WXMisc.class);

    public WXMisc(final WXPayConfig config, WXPay wxpay) throws Exception {
        this.config = config;
        this.wxpay = wxpay;
        this.signType = SignType.HMACSHA256;
    }

    private static final String ALGORITHM = "AES/GCM/NoPadding";
    private static final int TAG_LENGTH_BIT = 128;
    private static final int NONCE_LENGTH_BYTE = 12;
    private static final String TRANSFORMATION_PKCS1Padding = "RSA/ECB/PKCS1Padding";

    private String aesgcmDecrypt(String aad, String iv, String cipherText) throws Exception {
        final String AES_KEY = config.getKey(); // APIv3密钥
        final Cipher cipher = Cipher.getInstance(ALGORITHM, "SunJCE");
        SecretKeySpec key = new SecretKeySpec(AES_KEY.getBytes(), "AES");
        GCMParameterSpec spec = new GCMParameterSpec(TAG_LENGTH_BIT, iv.getBytes());
        cipher.init(Cipher.DECRYPT_MODE, key, spec);
        cipher.updateAAD(aad.getBytes());
        return new String(cipher.doFinal(Base64.getDecoder().decode(cipherText)));
    }

    private static final String ALGORITHOM = "RSA";// 固定值，无须修改

    private static final String CIPHER_PROVIDER = "SunJCE";
    private static final String TRANSFORMATION_PKCS1Paddiing = "RSA/ECB/PKCS1Padding";

    private static final String CHAR_ENCODING = "UTF-8";// 固定值，无须修改
    private static final String PUBLIC_KEY_FILENAME = "wxPubKey.pem";// 平台证书路径，开发人员需根据具体路径修改

    // 数据加密方法
    private static byte[] encryptPkcs1padding(PublicKey publicKey, byte[] data) throws Exception {
        Cipher ci = Cipher.getInstance(TRANSFORMATION_PKCS1Paddiing, CIPHER_PROVIDER);
        ci.init(Cipher.ENCRYPT_MODE, publicKey);
        return ci.doFinal(data);
    }

    // 加密后的秘文，使用base64编码方法
    private static String encodeBase64(byte[] bytes) throws Exception {
        return Base64.getEncoder().encodeToString(bytes);
    }

    // 对敏感内容（入参Content）加密，其中PUBLIC_KEY_FILENAME为存放平台证书的路径，平台证书文件存放明文平台证书内容，且为pem格式的平台证书（平台证书的获取方式参照平台证书及序列号获取接口，通过此接口得到的参数certificates包含了加密的平台证书内容ciphertext，然后根据接口文档中平台证书解密指引，最终得到明文平台证书内容）
    public static String rsaEncrypt(String Content) throws Exception {
        // this one can not read from jar, must read as stream
        // final byte[] PublicKeyBytes = Files.readAllBytes(Paths.get(ClassLoader.getSystemResource(PUBLIC_KEY_FILENAME).toURI()));
        final byte[] PublicKeyBytes = WXMisc.class.getClassLoader().getResourceAsStream(PUBLIC_KEY_FILENAME).readAllBytes();
        X509Certificate certificate = X509Certificate.getInstance(PublicKeyBytes);
        PublicKey publicKey = certificate.getPublicKey();

        return encodeBase64(encryptPkcs1padding(publicKey, Content.getBytes(CHAR_ENCODING)));
    }

    public Map<String, String> getCert() throws Exception {
        Map<String, String> reqData = new HashMap<String, String>();
        reqData.put("mch_id", config.getMchID());
        reqData.put("nonce_str", WXPayUtil.generateNonceStr());
        reqData.put("sign_type", WXPayConstants.HMACSHA256);
        reqData.put("sign", WXPayUtil.generateSignature(reqData, config.getKey(), this.signType));
        String url = WXPayConstants.GETCERT_URL_SUFFIX;
        String respXml = wxpay.requestWithoutCert(url, reqData);
        Map<String, String> resData = wxpay.processResponseXml(respXml);
        String cert = resData.get("certificates");
        // logger.info(cert);
        JsonObject jsonObj = new Gson().fromJson(cert, JsonObject.class);
        // via JsonElement
        jsonObj = jsonObj.getAsJsonArray("data").get(0).getAsJsonObject();
        String serial_no = jsonObj.get("serial_no").getAsString();
        // logger.info(serial_no);
        JsonObject encrypt_certificate = jsonObj.get("encrypt_certificate").getAsJsonObject();

        final String associatedData = encrypt_certificate.get("associated_data").getAsString(); // encrypt_certificate.associated_data
        final String nonce = encrypt_certificate.get("nonce").getAsString(); // encrypt_certificate.nonce
        final String cipherText = encrypt_certificate.get("ciphertext").getAsString(); // encrypt_certificate.ciphertext
        try {
            String wxPubKey = aesgcmDecrypt(associatedData, nonce, cipherText);
            // logger.info(wxPubKey);
            FileUtils.writeStringToFile(new File(PUBLIC_KEY_FILENAME), wxPubKey);
        } catch (Exception e) {
            e.printStackTrace();
        }
        return resData;
    }
    public Map<String, String> regMicro(Map<String, String> reqData) throws Exception {
        reqData.put("version", "3.0");
        reqData.put("cert_sn", config.getCertSn());
        reqData.put("rate", "0.6%");
        reqData.put("mch_id", config.getMchID());
        reqData.put("nonce_str", WXPayUtil.generateNonceStr());
        reqData.put("sign_type", WXPayConstants.HMACSHA256);
        // for test
        // reqData.put("bank_address_code", "430100");       
        // encrypt some info
        reqData.put("id_card_name", rsaEncrypt( reqData.get("id_card_name") ) );
        reqData.put("id_card_number", rsaEncrypt( reqData.get("id_card_number") ) );
        reqData.put("account_name", rsaEncrypt( reqData.get("account_name") ) );
        reqData.put("account_number", rsaEncrypt( reqData.get("account_number") ) );
        reqData.put("contact", rsaEncrypt( reqData.get("contact") ) );
        reqData.put("contact_phone", rsaEncrypt( reqData.get("contact_phone") ) );
        reqData.put("contact_email", rsaEncrypt( reqData.get("contact_email") ) );
        reqData.put("sign", WXPayUtil.generateSignature(reqData, config.getKey(), this.signType));
        String url = WXPayConstants.REGMICRO_URL_SUFFIX;
        String req_json = new Gson().toJson(reqData);
        // logger.info(req_json);
        String respXml = wxpay.requestWithCert(url, reqData);
        Map<String, String> resData = wxpay.processResponseXml(respXml);
        String res_json = new Gson().toJson(resData);
        logger.info(res_json);
        return resData;
    }
    public Map<String, String> changeMicroBankCard(Map<String, String> data) throws Exception {
        if( data.get("sub_mch_id") == null 
            || data.get("account_number") == null
            || data.get("account_bank") == null
            || data.get("bank_address_code") == null
        ) 
            throw new Exception("sub_mch_id not exist");
        
        //do not change original data 
        Map<String, String> reqData = new HashMap<String, String>(data);
        reqData.put("version", "1.0");
        reqData.put("cert_sn", config.getCertSn());
        reqData.put("mch_id", config.getMchID());
        reqData.put("nonce_str", WXPayUtil.generateNonceStr());
        reqData.put("account_number", rsaEncrypt( reqData.get("account_number") ) );
        reqData.put("sign_type", WXPayConstants.HMACSHA256);
        reqData.put("sign", WXPayUtil.generateSignature(reqData, config.getKey(), this.signType));
        String url = WXPayConstants.ModifyBank_URL_SUFFIX;
        String respXml = wxpay.requestWithCert(url, reqData);
        Map<String, String> resData = wxpay.processResponseXml(respXml);
        return resData;
    }
    public Map<String, String> setJsApiPath(String sub_mch_id, String jsapi_path) throws Exception {
        Map<String, String> reqData = new HashMap<String, String>();
        reqData.put("appid", config.getAppID());
        reqData.put("mch_id", config.getMchID());
        reqData.put("sub_mch_id", sub_mch_id);
        reqData.put("jsapi_path", jsapi_path);
        // this is rediculous, must signed by md5
        reqData.put("sign", WXPayUtil.generateSignature(reqData, config.getKey(), SignType.MD5));
        String url = WXPayConstants.SetJsApiPath_URL_SUFFIX;
        String respXml = wxpay.requestWithCert(url, reqData);
        Map<String, String> resData = WXPayUtil.xmlToMap(respXml);
        return resData;
    }
    public Map<String, String> changeMicroContactInfo(Map<String, String> data) throws Exception {
        if( data.get("sub_mch_id") == null ) 
            throw new Exception("sub_mch_id not exist");
        //do not change original data 
        Map<String, String> reqData = new HashMap<String, String>(data);
        reqData.put("version", "1.0");
        reqData.put("cert_sn", config.getCertSn());
        reqData.put("mch_id", config.getMchID());
        reqData.put("nonce_str", WXPayUtil.generateNonceStr());
        if(reqData.get("mobile_phone") != null){
            reqData.put("mobile_phone", rsaEncrypt( reqData.get("mobile_phone") ) );
        }
        if(reqData.get("email") != null){
            reqData.put("email", rsaEncrypt( reqData.get("email") ) );
        }
        reqData.put("sign_type", WXPayConstants.HMACSHA256);
        reqData.put("sign", WXPayUtil.generateSignature(reqData, config.getKey(), this.signType));
        String url = WXPayConstants.ModifyContactInfo_URL_SUFFIX;
        String respXml = wxpay.requestWithCert(url, reqData);
        Map<String, String> resData = wxpay.processResponseXml(respXml);
        return resData;
    }
    public Map<String, String> queryMicroByApplyId(String applyment_id) throws Exception {
        Map<String, String> reqData = new HashMap<String, String>();
        reqData.put("version", "1.0");
        reqData.put("mch_id", config.getMchID());
        reqData.put("nonce_str", WXPayUtil.generateNonceStr());
        reqData.put("applyment_id", applyment_id);
        reqData.put("sign_type", WXPayConstants.HMACSHA256);
        reqData.put("sign", WXPayUtil.generateSignature(reqData, config.getKey(), this.signType));
        String url = WXPayConstants.QueryMICRO_URL_SUFFIX;
        String respXml = wxpay.requestWithCert(url, reqData);
        Map<String, String> resData = wxpay.processResponseXml(respXml);
        logger.info(resData.get("sign_url"));
        String res_json = new Gson().toJson(resData);
        logger.info(res_json);
        return resData;
    }
    public Map<String, String> queryMicroByBusiCode(String business_code) throws Exception {
        Map<String, String> reqData = new HashMap<String, String>();
        reqData.put("version", "1.0");
        reqData.put("mch_id", config.getMchID());
        reqData.put("nonce_str", WXPayUtil.generateNonceStr());
        reqData.put("business_code", business_code);
        reqData.put("sign_type", WXPayConstants.HMACSHA256);
        reqData.put("sign", WXPayUtil.generateSignature(reqData, config.getKey(), this.signType));
        String url = WXPayConstants.QueryMICRO_URL_SUFFIX;
        String respXml = wxpay.requestWithCert(url, reqData);
        Map<String, String> resData = wxpay.processResponseXml(respXml);
        if(resData.get("sign_url") != null) logger.info(resData.get("sign_url"));
        String res_json = new Gson().toJson(resData);
        logger.info(res_json);
        return resData;
    }
    public String upload(File file) throws Exception {
        String media_hash = md5HashCode(new FileInputStream(file));
        Map<String, String> reqData = new HashMap<>();
        reqData.put("mch_id", config.getMchID());
        reqData.put("media_hash", media_hash);
        reqData.put("sign_type", WXPayConstants.HMACSHA256);
        String sign = WXPayUtil.generateSignature(reqData, config.getKey(), this.signType);

        MultipartEntityBuilder multipartEntityBuilder = MultipartEntityBuilder.create();
        multipartEntityBuilder.addTextBody("mch_id", config.getMchID(), ContentType.MULTIPART_FORM_DATA);
        multipartEntityBuilder.addBinaryBody("media", file, ContentType.create("image/jpg"), file.getName());
        multipartEntityBuilder.addTextBody("media_hash", media_hash, ContentType.MULTIPART_FORM_DATA);
        multipartEntityBuilder.addTextBody("sign_type", WXPayConstants.HMACSHA256, ContentType.MULTIPART_FORM_DATA);
        multipartEntityBuilder.addTextBody("sign", sign, ContentType.MULTIPART_FORM_DATA);
        BasicHttpClientConnectionManager connManager;
        // 证书
        char[] password = config.getMchID().toCharArray();
        InputStream certStream = config.getCertStream();
        KeyStore ks = KeyStore.getInstance("PKCS12");
        ks.load(certStream, password);

        // 实例化密钥库 & 初始化密钥工厂
        KeyManagerFactory kmf = KeyManagerFactory.getInstance(KeyManagerFactory.getDefaultAlgorithm());
        kmf.init(ks, password);

        // 创建 SSLContext
        SSLContext sslContext = SSLContext.getInstance("TLS");
        sslContext.init(kmf.getKeyManagers(), null, new SecureRandom());

        SSLConnectionSocketFactory sslConnectionSocketFactory = new SSLConnectionSocketFactory(sslContext,
                new String[] { "TLSv1" }, null, new DefaultHostnameVerifier());

        connManager = new BasicHttpClientConnectionManager(RegistryBuilder.<ConnectionSocketFactory>create()
                .register("http", PlainConnectionSocketFactory.getSocketFactory())
                .register("https", sslConnectionSocketFactory).build(), null, null, null);
        HttpClient httpClient = HttpClientBuilder.create().setConnectionManager(connManager).build();
        String requestUrl = "https://api.mch.weixin.qq.com/secapi/mch/uploadmedia";

        HttpPost httpPost = new HttpPost(requestUrl);
        RequestConfig requestConfig = RequestConfig.custom().setConnectTimeout(10000).setConnectionRequestTimeout(10000)
                .setSocketTimeout(10000).build();
        httpPost.setConfig(requestConfig); //// 这里的Content-type要设置为"multipart/form-data"，否则返回“参数填写有误，请检查后重试”
        httpPost.addHeader(HTTP.CONTENT_TYPE, "multipart/form-data; charset=UTF-8");
        httpPost.addHeader(HTTP.USER_AGENT, WXPayConstants.USER_AGENT + " " + this.config.getMchID());
        httpPost.setEntity(multipartEntityBuilder.build());
        HttpResponse httpResponse = httpClient.execute(httpPost);
        HttpEntity httpEntity = httpResponse.getEntity();
        String result = EntityUtils.toString(httpEntity, "UTF-8");
        logger.info("官方微信--请求返回结果：{}", result);
        return result;
    }

    public static String md5HashCode(InputStream fis) {
        try {
            MessageDigest MD5 = MessageDigest.getInstance("MD5");
            byte[] buffer = new byte[8192];
            int length;
            while ((length = fis.read(buffer)) != -1) {
                MD5.update(buffer, 0, length);
            }
            return new String(Hex.encodeHex(MD5.digest()));
        } catch (Exception e) {
            e.printStackTrace();
            return null;
        }
    }

} // end class
