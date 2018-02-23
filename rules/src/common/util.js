import Noty from 'noty'
import _ from 'lodash';
import moment from 'moment';
const md5 = require('./md5')

function download_text(filename, text) {
    let element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
    element.setAttribute('download', filename);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
}
function download_csv(filename, text) {
    let element = document.createElement('a');
    element.setAttribute('href', 'data:text/csv;charset=utf-8,%EF%BB%BF' + encodeURIComponent(text));
    element.setAttribute('download', filename);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
}
function download_csv1(filename, text) {
    let element = document.createElement('a');
    let BOM = "\uFEFF"; 
    text = BOM + text;
    element.setAttribute('href', 'data:text/csv;charset=utf-8,' + encodeURIComponent(text));
    element.setAttribute('download', filename);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
}

function download_url(url) {
    let element = document.createElement('a');
    element.setAttribute('href', url);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
}
function show_noty(msg) {
    new Noty({
        layout: 'center',
        timeout: 3000,
        text: msg
    }).show();
}
function show_confirm(msg, yes, no) {
    let n = new Noty({
        layout: 'center',
        text: msg,
        buttons: [
            Noty.button('确定', 'btn btn-success', function () {
                yes && yes();
                n.close();
            }, { id: 'button1', 'data-status': 'ok' }),

            Noty.button('取消', 'btn btn-error', function () {
                no && no();
                n.close();
            })
        ]
    }).show();
}
//returns a 32 bit integer, must same as server's
function hash_str(str){  
    let hash = md5(str)
    return hash;
}
export default {
    download_url,
    download_csv,
    download_csv1,
    download_text,
    show_noty,
    show_confirm,
    hash_str
}