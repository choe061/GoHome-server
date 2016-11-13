var express = require('express');
var mysql = require('mysql');
var jwt = require('jsonwebtoken');
var credentials = require('../lib/credentials.js');
var auth = require('../lib/auth.js');
var router = express.Router();

var connection = mysql.createConnection({
    host: '',
    user: '',
    password: '',
    database: ''
});

//phone number 중복확인
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

//회원가입
router.post('/up', function (req, res, next) {
    var select_sql = 'select myPhone from users where myPhone=?';
    var insert_sql = 'insert into users(myPhone, pw, email, name, age, gender, user_code) values(?, ?, ?, ?, ?, ?, ?)';
    var insert_location_sql = 'insert into location(phone) values(?)';
    var insert_gcm_token_sql = 'insert into gcm_tb(phone) values(?)';
    var userCode = credentials.randomUserCode;
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

//로그인
var secretKey = credentials.secretKey.code;
router.post('/in', function (req, res, next) {
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
            }
        }
    });
});

/**
 * 로그인 토큰 인증 미들웨어
 */
router.use(auth.login_auth);

/**
 * user_code를 확인
 */
router.post('/user-code', function (req, res, next) {
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

//프로필 정보 가져오기
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

/**
 * 피보호자 리스트 요청
 */
router.post('/ward', function (req, res, next) {
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

//프로필 업데이트 - 비밀번호 변경, 기타 정보 변경, 피보호자 추가, 보호자 변경
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

//피보호자 삭제
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

//회원탈퇴
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