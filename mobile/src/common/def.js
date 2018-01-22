const PAY_TYPE = {
    WX_GZH:     0b00000001,
    WX_ZS:      0b00000010,
    WX_FS:      0b00000100,
    WX_H5:      0b00001000,
    ALI_WAP:    0b00010000,
    ALI_ZS:     0b00100000,
    ALI_FS:     0b01000000,
    ALI_PAGE:   0b10000000,
    WX:         0x0F,
    ALI:        0xF0,
}
function pay_caption(pay_type) {
    let cap = ''
    switch (pay_type) {
        case PAY_TYPE.WX_GZH:
            cap = '微信公众号'
            break
        case PAY_TYPE.WX_ZS:
            cap = '微信正扫'
            break
        case PAY_TYPE.WX_FS:
            cap = '微信反扫'
            break
        case PAY_TYPE.WX_H5:
            cap = '微信h5'
            break
        case PAY_TYPE.ALI_WAP:
            cap = '阿里手机'
            break
        case PAY_TYPE.ALI_ZS:
            cap = '阿里正扫'
            break    
        case PAY_TYPE.ALI_FS:
            cap = '阿里反扫'
            break
        case PAY_TYPE.ALI_PAGE:
            cap = '阿里网站'
            break      
    }
    return cap
}
function get_pay_caption(pay_type) {
    const mask = 1
    let cap = ''
    for(let i = 0; i < 8; ++i){
        const tv = (mask << i) & pay_type
        if( tv ){
            cap += pay_caption(tv) + ' '
        }
    }
    return cap
}

module.exports = {
    PAY_TYPE,
    pay_caption,
    get_pay_caption
}