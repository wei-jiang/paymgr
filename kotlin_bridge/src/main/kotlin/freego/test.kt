package freego

import com.alipay.api.AlipayClient;
import com.alipay.api.DefaultAlipayClient;
import com.alipay.api.AlipayApiException;
import com.alipay.api.response.AlipayTradeWapPayResponse;
import com.alipay.api.request.AlipayTradeWapPayRequest;
import com.alipay.api.request.AlipayTradePrecreateRequest;
import com.alipay.api.domain.AlipayTradeWapPayModel;
import com.alipay.api.domain.AlipayTradeCreateModel;

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

    fun precreate(json: String):String {
        val alipayClient = DefaultAlipayClient(
            URL, APP_ID, APP_PRIVATE_KEY, FORMAT, CHARSET, ALIPAY_PUBLIC_KEY, SIGNTYPE); //获得初始化的AlipayClient
        val request = AlipayTradePrecreateRequest();//创建API对应的request类
        request.putOtherTextParam("app_auth_token", TOKEN);
        request.putOtherTextParam("notify_url", notify_url);
        request.setBizContent( json );//设置业务参数
        val response = alipayClient.execute(request);
        return response.getBody()
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
    
    var data = HashMap<String, String>();
    val extend_params = HashMap<String, String>()
    extend_params.put("sys_service_provider_id", "2088621170920613");
    data.put("total_amount", "0.01");
    data.put("out_trade_no", "20150320010101002222");
    data.put("subject", "Iphone6 16G");
    data.put("store_id", "NJ_001");
    data.put("timeout_express", "90m");
    data.put("extend_params", gson.toJson(extend_params));
    val oi = OrderInfo()
    val res = AliPay().precreate( gson.toJson( oi ) )
    println(res)
    
}
