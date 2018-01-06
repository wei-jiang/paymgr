import Noty from 'noty'


function download_text(filename, text) {
    let element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
    element.setAttribute('download', filename);
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
    download_text,
    show_noty,
    show_confirm
}