/**
 * Created by choi on 2016-11-11.
 */
var express = require('express');
var mysql = require('mysql');
var credentials = require('../lib/credentials.js');
var auth = require('../lib/auth.js');
var router = express.Router();

var connection = mysql.createConnection({
    host: '',
    user: '',
    password: '',
    database: ''
});

/**
 * 로그인 토큰 인증 미들웨어
 */
router.use(auth.login_auth);

//사용자의 GPS좌표 업데이트
router.post('/up', function (req, res, next) {
    var update_sql = 'update location set nowLat=?, nowLng=? where phone=?';
    var params = [req.body.nowLat, req.body.nowLng, req.body.phone];
    connection.query(update_sql, params, function (error, location) {
        if(error) {
            res.status(403).json({result: false, message: 'location update fail'});
        } else {
            res.status(200).json({result: true, message: 'location update success'});
        }
    });
});

/***
 * 다른 사용자 위치 가져오기(보호자가 정보를 받아오는 api)
 * 사용자의 피보호자의 GPS좌표 가져오기
 */
router.post('/ward', function(req, res, next) {
    var family_select_sql = 'select phone from ward_users where myPhone=?';
    var list = '';

    connection.query(family_select_sql, [req.body.myPhone], function (error, phoneList) {
        if(error) {
            res.status(500).json({result: false, message: 'server connect fail(phone list receive fail)', locations: null});
        } else {
            var len = phoneList.length;
            var params = [];
            for(var i=0; i<len; i++) {
                params.push(phoneList[i].phone);
            }
            if(len == 1) {
                list = '(A.phone=?)';
            } else if(len == 2) {
                list = '(A.phone=? or A.phone=?)';
            } else if(len == 3) {
                list = '(A.phone=? or A.phone=? or A.phone=?)';
            }
            var select_sql = 'select B.name, A.nowLat, A.nowLng, A.mod_date from location A, users B where '+list+' AND A.phone=B.myPhone';
            connection.query(select_sql, params, function (error, locations) {
                if (error) {
                    res.status(500).json({
                        result: false, message: 'server connect fail(locations)', locations: null
                    });
                } else {
                    if (!locations[0] && !locations[1] && !locations[2]) {
                        res.status(200).json({
                            result: false, message: 'location list receive fail', locations: null
                        });
                    } else if (locations[0] || locations[1] || locations[2]) {
                        res.status(200).json({
                            result: true,
                            message: 'location receive success',
                            locations: [
                                locations[0],
                                locations[1],
                                locations[2]
                            ]
                        });
                    }
                }
            });
        }
    });
});

module.exports = router;