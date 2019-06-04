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
                var token = Util.signToken( Map.of( "email", doc.get("contact_email").toString() ) );
                order.put("token", token);
            }catch (Exception e) {
                // unlikely
                e.printStackTrace();
            }
            order.put("type", "reg_fee");
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