import Loki from 'lokijs';

import LokiIndexedAdapter from 'lokijs/src/loki-indexed-adapter';
const idbAdapter = new LokiIndexedAdapter();
let db;

//export promise?
export default new Promise((resolve, reject) => {
    if (db) {
        resolve(db);
    } else {
        let freegoDB = new Loki("freego.db", {
            adapter: idbAdapter,
            autoload: true,
            autoloadCallback: () => {
                db = {
                    orders: freegoDB.getCollection("orders") ? freegoDB.getCollection("orders") : freegoDB.addCollection("orders")
                }
                resolve(db);
            },
            autosave: true,
            autosaveInterval: 1000
        });
    }
})