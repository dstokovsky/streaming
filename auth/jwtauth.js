var config = require('../lib/config'),
    UserModel = require('../lib/mongoose').UserModel,
    TokenModel = require('../lib/mongoose').TokenModel,
    jwt = require('jwt-simple');
 
module.exports = function(req, res, next) {
    var token = req.body && req.body.token;
    if (token) {
        try {
            var decoded = jwt.decode( token, config.get('tokenSecret') );
            UserModel.findOne({ _id: decoded.iss }, function(err, user) {
                req.user = user;
            });
            console.log(decoded);
        } catch ( err ) {
            return next();
        }
    } else {
        next();
    }
};
