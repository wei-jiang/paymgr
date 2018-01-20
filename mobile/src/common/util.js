import Noty from 'noty'
import _ from 'lodash';
import moment from 'moment';


function show_noty(msg) {
    new Noty({
        layout: 'center',
        timeout: 3000,
        text: msg
    }).show();
}
function show_confirm(msg, yes, no) {
    let n = new Noty({
        text: msg,
        buttons: [
            Noty.button('确定', 'btn btn-success', function () {
                yes && yes();
            }, { id: 'button1', 'data-status': 'ok' }),

            Noty.button('取消', 'btn btn-error', function () {
                no && no();
                n.close();
            })
        ]
    }).show();
}

export default {
    show_noty,
    show_confirm
}