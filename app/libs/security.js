var Q = require("q");
var APIKey = require('../models/apikey_model');
var bunyan = require("bunyan");
var bcrypt = require('bcrypt');
var overviewLog = bunyan.createLogger({
	name: "jexpress.overview"
});
var log = bunyan.createLogger({ 
	name: "jexpress",
	// serializers: {req: bunyan.stdSerializers.req}
});
var Groups = require("../models/usergroups_model.js");
var User = require('../models/user_model');

var basicAuth = function(req) {
	if (!req.headers.authorization) {
		return false;
	}
	try {
		auth = req.headers.authorization.split(" ")[1];
	} catch(err) {
		return false;
	}
	decoded = new Buffer(auth, 'base64').toString();
	return decoded.split(":");
}

var Security = {
	basicAuth: basicAuth,
	encPassword: function(password) {
		return hash = bcrypt.hashSync(password, 4);
	},
	generateApiKey: function(user) {
		var deferred = Q.defer();
		//Generate new API key
		var apikey = new APIKey();
		apikey.user_id = user._id;
		apikey.apikey = require('rand-token').generate(16);

		apikey.save(function(err) {
			if (err) {
				log.error(err);
				deferred.reject(err);
				return;
			}
			overviewLog.info({ action_id: 1, action: "User logged on", user: user });
			deferred.resolve(apikey);
		});
		return deferred.promise;
	},
	apiKeyAuth: function(req, res, next, fail) {
		if (req.headers.authorization) { // Basic Auth 
			var ba = basicAuth(req);
			if (Array.isArray(ba) && (ba.length == 2)) {
				var email = ba[0];
				var password = ba[1];
				User.findOne({ email: email }, function(err, user) {
					if (err) {
						log.error(err); 
						return done(err); 
					}
					if (!user) {
						log.error("Incorrect username");
						deny(req, res, next);
						return;
					}
					try {
						if (!bcrypt.compareSync(password, user.password)) {
							log.error("Incorrect password");
							deny(req, res, next);
							return;
						}
					} catch (err) {
						log.error(err);
						deny(req, res, next);
						return;
					}
					req.user = user;
					Groups.findOne({ user_id: user._id }, function(err, userGroup) {
						if (err) {
							return fail(500, err);
						}
						req.groups = (userGroup && userGroup.groups) ? userGroup.groups : [];
						return next(user);
					});
				});
			}
		} else {
			if (!req.query.apikey) {
				log.error("No auth method found");
				return fail(403, "Unauthorized");
			}
			var apikey = req.query.apikey;
			if (!apikey) {
				return fail(403, "Unauthorized");
			}
			APIKey.findOne({ apikey: apikey }, function(err, apikey) {
				if (err) {
					return fail(500, err);
				}
				if (!apikey) {
					return fail(403, "Unauthorized");
				}
				User.findOne({ _id: apikey.user_id }, function(err, user) {
					if (err) {
						return fail(500, err);
					}
					if (!user) {
						return fail(403, "Unauthorized");
					}
					req.user = user;
					req.apikey = apikey.apikey;
					var Groups = require("../models/usergroups_model.js");;
					Groups.findOne({ user_id: user._id }, function(err, userGroup) {
						if (err) {
							return fail(500, err);
						}
						req.groups = (userGroup && userGroup.groups) ? userGroup.groups : [];
						return next(user);
					});
				});
			});
		}
	}
}

module.exports = Security;