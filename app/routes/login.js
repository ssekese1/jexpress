var config = require('../../config');
var security = require("../libs/security");
var User = require('../models/user_model');
var APIKey = require('../models/apikey_model');
var bunyan = require("bunyan");
var rest = require("restler-q");
var jwt = require("jsonwebtoken");
var bcrypt = require('bcrypt');

var log = bunyan.createLogger({ 
	name: "jexpress.login"
});

function recover(req, res, next) {
	var email = req.body.email;
	if (!email) {
		log.error("Missing email parameter");
		res.status(400).json({ status: "fail", message: "Missing email parameter" });
		return;
	}
	User.findOne({ email: email }, function(err, user) {
		if (err) { 
			log.error(err);
			res.status(500).json({ status: "error", message: err });
			return;
		}
		if (!user) {
			log.error("Could not find email");
			res.status(500).json({ status: "fail", message: "Could not find email" });
			return;
		}
		user.temp_hash = require('rand-token').generate(16);
		user.save(function(err) {
			if (err) { 
				log.error(err); 
				return done(err); 
			}
			var nodemailer = require('nodemailer');
			var smtpTransport = require('nodemailer-smtp-transport');
			// create reusable transporter object using SMTP transport
			var transporter = nodemailer.createTransport(smtpTransport({
				host: config.smtp_server,
				port: 25,
				auth: {
					user: config.smtp_username,
					pass: config.smtp_password,
				},
				// secure: true,
				tls: { rejectUnauthorized: false }
			}));
			var html = text = "Someone (hopefully you) requested a password reset. Please click on the following url to recover your password. If you did not request a password reset, you can ignore this message. \n" + config.password_recovery_url + "/" + user.temp_hash;
			if (req.body.mail_format) {
				html = req.body.mail_format;
				html = html.replace(/\{\{recover_url\}\}/i, config.password_recovery_url + "/" + user.temp_hash);
			}
			transporter.sendMail({
				from: config.smtp_from,
				to: user.email,
				subject: "Password Recovery",
				text: text,
				html: html
			},
			function(result) {
				log.debug({ msg: "Mailer result", result: result });
			});
			res.json({ status: "ok", message: "Sent recovery email" });
		});
	});
}

function reset(req, res, next) { // Insecure - This is going to get deprecated
	var password = req.body.password;
	var temp_hash = req.body.temp_hash;
	if (temp_hash.length < 16) {
		log.error("Hash error");
		deny(req, res, next);
		return;
	}
	if (password.length < 4) {
		log.error("Password too short");
		deny(req, res, next);
		return;
	}
	User.findOne({ temp_hash: temp_hash }, function(err, user) {
		if (err) { 
			log.error(err); 
			return done(err); 
		}
		if (!user) {
			log.error("Hash not found");
			deny(req, res, next);
			return;
		}
		user.password = security.encPassword(password);
		user.temp_hash = "";
		user.save(function(err) {
			if (err) { 
				log.error(err); 
				return done(err); 
			}
			res.send("User updated");
			return;
		});
	})
}

function logout(req, res, next) {
	var apikey = req.query.apikey;
	APIKey.findOne({ apikey: apikey }, function(err, apikey) {
		if (err) { 
			log.error(err);
			res.status(500).json({ status: "error", error: err });
			return;
		}
		if (!apikey) {
			log.error("API Key not found");
			res.status(404).json({ status: "fail", message: "API Key not found" });
			return;
		}
		apikey.remove(function(err, item) {
			if (err) { 
				log.error(err);
				res.status(500).json({ status: "error", error: err });
				return;
			}
			res.json({ status: "ok", message: "User logged out" });
		});
	});
}

function oauth(req, res, next) { // Log in through an OAuth2 provider, defined in config.js
	var provider_config = config.oauth[req.params.provider];
	if (!provider_config) {
		res.status(500).send(req.params.provider + " config not defined");
		return;
	}
	var state = Math.random().toString(36).substring(7);
	var uri = provider_config.auth_uri + "?client_id=" + provider_config.app_id + "&redirect_uri=" + config.url + "/api/login/oauth/callback/" + req.params.provider + "&scope=" + provider_config.scope + "&state=" + state + "&response_type=code";
	// req.session.sender = req.query.sender;
	res.redirect(uri);
}

function oauth_callback(req, res, next) {
	var provider = req.params.provider;
	var provider_config = config.oauth[provider];
	var code = req.query.code;
	var data = null;
	var token = false;
	var user = null;
	if (req.query.error) {
		res.redirect(config.oauth.fail_uri + "?error=" + req.query.error);
		return;
	}
	if (!code) {
		res.redirect(config.oauth.fail_uri + "?error=unknown");
		return;
	}
	rest.post(provider_config.token_uri, { data: { client_id: provider_config.app_id, redirect_uri: config.url + "/api/login/oauth/callback/" + req.params.provider, client_secret: provider_config.app_secret, code: code, grant_type: "authorization_code" } })
	.then(function(result) {
		token = result;
		if (!token.access_token) {
			res.redirect(config.oauth.fail_uri + "?error=unknown");
			return;
		}
		return rest.get(provider_config.api_uri, { accessToken: token.access_token });
	})
	.then(function(result) {
		data = result;
		if (!result.email) {
			res.redirect(config.oauth.fail_uri + "?error=missing_data");
			return;
		}
		return User.findOne({ email: result.email });
	})
	.then(function(result) {
		user = result;
		if (!user) {
			res.redirect(config.oauth.fail_uri + "?error=no_user");
			return;
		}
		user[provider] = data;
		return user.save();
	})
	.then(function(result) {
		//Generate new API key
		var apikey = new APIKey();
		apikey.user_id = user._id;
		apikey.apikey = require('rand-token').generate(16);
		apikey.save(function(err) {
			if (err) {
				log.error(err);
				res.redirect(config.oauth.fail_uri + "?error=unknown");
				return;
			}
			log.info({ action_id: 1, action: "User logged on", user: user });
			var token = jwt.sign({ apikey: apikey.apikey, user: user }, config.shared_secret, {
				expiresIn: "1m"
			});
			res.redirect(config.oauth.success_uri + "?token=" + token);
			return;
		});
	})
	.then(null, function(err) {
		console.log("Err", err);
		res.redirect(config.oauth.fail_uri + "?error=unknown");
		return;
	});
}

function login(req, res, next) {
	var email = req.body.email;
	var password = req.body.password;
	var user = security.basicAuth(req);
	if (user) {
		email = user[0];
		password = user[1];
	}
	if ((!password) || (!email)) {
		log.error("Missing email or password parameters");
		res.status(404).json({ status: "fail", message: "Missing email or password parameters" });
		return;
	}
	User.findOne({ email: email }, function(err, user) {
		if (err) {
			log.error(err);
			res.status(500).json({ status: "error", error: err });
			return; 
		}
		if (!user) {
			log.error("Incorrect username");
			res.status(401).json({ status: "fail", message: "Incorrect username" });
			return;
		}
		try {
			if (!bcrypt.compareSync(password, user.password)) {
				log.error("Incorrect password");
				res.status(401).json({ status: "fail", message: "Incorrect password" });
				return;
			}
		} catch (err) {
			log.error(err);
			res.status(500).json({ status: "error", error: err });
			return;
		}
		security.generateApiKey(user)
		.then(function(result) {
			res.json(result);
		}, function(err) {
			res.status(401).json({ status: "fail", message: "Authentication failed" });
		});
	});
}

var Login = {
	recover: recover,
	reset: reset,
	logout: logout,
	oauth: oauth,
	oauth_callback: oauth_callback,
	login: login
}

module.exports = Login;