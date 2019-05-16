const sqlite = require('sqlite');
const crypto = require("crypto");
const uuidv1 = require('uuid/v1');
const _ = require('lodash');
const credential = require('../secret')
class DB {
	constructor() {
        _.bindAll(this, [
            'open', 'init', 'flush_unpaid', 
            'insert_po', 'get_po_by_oid',
            'del_po_by_oid', 'insert_order', 'chg_po_to_paid'
        ]);
        evt.do('db_open', this.open);
        evt.do('db_insert_po', this.insert_po);
        evt.do('db_get_po_by_oid', this.get_po_by_oid);
        evt.do('db_del_po_by_oid', this.del_po_by_oid);
        evt.do('db_insert_order', this.insert_order);
        evt.do('db_chg_po_to_paid', this.chg_po_to_paid);
    }
    async open(){
        this.db = await sqlite.open(credential.db_name);
        await this.db.run( 'PRAGMA journal_mode = WAL;' );
        await this.init();
        this.flush_unpaid();
    }
    async init(){
        await Promise.all([
            this.db.run(
            `CREATE TABLE IF NOT EXISTS merch 
            (_id INTEGER PRIMARY KEY, 
                name TEXT, 
                wx_id TEXT, 
                aly_id TEXT,
                ali_auth_token TEXT
            )`),
            this.db.run(`
            CREATE TABLE IF NOT EXISTS orders 
            (_id INTEGER PRIMARY KEY, 
                body TEXT, 
                sub_mch_id TEXT, 
                out_trade_no TEXT,
                total_fee INTEGER,
                state TEXT DEFAULT '已支付',
                spbill_create_ip TEXT,
                trade_type TEXT,
                time_begin TEXT,
                time_end TEXT DEFAULT (datetime('now', 'localtime'))
            )`),
            this.db.run(`
            CREATE TABLE IF NOT EXISTS pending_orders
            (_id INTEGER PRIMARY KEY, 
                cli_id TEXT,
                notify_url TEXT,
                body TEXT,             
                sub_mch_id TEXT, 
                out_trade_no TEXT,
                total_fee INTEGER,
                status TEXT DEFAULT 'unpaid',
                spbill_create_ip TEXT,
                trade_type TEXT,
                time_begin TEXT DEFAULT (datetime('now', 'localtime'))
            )`),
            this.db.run(`
            CREATE TABLE IF NOT EXISTS seller 
            (_id INTEGER PRIMARY KEY, 
                merchant_name TEXT, 
                merchant_shortname TEXT, 
                recipient_name TEXT,
                recipient_idcardno TEXT,
                recipient_wechatid TEXT,
                business TEXT,
                merchant_gbaddress TEXT,
                merchant_detailaddress TEXT,
                payee_account TEXT
            )`)
        ]);
    }
    async flush_unpaid(){
        // console.log('flush_unpaid()');
        await this.db.run(`DELETE FROM pending_orders WHERE time_begin <= datetime('now', 'localtime', '-60 minutes')`)
        setTimeout(this.flush_unpaid, 10000);
    }
    async insert_order(o){
        // console.log('insert_po(po)', po);
        await this.db.run(`INSERT INTO orders 
                        (body, sub_mch_id, out_trade_no, total_fee, spbill_create_ip, trade_type, time_begin) 
                        VALUES(?,?,?,?,?,?,?)`,
                        o.body, o.sub_mch_id, o.out_trade_no, o.total_fee, o.spbill_create_ip, o.trade_type, o.time_begin);
    }
    async insert_po(po){
        // console.log('insert_po(po)', po);
        await this.db.run(`INSERT INTO pending_orders 
                        (cli_id, body, sub_mch_id, out_trade_no, total_fee, spbill_create_ip, trade_type) 
                        VALUES('${po.cli_id}','${po.body}','${po.sub_mch_id}','${po.out_trade_no}','${po.total_fee}','${po.spbill_create_ip}','${po.trade_type}')`);
    }
    async get_po_by_oid(order_id){
        return await this.db.get('SELECT * FROM pending_orders WHERE out_trade_no = ?', order_id);
    }
    async del_po_by_oid(order_id){
        await this.db.run('DELETE FROM pending_orders WHERE out_trade_no = ?', order_id);
    }
    async chg_po_to_paid(order_id){
        await this.db.run('UPDATE pending_orders SET status = ? WHERE out_trade_no = ?', 'paid', order_id);
    }
}
module.exports = new DB();