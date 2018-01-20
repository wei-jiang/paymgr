package freego

import com.alipay.api.AlipayClient;
import com.alipay.api.DefaultAlipayClient;
import com.alipay.api.AlipayApiException;
import com.alipay.api.response.AlipayTradeWapPayResponse;
import com.alipay.api.request.AlipayTradeWapPayRequest;
import com.alipay.api.request.AlipayTradePrecreateRequest;
import com.alipay.api.request.AlipayTradePayRequest;
import com.alipay.api.request.AlipayTradeQueryRequest;
import com.alipay.api.request.AlipayTradeCancelRequest;
import com.alipay.api.request.AlipayTradeRefundRequest;
import com.alipay.api.request.AlipayOpenAuthTokenAppRequest;

import com.alipay.api.domain.AlipayTradeWapPayModel;
import com.alipay.api.domain.AlipayTradeCreateModel;
import com.alipay.api.internal.util.AlipaySignature;
import java.util.HashMap;
import java.util.Map;
import com.google.gson.Gson;

fun getGreeting(): String {
    val words = mutableListOf<String>()
    words.add("Hello,")
    words.add("world!")

    return words.joinToString(separator = " ")
}
class A() : MyClass(){
    override fun do_thing() {
        super.do_thing()
        println("in kotlin do_thing()")
    }
}
class AliPay {
    //获得初始化的AlipayClient
    val alipayClient = DefaultAlipayClient( URL, APP_ID, APP_PRIVATE_KEY, FORMAT, CHARSET, ALIPAY_PUBLIC_KEY, SIGNTYPE); 
    fun precreate(json: String, auth_token: String):String {
        val request = AlipayTradePrecreateRequest();//创建API对应的request类
        request.putOtherTextParam("app_auth_token", auth_token);
        request.putOtherTextParam("notify_url", notify_url);
        request.setBizContent( json );//设置业务参数
        val response = alipayClient.execute(request);
        return response.getBody()
    }
    fun trade_pay(json: String, auth_token: String):String {
        val request = AlipayTradePayRequest();
        request.putOtherTextParam("app_auth_token", auth_token);
        request.setBizContent( json );
        val response = alipayClient.execute(request);
        return response.getBody()
    }
    fun wap_pay(json: String, auth_token: String, return_url: String, notify_url: String):String {
        val request = AlipayTradeWapPayRequest();
        request.putOtherTextParam("app_auth_token", auth_token);
        request.setReturnUrl(return_url);
        request.setNotifyUrl(notify_url);//在公共参数中设置回跳和通知地址
        request.setBizContent( json );
        val response = alipayClient.pageExecute(request);
        return response.getBody()
    }
    fun get_auth_token(json: String):String {
        val request = AlipayOpenAuthTokenAppRequest();
        request.setBizContent( json );
        val response = alipayClient.execute(request);
        return response.getBody()
    }
    fun trade_query(json: String, auth_token: String):String {
        val request = AlipayTradeQueryRequest();
        request.putOtherTextParam("app_auth_token", auth_token);
        request.setBizContent( json );
        val response = alipayClient.execute(request);
        return response.getBody()
    }
    fun trade_cancel(json: String, auth_token: String):String {
        val request = AlipayTradeCancelRequest();
        request.putOtherTextParam("app_auth_token", auth_token);
        request.setBizContent( json );
        val response = alipayClient.execute(request);
        return response.getBody()
    }
    fun trade_refund(json: String, auth_token: String):String {
        val request = AlipayTradeRefundRequest();
        request.putOtherTextParam("app_auth_token", auth_token);
        request.setBizContent( json );
        val response = alipayClient.execute(request);
        return response.getBody()
    }
    fun verify(json: String):Boolean{
        val gson = Gson();
        var data = HashMap<String, String>()
        data = gson.fromJson(json, data::class.java)
        return AlipaySignature.rsaCheckV1(data, ALIPAY_PUBLIC_KEY, CHARSET, SIGNTYPE)
    }
}


class OrderInfo{
    class ExtendParams{
        val sys_service_provider_id = "2088621170920613"
    }
    val total_amount = 0.01
    val out_trade_no = "20150320010101002222"
    val subject = "Iphone6 16G"
    val extend_params = ExtendParams()
}
fun main(args: Array<String>) {
    val gson = Gson();
    val test = "{\"a\":3}"
    var data = HashMap<String, String>();
    data = gson.fromJson(test, data::class.java)
    // val extend_params = HashMap<String, String>()
    // extend_params.put("sys_service_provider_id", "2088621170920613");
    // data.put("total_amount", "0.01");
    // data.put("out_trade_no", "20150320010101002222");
    // data.put("subject", "Iphone6 16G");
    // data.put("store_id", "NJ_001");
    // data.put("timeout_express", "90m");
    // data.put("extend_params", gson.toJson(extend_params));
    // val oi = OrderInfo()
    // val res = AliPay().precreate( gson.toJson( oi ) )
    println( data.get("a") )
    
}
