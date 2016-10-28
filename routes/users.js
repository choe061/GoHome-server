var express = require('express');
var mysql = require('mysql');
var jwt = require('jsonwebtoken');
var nodemailer = require('nodemailer');
var credentials = require('./credentials.js');
var router = express.Router();

var connection = mysql.createConnection({
    
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

function randomUserCode(){
    var ALPHA = ['a','b','c','d','e','f','g','h','i','j','k','l','m','n','o','p','q','r','s','t','u','v','w','x','y','z','0','1','2','3','4','5','6','7','8','9'];
    var code='';
    for(var i=0; i<8; i++){
        var randTnum = Math.floor(Math.random()*ALPHA.length);
        code += ALPHA[randTnum];
    }
    return code;
}

var smtpTransport = nodemailer.createTransport('SMTP' ,{
    service: 'Gmail',
    auth: {
        user: credentials.gmail.user,
        pass: credentials.gmail.pass
    }
});

router.get('/send-mail', function (req, res, next) {
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
                var new_pw = randomUserCode();
                var params = [new_pw, phone];
                connection.query(update_sql, params, function (err, result) {
                    if(err) {
                        res.status(500).json({result: false});
                    } else {
                        var mailOptions = {
                            from: ' <@gmail.com>',
                            to: user[0].email,
                            subject: '<집으로> 비밀번호 변경',
                            text: '변경된 비밀번호는 \"'+new_pw+'\"입니다.'
                        };
                        smtpTransport.sendMail(mailOptions, function (error, res) {
                            if(error) {
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

router.post('/register', function (req, res, next) {
    var select_sql = 'select myPhone from users where myPhone=?';
    var insert_sql = 'insert into users(myPhone, pw, email, name, age, gender, user_code) values(?, ?, ?, ?, ?, ?, ?)';
    var insert_location_sql = 'insert into location(phone) values(?)';
    var insert_gcm_token_sql = 'insert into gcm_tb(phone) values(?)';
    var userCode = randomUserCode();
    var params = [req.body.myPhone, req.body.pw, req.body.email, req.body.name, req.body.age, req.body.gender, userCode];

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

router.post('/check-user-code', function (req, res, next) {
    var select_sql = 'select myPhone from users where myPhone=? AND user_code=?';
    var params = [req.body.myPhone, req.body.user_code];
    connection.query(select_sql, params, function (error, user) {
        if (error) {
            res.status(500).json({result: false});
        } else {
            console.log(user[0]);
            if (!user[0]) {
                res.status(200).json({result: false});
            } else if (user[0]) {
                res.status(200).json({result: true});
            }
        }
    });
});

router.post('/profile', function (req, res, next) {
    var select_user_sql = 'select myPhone, email, name, age, gender, guardian_phone1, guardian_phone2, guardian_phone3, user_code from users where myPhone=?';
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
                    email: profile[0].email,
                    age: profile[0].age,
                    gender: profile[0].gender,
                    guardian_phone1: profile[0].guardian_phone1,
                    guardian_phone2: profile[0].guardian_phone2,
                    guardian_phone3: profile[0].guardian_phone3,
                    user_code: profile[0].user_code
                }
            });
        }
    });
});

router.post('/ward-list', function (req, res, next) {
    var select_user_sql = 'select phone from ward_users where myPhone=?';

    connection.query(select_user_sql, [req.body.myPhone], function (error, users) {
        if(error) {
            res.status(500).json({result:false, users:null});
        } else {
            res.status(200).json({
                result:true,
                users: [
                    users[0],
                    users[1],
                    users[2]
                ]
            })
        }
    });
});

router.post('/profile-update', function (req, res, next) {
    if(req.body.now_pw != null && req.body.new_pw != null) {
        var select_sql = 'select myPhone from users where myPhone=? AND pw=?';
        connection.query(select_sql, [req.body.myPhone, req.body.now_pw], function (error, profile) {
            if(error) {
                res.status(500).json({result: false});
            } else {
                if(!profile[0]) {
                    res.status(200).json({result: false});
                } else {
                    var pw_update_sql = 'update users set pw=? where myPhone=?';
                    var params = [req.body.new_pw, req.body.myPhone];
                    connection.query(pw_update_sql, params, function (error, profile) {
                        if (error) {
                            res.status(500).json({result: false});
                        } else {
                            res.status(200).json({result: true});
                        }
                    });
                }
            }
        });
    } else if(req.body.email != null && req.body.name != null && req.body.age != null && req.body.gender !=null) {
        var update_sql = 'update users set email=?, name=?, age=?, gender=? where myPhone=?';
        var params = [req.body.email, req.body.name, req.body.age, req.body.gender, req.body.myPhone];
        connection.query(update_sql, params, function (error, profile) {
            if(error) {
                res.status(500).json({result: false});
            } else {
                res.status(200).json({result: true});
            }
        });
    } else if(req.body.phone != null && req.body.user_code) {
        var select_sql = 'select myPhone from users where myPhone=? AND user_code=?';
        var select_check_sql = 'select * from ward_users where myPhone=? AND phone=?';
        var update_sql = 'insert into ward_users(myPhone, phone) values(?, ?)';
        var params1 = [req.body.myPhone, req.body.user_code];
        var params2 = [req.body.myPhone, req.body.phone];
        connection.query(select_sql, params1, function (error, results) {
            if(error) {
                res.status(500).json({result: false});
            } else {
                connection.query(select_check_sql, params2, function (error, user) {
                    if(error) {
                        res.status(500).json({result: false});
                    } else {
                        if(user[0]) {
                            res.status(200).json({result: false});
                        } else if(!user[0]) {
                            connection.query(update_sql, params2, function (error, results) {
                                if(error) {
                                    res.status(500).json({result: false});
                                } else {
                                    res.status(200).json({result: true});
                                }
                            });
                        }
                    }
                });
            }
        });
    } else if(req.body.guardian_phone1 != null) {
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

router.post('/ward-delete', function (req, res, next) {
    var delete_sql = 'delete from ward_users where myPhone=? AND phone=?';
    var params = [req.body.myPhone, req.body.phone];
    connection.query(delete_sql, params, function (error, re) {
        if(error) {
            res.status(500).json({result: false});
        } else {
            res.status(200).json({result: true});
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

router.post('/receive', function(req, res, next) {
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

router.post('/withdraw', function (req, res, next) {
    var pw_check_sql = 'select myPhone from users where myPhone=? AND pw=?';
    var pw_check_params = [req.body.myPhone, req.body.pw];
    var users_tb_del_sql = 'delete from users where myPhone=?';
    var ward_users_tb_del_sql = 'delete from ward_users where myPhone=? or phone=?';
    var gcm_tb_del_sql = 'delete from gcm_tb where phone=?';
    var location_tb_del_sql = 'delete from location where phone=?';

    connection.query(pw_check_sql, pw_check_params, function (error, user) {
        if(error) {
            res.status(500).json({result: false});
        } else {
            connection.query(users_tb_del_sql, [user[0].myPhone], function (error, users) {
                if(error) {
                    res.status(500).json({result: false});
                } else {
                    connection.query(ward_users_tb_del_sql, [user[0].myPhone, user[0].myPhone], function (error, ward_users) {
                        if(error) {
                            res.status(500).json({result: false});
                        } else {
                            connection.query(gcm_tb_del_sql, [user[0].myPhone], function (error, gcm_tb) {
                                if(error) {
                                    res.status(500).json({result: false});
                                } else {
                                    connection.query(location_tb_del_sql, [user[0].myPhone], function (error, location) {
                                        if(error) {
                                            res.status(500).json({result: false});
                                        } else {
                                            res.status(200).json({result: true});
                                        }
                                    });
                                }
                            });
                        }
                    });
                }
            });
        }
    });
});

module.exports = router;