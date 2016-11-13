/**
 * Created by choi on 2016-11-11.
 */
var express = require('express');
var mysql = require('mysql');
var nodemailer = require('nodemailer');
var generator = require('xoauth2');
var credentials = require('./../lib/credentials.js');
var router = express.Router();

var connection = mysql.createConnection({
    host: '',
    user: '',
    password: '',
    database: ''
});

//XOAuth 인증key 리스트
var xoauth2gen = generator.createXOAuth2Generator({
    user: credentials.gmail.user,
    clientId: credentials.gmail_api.clientId,
    clientSecret: credentials.gmail_api.clientSecret,
    refreshToken: credentials.gmail_api.refreshToken,
    accessToken: credentials.gmail_api.accessToken
});

//nodemailer 설정
var smtpTransport = nodemailer.createTransport({
    service: 'gmail',
    secureConnection: true,
    port: 465,
    transportMethod: "SMTP",
    auth: {
        xoauth2: xoauth2gen
    }
});

//비밀번호 재생성 후 이메일 전송
router.get('/send', function (req, res, next) {
    var phone = req.query.myPhone;
    var select_sql = 'select email from users where myPhone=?';
    var update_sql = 'update users set pw=? where myPhone=?';
    connection.query(select_sql, phone, function (error, user) {
        if(error) {
            res.status(500).json({result: false});
        } else {
            if(!user[0]) {
                res.status(200).json({result: false});
            } else if(user[0]) {
                var new_pw = credentials.randomUserCode;
                var params = [new_pw, phone];
                connection.query(update_sql, params, function (err, result) {
                    if(err) {
                        res.status(500).json({result: false});
                    } else {
                        var mailOptions = {
                            from: ' <@gmail.com>',
                            to: user[0].email,
                            subject: '<집으로> 비밀번호 변경',
                            text: '변경된 비밀번호는 \"'+new_pw+'\"입니다.\n본인이 아닌 경우 메일을 회신해주세요.'
                        };
                        smtpTransport.sendMail(mailOptions, function (e, response) {
                            if(e) {
                                res.status(200).json({result: false});
                            } else {
                                res.status(200).json({result: true});
                            }
                            smtpTransport.close();
                        });
                    }
                });
            }
        }
    });
});

module.exports = router;