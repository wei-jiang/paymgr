package freego;


import com.github.wxpay.sdk.WXPay;

import java.util.HashMap;
import java.util.Map;

public class WXPayWrapper {

    public static String do_unifiedOrder() throws Exception {

        MyConfig config = new MyConfig();
        WXPay wxpay = new WXPay(config);
        String ret = "FAIL";
        Map<String, String> data = new HashMap<String, String>();
        data.put("body", "这是一个测试商品from kotlinֵ+nodejs");
        data.put("out_trade_no", "2016090910595900000012");
        data.put("device_info", "");
        data.put("fee_type", "CNY");
        data.put("total_fee", "1");
        data.put("sub_mch_id", "1411994302");
        data.put("spbill_create_ip", "123.12.12.123");
        data.put("notify_url", "http://www.example.com/wxpay/notify");
        data.put("trade_type", "NATIVE");  
        data.put("product_id", "12");

        try {
            Map<String, String> resp = wxpay.unifiedOrder(data);
            System.out.println(resp);
            ret = resp.get("result_code");
        } catch (Exception e) {
            e.printStackTrace();
        }
        return ret;
    }
    public static String do_micropay() throws Exception {

        MyConfig config = new MyConfig();
        WXPay wxpay = new WXPay(config);
        String ret = "FAIL";
        Map<String, String> data = new HashMap<String, String>();
        data.put("body", "这是一个测试商品from kotlinֵ+nodejs");
        data.put("out_trade_no", "2016090910595900000013");
        data.put("device_info", "");
        data.put("fee_type", "CNY");
        data.put("total_fee", "1");
        data.put("sub_mch_id", "1411994302");
        data.put("spbill_create_ip", "123.12.12.123");

        data.put("auth_code", "135209516359420005");  

        try {
            Map<String, String> resp = wxpay.microPay(data);
            System.out.println(resp);
            ret = resp.get("result_code");
        } catch (Exception e) {
            e.printStackTrace();
        }
        return ret;
    }
}