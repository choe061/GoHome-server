/**
 * Created by choi on 2016-11-12.
 */
var credentials = require('./credentials.js');
var jwt = require('jsonwebtoken');

module.exports = {
    login_auth: function (req, res, next) {
        var secretKey = credentials.secretKey.code;
        var token = req.body.token;
        console.log(token);
        if (token) {
            jwt.verify(token, secretKey, function (error, decoded) {
                if (error) {
                    return res.status(403).json({result: false, token: null, message: 'token auth failed', myProfile: null});
                } else {
                    next();
                }
            });
        } else {
            return res.status(403).json({result: false, token: null, message: 'token not found', myProfile: null});
        }
    }
};