import Noty from 'noty';

class Util {
    show_success_top(text){
        new Noty({ type: 'success', layout: 'top', text }).show();
    }
    show_alert_top(text){
        new Noty({ layout: 'top', text }).show();
    }
    show_alert_top_tm(text, timeout = 3000){
        new Noty({ timeout, layout: 'top', text }).show();
    }
    show_warn_top(text){
        new Noty({ type: 'warning', layout: 'top', text }).show();
    }
    show_error_top(text){
        new Noty({ type: 'error', layout: 'top', text }).show();
    }
}

export default new Util;