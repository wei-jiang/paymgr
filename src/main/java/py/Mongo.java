package py;

import com.mongodb.BasicDBObject;
import com.mongodb.Block;
import com.mongodb.ConnectionString;
import com.mongodb.client.MongoClients;
import com.mongodb.client.MongoClient;
import com.mongodb.client.MongoDatabase;
import com.mongodb.ServerAddress;
import com.mongodb.client.MongoCollection;
import com.mongodb.client.gridfs.*;
import com.mongodb.client.gridfs.model.*;
import com.mongodb.client.model.IndexOptions;
import com.mongodb.client.model.Indexes;
import com.mongodb.client.model.UpdateOptions;
import com.mongodb.client.MongoCursor;
import com.mongodb.client.result.DeleteResult;
import com.mongodb.client.result.UpdateResult;
import static com.mongodb.client.model.Updates.*;
import static com.mongodb.client.model.Filters.*;
import org.bson.Document;
import org.bson.types.ObjectId;



import java.io.*;
import java.util.*;
import java.util.concurrent.TimeUnit;
import java.nio.file.Files;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.nio.charset.StandardCharsets;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class Mongo {
    private static final Logger logger = LoggerFactory.getLogger(Mongo.class);
    private MongoCollection<Document> mch_col, pending_col, order_col, media_col, veri_col, noty_col;

    public Mongo() {
        MongoClient mongoClient = MongoClients.create(Secret.db_url);
        MongoDatabase database = mongoClient.getDatabase(Secret.db_name);
        mch_col = database.getCollection("micro_mch");
        pending_col = database.getCollection("pending");
        order_col = database.getCollection("order");
        media_col = database.getCollection("media");
        veri_col = database.getCollection("verification");
        noty_col = database.getCollection("noty");
        pending_col.createIndex(Indexes.ascending("createdAt"), new IndexOptions().expireAfter(30L, TimeUnit.MINUTES));
        veri_col.createIndex(Indexes.ascending("createdAt"), new IndexOptions().expireAfter(5L, TimeUnit.MINUTES));
        noty_col.createIndex(Indexes.ascending("createdAt"), new IndexOptions().expireAfter(7L, TimeUnit.DAYS));
        logger.info("连接mongodb成功");
    }

    Document insertPendingOrder(Map<String, String> data){
        Document doc = new Document();
        for (Map.Entry<String, String> entry : data.entrySet()) {
            doc.append(entry.getKey(), entry.getValue());
        }       
        String now = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"));
        doc.append("createdAt", new Date()).append("time_start", now);
        pending_col.insertOne(doc);
        return doc;
    }
    Document insertSuccessOrder(Map<String, String> data){
        Document doc = new Document();
        for (Map.Entry<String, String> entry : data.entrySet()) {
            doc.append(entry.getKey(), entry.getValue());
        }
        order_col.insertOne(doc);
        return doc;
    }
    Document insertSuccessOrder(Document doc){
        String now = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"));
        doc.append("time_end", now);
        order_col.insertOne(doc);
        return doc;
    }
    public Document findOrderByFields(Map<String, String> fds) {
        BasicDBObject criteria = new BasicDBObject();
        for (Map.Entry<String, String> entry : fds.entrySet()) {
            criteria.append(entry.getKey(), entry.getValue());
        }
        // mch_col.updateOne(eq("_id", new ObjectId(_id)), new Document("$set", doc));
        return order_col.find(criteria).first();       
    }
    Document findOrderByOid( String out_trade_no ) {
        Document o = order_col.find( eq("out_trade_no", out_trade_no) ).first();
        return o;
    }
    Document findPoByOid( String out_trade_no ) {
        Document o = pending_col.find( eq("out_trade_no", out_trade_no) ).first();
        return o;
    }
    DeleteResult delPoByOid(String out_trade_no){
        return pending_col.deleteOne( eq("out_trade_no", out_trade_no) );
    }
    UpdateResult updatePoStatus( String out_trade_no, String s ){
        String now = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"));
        return pending_col.updateOne(eq("out_trade_no", out_trade_no), new Document("$set", new Document("status", s).append("time_end", now) ));
    }
    UpdateResult updateRefundOrder(String out_trade_no, int amount){
        var ur = order_col.updateOne(eq("out_trade_no", out_trade_no), inc("refund_fee", amount) );
        return ur;
    }
    List<Document> findPendingPaid(String cli_id ){
        List<Document> paid_o = new ArrayList<>();
        MongoCursor<Document> cursor = pending_col.find( and( eq("cli_id", cli_id), eq("status", "paid")) ).iterator();
        try {
            while (cursor.hasNext()) {
                paid_o.add( cursor.next() );
            }
        } finally {
            cursor.close();
        }
        return paid_o;
    }
    public Document insertMedia(Map<String, String> media){
        Document doc = new Document();
        for (Map.Entry<String, String> entry : media.entrySet()) {
            doc.append(entry.getKey(), entry.getValue());
        }
        media_col.insertOne(doc);
        return doc;
    }
    // public String getOrder(){
    //     Document myDoc = mch_col.find().first();
    //     logger.info(myDoc.toJson());
    //     return myDoc.toJson();
    // }
    // noty begin
    DeleteResult delNotyBy_id(String _id){
        return noty_col.deleteOne( eq("_id", new ObjectId(_id)) );
    }
    DeleteResult delNotyByCli_id(String cli_id){
        return noty_col.deleteMany( eq("cli_id", cli_id) );
    }
    public List<Document> findNotyByFields(Map<String, String> fds) {
        BasicDBObject criteria = new BasicDBObject();
        for (Map.Entry<String, String> entry : fds.entrySet()) {
            criteria.append(entry.getKey(), entry.getValue());
        }
        List<Document> notys = new ArrayList<>();
        MongoCursor<Document> cursor = noty_col.find(criteria).iterator();      
        try {
            while (cursor.hasNext()) {
                notys.add( cursor.next() );
            }
        } finally {
            cursor.close();
        }
        return notys; 
    }
    public List<Document> findNotyByField(String fieldName, String fieldValue){
        List<Document> notys = new ArrayList<>();
        MongoCursor<Document> cursor = noty_col.find( eq(fieldName, fieldValue) ).iterator();
        try {
            while (cursor.hasNext()) {
                notys.add( cursor.next() );
            }
        } finally {
            cursor.close();
        }
        return notys;
    }
    public Document insertNotyMsg(Document doc){
        // content, dt, op, payload
        doc.append("createdAt", new Date());
        noty_col.insertOne(doc);
        return doc;
    }
    // noty end
    public void insertVeriCode(String email, String code){
        Document doc_to_be_find = new Document("email", email);
        Document doc = new Document("email", email).append("code", code).append("createdAt", new Date());
        veri_col.updateOne(doc_to_be_find, new Document("$set", doc ), new UpdateOptions().upsert(true));
    }
    public Boolean checkVeriCodeDel(String email, String code){
        Document doc = veri_col.findOneAndDelete( and( eq("email", email), eq("code", code) ) );
        return doc != null;
    }
    public Boolean checkVeriCode(String email, String code){
        Document doc = veri_col.find( and( eq("email", email), eq("code", code) ) ).first();
        return doc != null;
    }
    public Boolean emailExist(String email){
        Document doc = mch_col.find(eq("contact_email", email)).first();
        return doc != null;
    }
    public Document findMchBy_id(String _id){
        Document doc = mch_col.find(eq("_id", new ObjectId(_id))).first();
        return doc;
    }
    public List<Document> findMchsByStatus(String status){
        // draft -> AUDITING -> TO_BE_SIGNED -> FINISH
        List<Document> mchs = new ArrayList<>();
        MongoCursor<Document> cursor = mch_col.find( eq("status", status) ).iterator();
        try {
            while (cursor.hasNext()) {
                mchs.add( cursor.next() );
            }
        } finally {
            cursor.close();
        }
        return mchs;
    }
    public Document findMchByField(String fieldName, String fieldValue){
        Document doc = mch_col.find(eq(fieldName, fieldValue)).first();
        return doc;
    }
    public Document insertMch(Map<String, String> mch){
        Document doc = new Document();
        for (Map.Entry<String, String> entry : mch.entrySet()) {
            doc.append(entry.getKey(), entry.getValue());
        }
        mch_col.insertOne(doc);
        return doc;
    }
    public Document updateMch(String _id, Map<String, String> mch) {
        Document doc = new Document();
        for (Map.Entry<String, String> entry : mch.entrySet()) {
            doc.append(entry.getKey(), entry.getValue());
        }
        // mch_col.updateOne(eq("_id", new ObjectId(_id)), new Document("$set", doc));
        doc = mch_col.findOneAndUpdate(eq("_id", new ObjectId(_id)), new Document("$set", doc));       
        return doc;
    }
}