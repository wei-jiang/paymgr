import Loki from 'lokijs';

import LokiIndexedAdapter from 'lokijs/src/loki-indexed-adapter';
const idbAdapter = new LokiIndexedAdapter();
let db;

//export promise?
export default new Promise((resolve, reject) => {
    if (db) {
        resolve(db);
    } else {
        let bazaarDB = new Loki("bazaar.db", {
            adapter: idbAdapter,
            autoload: true,
            autoloadCallback: () => {
                db = {
                    products: bazaarDB.getCollection("product") ? bazaarDB.getCollection("product") : bazaarDB.addCollection("product"),
                    chat_log: bazaarDB.getCollection("chat_log") ? bazaarDB.getCollection("chat_log") : bazaarDB.addCollection("chat_log"),
                    // orders: bazaarDB.getCollection("orders") ? bazaarDB.getCollection("orders") : bazaarDB.addCollection("orders"),
                    gestures: bazaarDB.getCollection("gestures") ? bazaarDB.getCollection("gestures") : bazaarDB.addCollection("gestures"),
                    notification: bazaarDB.getCollection("notification") ? bazaarDB.getCollection("notification") : bazaarDB.addCollection("notification"),
                    scripts: bazaarDB.getCollection("scripts") ? bazaarDB.getCollection("scripts") : bazaarDB.addCollection("scripts")
                }
                resolve(db);
            },
            autosave: true,
            autosaveInterval: 1000
        });
    }
})