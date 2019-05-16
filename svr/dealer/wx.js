

const request = require('request');
const xml2js  = require('xml2js');
const uuid    = require('uuid');
const crypto = require("crypto");

const _DEFAULT_TIMEOUT = 10*1000; // ms

const WXPayConstants = {

  // SUCCESS, FAIL
  SUCCESS : "SUCCESS",
  FAIL : "FAIL",

  // 签名类型
  SIGN_TYPE_HMACSHA256 : "HMAC-SHA256",
  SIGN_TYPE_MD5 : "MD5",

  // 字段
  FIELD_SIGN : "sign",
  FIELD_SIGN_TYPE : "sign_type",

  // URL
  MICROPAY_URL : "https://api.mch.weixin.qq.com/pay/micropay",
  UNIFIEDORDER_URL : "https://api.mch.weixin.qq.com/pay/unifiedorder",
  ORDERQUERY_URL : "https://api.mch.weixin.qq.com/pay/orderquery",
  REVERSE_URL : "https://api.mch.weixin.qq.com/secapi/pay/reverse",
  CLOSEORDER_URL : "https://api.mch.weixin.qq.com/pay/closeorder",
  REFUND_URL : "https://api.mch.weixin.qq.com/secapi/pay/refund",
  REFUNDQUERY_URL : "https://api.mch.weixin.qq.com/pay/refundquery",
  DOWNLOADBILL_URL : "https://api.mch.weixin.qq.com/pay/downloadbill",
  REPORT_URL : "https://api.mch.weixin.qq.com/payitil/report",
  SHORTURL_URL : "https://api.mch.weixin.qq.com/tools/shorturl",
  AUTHCODETOOPENID_URL : "https://api.mch.weixin.qq.com/tools/authcodetoopenid",
  ADDSELLER_URL : "https://api.mch.weixin.qq.com/secapi/mch/submchmanage?action=add",

  // Sandbox URL
  SANDBOX_MICROPAY_URL : "https://api.mch.weixin.qq.com/sandboxnew/pay/micropay",
  SANDBOX_UNIFIEDORDER_URL : "https://api.mch.weixin.qq.com/sandboxnew/pay/unifiedorder",
  SANDBOX_ORDERQUERY_URL : "https://api.mch.weixin.qq.com/sandboxnew/pay/orderquery",
  SANDBOX_REVERSE_URL : "https://api.mch.weixin.qq.com/sandboxnew/secapi/pay/reverse",
  SANDBOX_CLOSEORDER_URL : "https://api.mch.weixin.qq.com/sandboxnew/pay/closeorder",
  SANDBOX_REFUND_URL : "https://api.mch.weixin.qq.com/sandboxnew/secapi/pay/refund",
  SANDBOX_REFUNDQUERY_URL : "https://api.mch.weixin.qq.com/sandboxnew/pay/refundquery",
  SANDBOX_DOWNLOADBILL_URL : "https://api.mch.weixin.qq.com/sandboxnew/pay/downloadbill",
  SANDBOX_REPORT_URL : "https://api.mch.weixin.qq.com/sandboxnew/payitil/report",
  SANDBOX_SHORTURL_URL : "https://api.mch.weixin.qq.com/sandboxnew/tools/shorturl",
  SANDBOX_AUTHCODETOOPENID_URL : "https://api.mch.weixin.qq.com/sandboxnew/tools/authcodetoopenid",
  SANDBOX_ADDSELLER_URL : "https://api.mch.weixin.qq.com/sandboxnew/secapi/mch/submchmanage?action=add",
};

const WXPayUtil = {

  /**
   * XML 字符串转换成 object
   *
   * @param {string} xmlStr
   * @returns {Promise}
   */
  xml2obj(xmlStr) {
    // console.log(xmlStr);
    return new Promise( (resolve, reject)=>{
      var parseString = xml2js.parseString;
      parseString(xmlStr, (err, result)=> {
        if (err) {
          reject(err);
        }
        else {
          // console.log(result);
          var data = result['xml'];
          var newData = {};
          Object.keys(data).forEach((key, idx)=> {
            if (data[key].length > 0)
              newData[key] = data[key][0];
          });
          resolve(newData);
        }
      });
    });
  },

  /**
   * object 转换成 XML 字符串
   *
   * @param {object} obj
   * @returns {Promise}
   */
  obj2xml(obj) {
    return new Promise( (resolve, reject)=> {
      var builder = new xml2js.Builder({cdata: true, rootName:'xml'});
      try {
        var xmlStr = builder.buildObject(obj);
        resolve(xmlStr);
      } catch (err) {
        reject(err);
      }
    });
  },

  /**
   * 生成签名
   *
   * @param {object} data
   * @param {string} key API key
   * @param {string} signType
   * @returns {string}
   */
  generateSignature(data, key, signType) {
    signType = signType || WXPayConstants.SIGN_TYPE_HMACSHA256;
    if (signType !== WXPayConstants.SIGN_TYPE_MD5 && signType !== WXPayConstants.SIGN_TYPE_HMACSHA256) {
      throw new Error("Invalid signType: " + signType);
    }
    var combineStr = '';
    var ks = Object.keys(data).sort();
    for (var i=0; i<ks.length; ++i) {
      var k = ks[i];
      if( k !== WXPayConstants.FIELD_SIGN  && data[k] ) {
        var v = '' + data[k];
        if (v.length > 0) {
          combineStr = combineStr + k + '=' + v + '&';
        }
      }
    }
    if (combineStr.length == 0) {
      throw new Error("There is no data to generate signature");
    }
    else {
      combineStr = combineStr + 'key=' + key;
      if (signType === WXPayConstants.SIGN_TYPE_MD5) {
        return this.md5(combineStr);
      }
      else if (signType === WXPayConstants.SIGN_TYPE_HMACSHA256) {
        return this.hmacsha256(combineStr, key);
      }
      else {
        throw new Error("Invalid signType: " + signType);
      }
    }
  },

  /**
   * 验证签名
   *
   * @param {object} data
   * @param {string} key API key
   * @param {string} signType
   * @returns {boolean}
   */
  isSignatureValid(data, key, signType) {
    signType = signType || WXPayConstants.SIGN_TYPE_HMACSHA256;
    if (data === null || typeof data !== 'object') {
      return false;
    }
    else if (!data[WXPayConstants.FIELD_SIGN]) {
      return false;
    }
    else {
      return data[WXPayConstants.FIELD_SIGN] === this.generateSignature(data, key, signType);
    }
  },

  /**
   * 带有签名的 XML 数据
   *
   * @param {object} data
   * @param {string} key
   * @param {string} signType
   * @returns {Promise}
   */
  generateSignedXml(data, key, signType) {
    var clonedDataObj = JSON.parse(JSON.stringify(data));
    clonedDataObj[WXPayConstants.FIELD_SIGN] = this.generateSignature(data, key, signType);
    return new Promise( (resolve, reject)=> {
      WXPayUtil.obj2xml(clonedDataObj)
      .then( (xmlStr)=> {
        resolve(xmlStr);
      }).catch( (err)=> {
        reject(err);
      });
    });
  },

  /**
   * 生成随机字符串
   *
   * @returns {string}
   */
  generateNonceStr() {
    return uuid.v4().replace(/\-/g, "");
  },

  /**
   * 得到 MD5 签名结果
   *
   * @param {string} source
   * @returns {string}
   */
  md5(data) {
    return crypto.createHash('md5').update(data).digest("hex").toUpperCase();
  },

  /**
   * 得到 HMAC-SHA256 签名结果
   *
   * @param {string} source
   * @param {string} key
   * @returns {string}
   */
  hmacsha256(source, key) {
    return crypto.createHmac("sha256", key).update(source, 'utf8').digest("hex").toUpperCase();
  }

};

/**
 * WXPay对象
 *
 * @param {object} config
 * @constructor
 */
class WXPay {
  constructor(config) {
    const options = ['appId', 'mchId', 'key', 'certFileContent', 'caFileContent'];
    for (let i=0; i<options.length; ++i) {
      if (!config[options[i]]) {
        throw new Error('Please check '+options[i] + ' in config');
      }
    }
    this.APPID = config['appId'];
    this.MCHID = config['mchId'];
    this.KEY = config['key'];
    this.CERT_FILE_CONTENT = config['certFileContent'];
    this.CA_FILE_CONTENT = config['caFileContent'];

    this.TIMEOUT = config['timeout'] || _DEFAULT_TIMEOUT;
    this.SIGN_TYPE = config['signType'] || WXPayConstants.SIGN_TYPE_HMACSHA256;
    this.USE_SANDBOX = config['useSandbox'] || false;
  }
  /**
   * 处理 HTTP 请求的返回信息（主要是做签名验证），并将 xml 转换为 object
   *
   * @param {string} respXml
   * @returns {Promise}
   */
  processResponseXml(respXml) {
    const self = this;
    return new Promise( (resolve, reject)=> {
      WXPayUtil.xml2obj(respXml).then( (respObj)=> {
        var return_code = respObj['return_code'];
        if (return_code) {
          if (return_code === WXPayConstants.FAIL) {
            resolve(respObj);
          }
          else if (return_code === WXPayConstants.SUCCESS) {
            var isValid = self.isResponseSignatureValid(respObj);
            if (isValid) {
              resolve(respObj);
            }
            else {
              reject(new Error('Invalid sign value in XML: ' + respXml));
            }
          }
          else {
            reject(new Error('Invalid return_code in XML: ' + respXml));
          }
        }
        else {
          reject(new Error('no return_code in the response XML: ' + respXml));
        }
      }).catch( (err)=> {
        reject(err);
      });
    });
  }
  /**
   * 请求响应中的签名是否合法
   *
   * @param {object} respData
   * @returns {boolean}
   */
  isResponseSignatureValid(respData) {
    return WXPayUtil.isSignatureValid(respData, this.KEY, this.SIGN_TYPE);
  }
  /**
   * 判断支付结果通知中的sign是否有效。必须有sign字段
   *
   * @param {object} notifyData
   * @returns {boolean}
   */
  isPayResultNotifySignatureValid(notifyData) {
    let signType, signTypeInData = notifyData[WXPayConstants.FIELD_SIGN_TYPE];
    if (!signTypeInData) {
      signType = this.SIGN_TYPE; //WXPayConstants.SIGN_TYPE_HMACSHA256;
    } else {
      signTypeInData = (''+signTypeInData).trim();
      if (signTypeInData.length == 0) {
        signType = WXPayConstants.SIGN_TYPE_HMACSHA256;
      } else if (signTypeInData === WXPayConstants.SIGN_TYPE_MD5) {
        signType = WXPayConstants.SIGN_TYPE_MD5;
      } else if (signTypeInData === WXPayConstants.SIGN_TYPE_HMACSHA256) {
        signType = WXPayConstants.SIGN_TYPE_HMACSHA256;
      } else {
        throw new Error("Invalid sign_type: "+signTypeInData+" in pay result notify");
      }
    }
    return WXPayUtil.isSignatureValid(notifyData, this.KEY, signType);
  }
  /**
   * 向数据中添加appid、mch_id、nonce_str、sign_type、sign
   *
   * @param {object} reqData
   * @returns {object}
   */
  fillRequestData(reqData) {
    const clonedData = JSON.parse(JSON.stringify(reqData));
    clonedData['appid'] = this.APPID;
    clonedData['mch_id'] = this.MCHID;
    clonedData['nonce_str'] = WXPayUtil.generateNonceStr();
    clonedData[WXPayConstants.FIELD_SIGN_TYPE] = this.SIGN_TYPE;
    clonedData[WXPayConstants.FIELD_SIGN] = WXPayUtil.generateSignature(clonedData, this.KEY, this.SIGN_TYPE);
    return clonedData;
  }
  /**
   * HTTP(S) 请求，无证书
   *
   * @param {string} url
   * @param {object} reqData
   * @param {int} timeout
   * @returns {Promise}
   */
  requestWithoutCert(url, reqData, timeout) {
    var self = this;
    return new Promise((resolve, reject)=> {
      var options = {
        url: url,
        timeout: timeout || self.TIMEOUT
      };
      WXPayUtil.obj2xml(reqData).then( (reqXml)=> {
        // console.log('reqXml', reqXml);
        options['body'] = reqXml;
        request.post(options, (error, response, body)=> {
          if(error){
            reject(error);
          }else{
            // console.log('resp: ', body);
            resolve(body);
          }
        });
      }).catch( (err)=> {
        reject(err);
      });
    });
  }
  /**
   * HTTP(S)请求，附带证书，适合申请退款等接口
   *
   * @param {string} url
   * @param {object} reqData
   * @param {int} timeout
   * @returns {Promise}
   */
  requestWithCert(url, reqData, timeout) {
    var self = this;
    return new Promise((resolve, reject)=> {
      var options = {
        url: url,
        timeout: timeout || self.TIMEOUT,
        agentOptions: {
          rejectUnauthorized: false,
          ca: self.CA_FILE_CONTENT,
          pfx: self.CERT_FILE_CONTENT,
          passphrase: self.MCHID
        }
      };
      WXPayUtil.obj2xml(reqData).then( (reqXml)=> {
        options['body'] = reqXml;
        request.post(options, (error, response, body)=> {
          if(error){
            reject(error);
          }else{
            resolve(body);
          }
        });
      }).catch( (err)=> {
        reject(err);
      });
    });
  }
  /**
   * 提交刷卡支付
   *
   * @param {object} reqData
   * @param {int} timeout
   * @returns {Promise}
   */
  microPay(reqData, timeout) {
    var self = this;
    var url = WXPayConstants.MICROPAY_URL;
    if (self.USE_SANDBOX) {
      url = WXPayConstants.SANDBOX_MICROPAY_URL;
    }
    return new Promise( (resolve, reject)=> {
      self.requestWithoutCert(url, self.fillRequestData(reqData), timeout).then( (respXml)=> {
        self.processResponseXml(respXml).then( (respObj)=> {
          resolve(respObj);
        }).catch( (err)=> {
          reject(err);
        });
      }).catch( (err)=> {
        reject(err);
      });
    });
  }
  /**
   * 统一下单
   *
   * @param {object} reqData
   * @param {int} timeout
   * @returns {Promise}
   */
  unifiedOrder(reqData, timeout) {
    let url = WXPayConstants.UNIFIEDORDER_URL;
    if (this.USE_SANDBOX) {
      url = WXPayConstants.SANDBOX_UNIFIEDORDER_URL;
    }
    return new Promise( (resolve, reject)=> {
      this.requestWithoutCert(url, this.fillRequestData(reqData), timeout).then( (respXml)=> {
        this.processResponseXml(respXml).then( (respObj)=> {
          resolve(respObj);
        }).catch((err)=> {
          reject(err);
        });
      }).catch( (err)=> {
        reject(err);
      });
    });
  }
  /**
   * 查询订单
   *
   * @param {object} reqData
   * @param {int} timeout
   * @returns {Promise}
   */
  orderQuery(reqData, timeout) {
    var self = this;
    var url = WXPayConstants.ORDERQUERY_URL;
    if (self.USE_SANDBOX) {
      url = WXPayConstants.SANDBOX_ORDERQUERY_URL;
    }
    return new Promise( (resolve, reject)=> {
      self.requestWithoutCert(url, self.fillRequestData(reqData), timeout).then( (respXml)=> {
        self.processResponseXml(respXml).then( (respObj)=> {
          resolve(respObj);
        }).catch( (err)=> {
          reject(err);
        });
      }).catch( (err)=> {
        reject(err);
      });
    });
  }
  /**
   * 撤销订单, 用于刷卡支付
   *
   * @param {object} reqData
   * @param {int} timeout
   * @returns {Promise}
   */
  reverse(reqData, timeout) {
    var self = this;
    var url = WXPayConstants.REVERSE_URL;
    if (self.USE_SANDBOX) {
      url = WXPayConstants.SANDBOX_REVERSE_URL;
    }
    return new Promise( (resolve, reject)=> {
      self.requestWithCert(url, self.fillRequestData(reqData), timeout).then( (respXml)=> {
        self.processResponseXml(respXml).then( (respObj)=> {
          resolve(respObj);
        }).catch( (err)=> {
          reject(err);
        });
      }).catch( (err)=> {
        reject(err);
      });
    });
  }
  /**
   * 关闭订单
   *
   * @param {object} reqData
   * @param {int} timeout
   * @returns {Promise}
   */
  closeOrder(reqData, timeout) {
    var self = this;
    var url = WXPayConstants.CLOSEORDER_URL;
    if (self.USE_SANDBOX) {
      url = WXPayConstants.SANDBOX_CLOSEORDER_URL;
    }
    return new Promise(function (resolve, reject) {
      self.requestWithoutCert(url, self.fillRequestData(reqData), timeout).then(function (respXml) {
        self.processResponseXml(respXml).then(function (respObj) {
          resolve(respObj);
        }).catch(function (err) {
          reject(err);
        });
      }).catch(function (err) {
        reject(err);
      });
    });
  }
  /**
   * 申请退款
   *
   * @param {object} reqData
   * @param {int} timeout
   * @returns {Promise}
   */
  refund(reqData, timeout) {
    var self = this;
    var url = WXPayConstants.REFUND_URL;
    if (self.USE_SANDBOX) {
      url = WXPayConstants.SANDBOX_REFUND_URL;
    }
    return new Promise(function (resolve, reject) {
      self.requestWithCert(url, self.fillRequestData(reqData), timeout).then(function (respXml) {
        self.processResponseXml(respXml).then(function (respObj) {
          resolve(respObj);
        }).catch(function (err) {
          reject(err);
        });
      }).catch(function (err) {
        reject(err);
      });
    });
  }
  /**
   * 退款查询
   *
   * @param {object} reqData
   * @param {int} timeout
   * @returns {Promise}
   */
  refundQuery(reqData, timeout) {
    var self = this;
    var url = WXPayConstants.REFUNDQUERY_URL;
    if (self.USE_SANDBOX) {
      url = WXPayConstants.SANDBOX_REFUNDQUERY_URL;
    }
    return new Promise(function (resolve, reject) {
      self.requestWithoutCert(url, self.fillRequestData(reqData), timeout).then(function (respXml) {
        self.processResponseXml(respXml).then(function (respObj) {
          resolve(respObj);
        }).catch(function (err) {
          reject(err);
        });
      }).catch(function (err) {
        reject(err);
      });
    });
  }
  /**
   * 下载对账单
   *
   * @param {object} reqData
   * @param {int} timeout
   * @returns {Promise}
   */
  downloadBill(reqData, timeout) {
    var self = this;
    var url = WXPayConstants.DOWNLOADBILL_URL;
    if (self.USE_SANDBOX) {
      url = WXPayConstants.SANDBOX_DOWNLOADBILL_URL;
    }
    return new Promise(function (resolve, reject) {
      self.requestWithoutCert(url, self.fillRequestData(reqData), timeout).then(function (respStr) {
        respStr = respStr.trim();
        if (respStr.startsWith('<')) {  // XML格式，下载出错
          self.processResponseXml(respStr).then(function (respObj) {
            resolve(respObj);
          }).catch(function (err) {
            reject(err);
          });
        }
        else {   // 下载到数据了
          resolve({return_code: 'SUCCESS',
            return_msg: '',
            data: respStr
          })
        }
      }).catch(function (err) {
        reject(err);
      });
    });
  }
  /**
   * 交易保障
   *
   * @param {object} reqData
   * @param {int} timeout
   * @returns {Promise}
   */
  report(reqData, timeout) {
    var self = this;
    var url = WXPayConstants.REPORT_URL;
    if (self.USE_SANDBOX) {
      url = WXPayConstants.SANDBOX_REPORT_URL;
    }
    return new Promise(function (resolve, reject) {
      self.requestWithoutCert(url, self.fillRequestData(reqData), timeout).then(function (respXml) {
        WXPayUtil.xml2obj(respXml).then(function (respObj) {
          resolve(respObj);
        }).catch(function (err) {
          reject(err);
        });
      }).catch(function (err) {
        reject(err);
      });
    });
  }
  /**
   * 转换短链接
   *
   * @param {object} reqData
   * @param {int} timeout
   * @returns {Promise}
   */
  shortUrl(reqData, timeout) {
    var self = this;
    var url = WXPayConstants.SHORTURL_URL;
    if (self.USE_SANDBOX) {
      url = WXPayConstants.SANDBOX_SHORTURL_URL;
    }
    return new Promise(function (resolve, reject) {
      self.requestWithoutCert(url, self.fillRequestData(reqData), timeout).then(function (respXml) {
        self.processResponseXml(respXml).then(function (respObj) {
          resolve(respObj);
        }).catch(function (err) {
          reject(err);
        });
      }).catch(function (err) {
        reject(err);
      });
    });
  }
  /**
   * 授权码查询 OPENID 接口
   *
   * @param {object} reqData
   * @param {int} timeout
   * @returns {Promise}
   */
  authCodeToOpenid(reqData, timeout) {
    var self = this;
    var url = WXPayConstants.AUTHCODETOOPENID_URL;
    if (self.USE_SANDBOX) {
      url = WXPayConstants.SANDBOX_AUTHCODETOOPENID_URL;
    }
    return new Promise(function (resolve, reject) {
      self.requestWithoutCert(url, self.fillRequestData(reqData), timeout).then(function (respXml) {
        self.processResponseXml(respXml).then(function (respObj) {
          resolve(respObj);
        }).catch(function (err) {
          reject(err);
        });
      }).catch(function (err) {
        reject(err);
      });
    });
  }
  /**
   * 新增个人收款用户
   *
   * @param {object} reqData
   * @param {int} timeout
   * @returns {Promise}
   */
  addSeller(reqData, timeout) {
    let url = WXPayConstants.ADDSELLER_URL;
    if (this.USE_SANDBOX) {
      url = WXPayConstants.SANDBOX_ADDSELLER_URL;
    }
    return new Promise( (resolve, reject)=> {
      const clonedData = JSON.parse(JSON.stringify(reqData));
      clonedData['appid'] = this.APPID;
      clonedData['mch_id'] = this.MCHID;
      clonedData[WXPayConstants.FIELD_SIGN_TYPE] = this.SIGN_TYPE;
      clonedData[WXPayConstants.FIELD_SIGN] = WXPayUtil.generateSignature(clonedData, this.KEY, this.SIGN_TYPE);
      // return xml [root] not [xml]
      this.requestWithCert(url, clonedData, timeout).then( (respXml)=> {
        this.processResponseXml(respXml).then( (respObj)=> {
          resolve(respObj);
        }).catch( (err)=> {
          reject(err);
        });
      }).catch( (err)=> {
        reject(err);
      });
    });
  }
}

module.exports = WXPay;