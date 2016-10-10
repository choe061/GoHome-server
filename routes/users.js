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

router.post('/check-user-code', function (req, res, next) {
    var select_sql = 'select myPhone from users where myPhone=? and user_code=?';
    var params = [req.query.myPhone, req.query.user_code];
    connection.query(select_sql, params, function (error, user) {
        if (error) {
            res.status(500).json({result: false});
        } else {
            if (!user[0]) {
                res.status(200).json({result: false});
            } else if (user[0]) {
                res.status(200).json({result: true});
            }
        }
    });
});

function randomUserCode(){
    var ALPHA = ['a','b','c','d','e','f','g','h','i','j','k','l','m','n','o','p','q','r','s','t','u','v','w','x','y','z','0','1','2','3','4','5','6','7','8','9'];
    var code='';
    for(var i=0; i<8; i++){
        var randTnum = Math.floor(Math.random()*ALPHA.length);
        code += ALPHA[randTnum];
    }
    return code;
}

router.post('/register', function (req, res, next) {
    var select_sql = 'select myPhone from users where myPhone=?';
    var insert_sql = 'insert into users(myPhone, pw, name, age, gender, user_code) values(?, ?, ?, ?, ?, ?)';
    var insert_location_sql = 'insert into location(phone) values(?)';
    var insert_gcm_token_sql = 'insert into gcm_tb(phone) values(?)';
    var userCode = randomUserCode();
    var params = [req.body.myPhone, req.body.pw, req.body.name, req.body.age, req.body.gender, userCode];

    connection.query(select_sql, req.body.myPhone, function (err, duplication) {
        if (duplication.length > 0) {
            res.status(404).json({result: false, message: 'already exist phone'});
        } else {
            connection.query(insert_sql, params, function (error, user) {
                if (error) {
                    res.status(500).json({result: false, message: 'server error'});
                } else {
                    connection.query(insert_location_sql, [req.body.myPhone], function (error, myLocation) {
                        if(error) {
                            res.status(500).json({result: false, message: 'myLocation register error'});
                        } else {
                            connection.query(insert_gcm_token_sql, [req.body.myPhone], function (error, gcm_id) {
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

router.post('/gcm-receive', function (req, res, next) {
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
    var select_user_sql = 'select myPhone, name, age, gender, phone1, phone2, phone3, guardian_phone1, guardian_phone2, guardian_phone3, user_code from users where myPhone=?';
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
                    phone3: profile[0].phone3,
                    guardian_phone1: profile[0].guardian_phone1,
                    guardian_phone2: profile[0].guardian_phone2,
                    guardian_phone3: profile[0].guardian_phone3,
                    user_code: profile[0].user_code
                }
            });
        }
    });
});

router.post('/pw-check', function (req, res, next) {
    var select_sql = 'select myPhone from users where myPhone=? AND pw=?';
    var params = [req.body.myPhone, req.body.pw];
    connection.query(select_sql, params, function (error, check) {
        if(error) {
            res.status(500).json({result: false});
        } else {
            res.status(200).json({result: true});
        }
    })
});

router.post('/profile-update', function (req, res, next) {
    if(req.body.pw != null) {
        var pw_update_sql = 'update users set pw=? where myPhone=?';
        var params = [req.body.myPhone, req.body.pw];
        connection.query(pw_update_sql, params, function (error, profile) {
            if(error) {
                res.status(500).json({result: false});
            } else {
                res.status(200).json({result: true});
            }
        });
    } else if(req.body.name != null) {
        var update_sql = 'update users set name=?, age=?, gender=? where myPhone=?';
        var params = [req.body.name, req.body.age, req.body.gender, req.body.myPhone];
        connection.query(update_sql, params, function (error, profile) {
            if(error) {
                res.status(500).json({result: false});
            } else {
                res.status(200).json({result: true});
            }
        });
    } else if(req.body.phone1 != null) {
        var update_sql = 'update users set phone1=?, phone2=?, phone3=? where myPhone=?';
        var params = [req.body.phone1, req.body.phone2, req.body.phone3, req.body.myPhone];
        connection.query(update_sql, params, function (error, profile) {
            if(error) {
                res.status(500).json({result: false});
            } else {
                res.status(200).json({result: true});
            }
        });
    } else {
        var update_sql = 'update users set guardian_phone1=?, guardian_phone2=?, guardian_phone3=? where myPhone=?';
        var params = [req.body.guardian_phone1, req.body.guardian_phone2, req.body.guardian_phone3, req.body.myPhone];
        connection.query(update_sql, params, function (error, profile) {
            if(error) {
                res.status(500).json({result: false});
            } else {
                res.status(200).json({result: true});
            }
        });
    }
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