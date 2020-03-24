const crypto = require('crypto')
var request = require('request');



const setAccessToken=() => {
    const timestamp = Math.floor(Date.now() / 1000);
    const nonce = "hoi" + Date.now();



    const privateKey = 'n3UIW4TE-tdXz_0Iwv7XYyuSd3Iolo6nCeMNoeGjZ67Bv90IGfVqs10f0iCDVdc-ydhSfVVV3_XGwB8dt7LfGw&'
    const keyId = 'muk7Nc85mHEOTMTkjDVIbQ';

    var param = 'grant_type=client_credentials&oauth_consumer_key=' + keyId + '&oauth_nonce=' + nonce + '&oauth_signature_method=HMAC-SHA256&oauth_timestamp=' + timestamp + '&oauth_version=1.0';
    var host = 'https://account.api.here.com/oauth2/token';
    var method = 'POST';

    const message = method + '&' + encodeURIComponent(host) + '&' + encodeURIComponent(param);



    var outh_Sign = crypto.createHmac('sha256', privateKey)
        .update(message)
        .digest('base64')
    outh_Sign = encodeURIComponent(outh_Sign);

    const Authorization = 'OAuth oauth_consumer_key="' + keyId + '",oauth_signature_method="HMAC-SHA256",oauth_timestamp="' + timestamp + '",oauth_nonce="' + nonce + '",oauth_version="1.0",oauth_signature="' + outh_Sign + '"'
    var options = {
        'method': method,
        'url': host,
        'headers': {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': Authorization
        },
        form: {
            'grant_type': 'client_credentials'
        }
    };
    request(options, function (error, response) {
        if (error) throw new Error(error);
        const body =JSON.parse(response.body);
        process.env.token=body.access_token;
        process.env.timeout= parseInt(body.expires_in)*900;


        setInterval(setAccessToken,process.env.timeout);
    });

}


module.exports = setAccessToken;





