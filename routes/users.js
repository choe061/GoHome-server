var express = require('express');
var mysql = require('mysql');
var jwt = require('jsonwebtoken');
var router = express.Router();

var connection = mysql.createConnection({
    host: '',
    user: '',
    password: '',
    database: ''
});

router.get('/duplication', function (req, res, next) {
    var select_sql = 'select myPhone from users where myPhone=?';

    connection.query(select_sql, req.query.myPhone, function (error, user) {
        if (error) {
            res.status(500).json({result: false});
        } else {
            if (!user[0]) {
                res.status(200).json({result: true});
            } else if (user[0]) {
                res.status(200).json({result: false});
            }
        }
    });
});

router.post('/register', function (req, res, next) {
    var select_sql = 'select myPhone from users where myPhone=?';
    var insert_sql = 'insert into users(myPhone, pw, gcm_token, name, age, gender, phone1, phone2, phone3) values(?, ?, ?, ?, ?, ?, ?, ?, ?)';
    var insert_location_sql = 'insert into location(myPhone) values(?)';
    var insert_gcm_token_sql = 'insert into gcm_token(phone) values(?)';
    var params = [req.body.myPhone, req.body.pw, req.body.name, req.body.age, req.body.gender, req.body.phone1, req.body.phone2, req.body.phone3];

    connection.query(select_sql, req.body.myPhone, function (err, duplication) {
        if (duplication.length > 0) {
            res.status(404).json({result: false, message: 'already exist phone'});
        } else {
            connection.query(insert_sql, params, function (error, user) {
                if (error) {
                    res.status(500).json({result: false, message: 'server error'});
                } else {
                    connection.query(insert_location_sql, req.body.myPhone, function (error, myLocation) {
                        if(error) {
                            res.status(500).json({result: false, message: 'myLocation register error'});
                        } else {
                            connection.query(insert_gcm_token_sql, req.body.myPhone, function (error, gcm_id) {
                                if(error) {
                                    res.status(500).json({result: false, message: 'gcm id create fail'});
                                } else {
                                    res.status(200).json({result: true, message: 'success'});
                                }
                            });
                        }
                    });
                }
            });
        }
    });
});

var secretKey = '';
router.post('/login', function (req, res, next) {
    var select_sql = 'select myPhone,pw from users where myPhone=? and pw=?';
    var params = [req.body.myPhone, req.body.pw];

    connection.query(select_sql, params, function (error, user) {
        if (error) {
            res.status(500).json({result: false, token: null, message: 'server error'});
        } else {
            if (!user[0]) {
                res.status(404).json({result: false, token: null, message: 'user not found'});
            } else if (user[0]) {
                var body = {
                    myPhone: user[0].myPhone,
                    pw: user[0].pw
                };
                var token = jwt.sign(
                    body,
                    secretKey,
                    {
                        expiresIn: '24h'   //토큰 만료시간 24시간
                    },
                    {
                        algorithm: 'HS256'  //HMAC using SHA-256 hash algorithm
                    });
                res.status(200).json({result: true, token: token, message: 'login success'});
                // console.log('token : '+token);
            }
        }
    });
});

/**
 * 자신의 gcm_token을 저장
 * req body - gcm_token, phone
 * res body - result
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
 * gcm_token ID를 가져옴
 * req body - myPhone
 * res body - result, Gcm_token
 */
router.post('/gcm-receive', function (req, res, next) {
    var family_select_sql = 'select phone1, phone2, phone3 from users where myPhone=?';
    var gcm_token_select_sql = 'select phone, gcm_token from gcm_tb where (phone=? or phone=? or phone=?)';

    connection.query(family_select_sql, req.body.myPhone, function (error, phoneList) {
        if(error) {
            res.status(500).json({result: false, gcm_token: null});
        } else {
            var params = [phoneList[0].phone1, phoneList[0].phone2, phoneList[0].phone3];
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

router.use(function (req, res, next) {
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
});

router.post('/profile', function (req, res, next) {
    var select_user_sql = 'select myPhone, name, age, gender, phone1, phone2, phone3 from users where myPhone=?';
    connection.query(select_user_sql, req.body.myPhone, function (error, profile) {
        if (error) {
            res.status(500).json({result: false, message: 'server error', myProfile: null});
        } else {
            res.status(200).json({
                result: true,
                message: 'auth success',
                myProfile: {
                    myPhone: profile[0].myPhone,
                    name: profile[0].name,
                    age: profile[0].age,
                    gender: profile[0].gender,
                    phone1: profile[0].phone1,
                    phone2: profile[0].phone2,
                    phone3: profile[0].phone3
                }
            });
        }
    });
});

router.post('/location', function (req, res, next) {
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

router.post('/address', function (req, res, next) {
    var select_sql = 'select router from my_router where phone=?';

    connection.query(select_sql, req.body.phone, function (error, result) {
        if(error) {
            res.status(404).json([{router: null}]);
        } else {
            if(!result) {
                res.status(200).json([{router: null}]);
            } else if(result) {
                res.status(200).json(result);
            }
        }
    });
});

router.post('/receive', function(req, res, next) {
    var family_select_sql = 'select phone1, phone2, phone3 from users where myPhone=?';
    var select_sql = 'select B.name, A.nowLat, A.nowLng, A.mod_date from location A, users B where (A.phone=? or A.phone=? or A.phone=?) AND A.phone=B.myPhone';

    connection.query(family_select_sql, req.body.myPhone, function (error, phoneList) {
       if(error) {
           res.status(500).json({result: false, message: 'server connect fail(phone list receive fail)', locations: null});
       } else {
           var params = [phoneList[0].phone1, phoneList[0].phone2, phoneList[0].phone3];
           connection.query(select_sql, params, function (error, locations) {
               if(error) {
                   res.status(500).json({result: false, message: 'server connect fail(locations)', locations: null});
               } else {
                   if(!locations[0]) {
                       res.status(200).json({result: false, message: 'location list receive fail', locations: null});
                   } else if(locations[0]) {
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