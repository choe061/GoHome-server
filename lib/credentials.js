/**
 * Created by choi on 2016-10-28.
 */
module.exports = {
    gmail: {
        user: '',
        pass: ''
    },
    gmail_api: {
        clientId: '',
        clientSecret: '',
        refreshToken: '',
        accessToken: ''
    },
    secretKey: {
        code: ''
    },
    randomUserCode: function () {
        var ALPHA = ['a','b','c','d','e','f','g','h','i','j','k','l','m','n','o','p','q','r','s','t','u','v','w','x','y','z','0','1','2','3','4','5','6','7','8','9'];
        var code='';
        for(var i=0; i<8; i++){
            var randTnum = Math.floor(Math.random()*ALPHA.length);
            code += ALPHA[randTnum];
        }
        return code;
    }
};