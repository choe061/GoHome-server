/**
 * Created by choi on 2016-11-11.
 */
var express = require('express');
var mysql = require('mysql');
var router = express.Router();

var connection = mysql.createConnection({
    host: '',
    user: '',
    password: '',
    database: ''
});

/**
 * 사용자의 gcm-token을 DB에 저장
 */
router.post('/gcm-token', function (req ,res, next) {
    var update_sql = 'update gcm_tb set gcm_token=? where phone=?';
    var update_params = [req.body.gcm_token, req.body.phone];

    connection.query(update_sql, update_params, function (error, data) {
        if(error) {
            res.status(200).json({result: false});
        } else {
            res.status(200).json({result: true});
        }
    });
});

/**
 * 타 사용자의 gcm-token을 가져옴
 */
router.post('/gcm-token-receive', function (req, res, next) {
    var family_select_sql = 'select guardian_phone1, guardian_phone2, guardian_phone3 from users where myPhone=?';
    var gcm_token_select_sql = 'select phone, gcm_token from gcm_tb where (phone=? or phone=? or phone=?)';

    connection.query(family_select_sql, req.body.myPhone, function (error, phoneList) {
        if(error) {
            res.status(500).json({result: false, gcm_token: null});
        } else {
            var params = [phoneList[0].guardian_phone1, phoneList[0].guardian_phone2, phoneList[0].guardian_phone3];
            connection.query(gcm_token_select_sql, params, function (err, gcm_token) {
                if(err) {
                    res.status(500).json({result: false, gcm_token: null});
                } else {
                    res.status(200).json({
                        result: true,
                        gcm_token: [
                            gcm_token[0],
                            gcm_token[1],
                            gcm_token[2]
                        ]
                    });
                }
            });
        }
    });
});

module.exports = router;