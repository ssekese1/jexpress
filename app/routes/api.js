/* 
===============
API Engineroom 
===============
*/

/* 

This Express route supports CRUD operations without having to define controllers for each type. 

You do still have to define Mongoose models, which we expect to find at ../models.

Supports the following verbs:
- GET - Gets a list or a single object
- POST - Creates a single object
- PUT - Updates a single object
- DELETE - Deletes a single object

The format is /:modename for a GET list and a POST.
The format is /:modelname/:_id for a GET item, PUT and DELETE.

When GETting a list, you can add a Filter as a parameter, eg. /:modelname?filter[field]=value

To filter with $gte, $lte or similar, use a colon to divide the operator and query. Eg. /:modelname?filter[field]=$gte:value

There's also a special route, /:modelname/_describe, which returns the model

User model should look a bit like:

```
var mongoose     = require('mongoose');
var Schema       = mongoose.Schema;

var Objectid = mongoose.Schema.Types.ObjectId;

var UserSchema   = new Schema({
	name: String,
	email: String,
	password: String,
	apikey: String,
	admin: Boolean,
	temp_hash: String,
});

UserSchema.set("_perms", {
	admin: "rw",
	owner: "rw",
	user: "r"
});

module.exports = mongoose.model('User', UserSchema);
```

You can set permissions per model by setting _perms on the schema. Eg:
```
TestSchema.set("_perms", {
	admin: "rw",
	owner: "rw",
	user: "r",
	all: "r"
});
```

If you want to use the owner property, you need to have _owner_id in your model.
Eg. 
```
_owner_id: mongoose.Schema.Types.ObjectId;
```

Possible permission keys are:
"admin" | anyone with "admin" set to true 
"owner" | on a per-record basis, the person who originally wrote the record
"user"  | any registered user
"all"   | the w0rld

(See below for adding group permissions)

Possible values are:
"c"  | create
"r"  | read
"u"  | update
"d"  | delete

###Groups

To define groups, you need a usergroups model. It should look like this:

```
var mongoose     = require('mongoose');
var Schema       = mongoose.Schema;
var Objectid = mongoose.Schema.Types.ObjectId;
var UserGroupSchema   = new Schema({
	user_id: Objectid,
	groups: [String],
	_date: { type: Date, default: Date.now },
});
module.exports = mongoose.model('Usergroup', UserGroupSchema);
```

Note that it doesn't have a _perm section, because it is accessed directly,
not through the API. If you do want to access it through the API, feel free
to add a _perm section, but make sure you lock down permissions.

To set a user's groups, call the API as follows:
Type: POST 
End-point: /_groups/:user_id 
Data: { group: "group_name" }

To add a user to a group, call the API as follows:
Type: PUT 
End-point: /_groups/:user_id 
Data: { group: "group_name" }

* For POST and PUT, you can send multiple groups at once.

To remove a user from a group
TYPE: DELETE
End-point: /_groups/:user_id
Data: { group: "group_name" }

To check a user's groups:
Type: GET 
End-point: /_groups/:user_id 

Only Admins can use the /_groups endpoint.

To add permissions for a group to a model, just use the name, and give it permissions.
Eg:

```
TestSchema.set("_perms", {
	admin: "crud",
	no_delete: "cru",
	read_only: "r"
});
```

Admins would be able to do anything, users in the "no_delete" group would be able to create, read and update, and users in the read_only group would only be able to read.

Note that groups *do not fail* permissions, so if the user passes for admin, owner, or user, and not for group, the transaction will still go ahead.

###Soft Delete

If you want a model to soft delete, add a _deleted property as follows:

```
_deleted: { type: Boolean, default: false, index: true },
```

If _deleted equals true, the document will not show up when you get the list of 
documents, and calling it directly will result in a 404.

To show deleted documents when you get a list, add showDeleted=true to your query.

###Calling Static Methods

You can define a method for a Model in the model as follows:
```
TestSchema.statics.test = function() {
	return "Testing OKAY!";
}
```

Then to call that method through the API, use `https://my.api/api/_call/test`. 
If you POST, all variables will be passed through to the method.

###Adding custom permission logic

Maybe you want to do some more checks on permissions than the "crud" we offer. You can catch 
the user object in your model as a virtual attribute. (I suppose you could use a real Mixed attribute too.)

Eg.

```
var sender;

LedgerSchema.virtual("__user").set(function(usr) {
	sender = usr;
});
```

And then later, say in your pre- or post-save...

```
(!sender.admin)) {
	return next(new Error( "Verboten!"));
}
```

*/

var express = require('express');
var User = require('../models/user_model');
var APIKey = require('../models/apikey_model');
var bcrypt = require('bcrypt');
var router = express.Router();
var config = require('../../config');
var querystring = require('querystring');
var websocket = require('../middleware/websockets.js').connect();
var rest = require("restler-q");
var Q = require("q");
var jwt = require("jsonwebtoken");
var url = require('url');
var datamunging = require("../libs/datamunging");

//Logging
var bunyan = require("bunyan");
var log = bunyan.createLogger({ 
	name: "jexpress",
	serializers: {req: bunyan.stdSerializers.req}
});

/**
 * Logger for an overview of actions on the system
 * action_id = {
 *	1: login,
 *	2: getItem,
 *  3: getList,
 *  4: post,
 *  5: put,
 *  6: delete,
 *  7: method,
 *  8: batch
 * }
 */
var overviewLog = bunyan.createLogger({
	name: "jexpress.overview"
});

var deny = function(req, res, next) {
	if (req.log)
		req.log.error("Denying auth");
	res.status(403).send("Unauthorized");
	req.authorized = false;
}

var encPassword = function(password) {
	return hash = bcrypt.hashSync(password, 4);
}

var changeUrlParams = function(req, key, val) {
	if (req.log)
		req.log.debug(req);
	var q = req.query;
	q[key] = val;
	var pathname = require("url").parse(req.url).pathname;
	return config.url + req._parsedOriginalUrl.pathname + "?" + querystring.stringify(q);
}

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

var apiKeyAuth = function(req, res, next, fail) {
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
				var Groups = require("../models/usergroups_model.js");;
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

router.route("/_models").get(function(req, res, next) {
	var fs = require("fs");
	var path = require("path");
	model_dir = path.join(process.argv[1], "../../app/models");
	fs.readdir(model_dir, function(err, files) {
		if (err) {
			res.status(500).send("Error reading models directory");
			return false;
		}
		var models = [];
		files.forEach(function(file) {
			var modelname = path.basename(file, ".js").replace("_model", "");
			var modelobj = require("../models/" + file);
			if (modelobj.schema && modelobj.schema.get("_perms") && (modelobj.schema.get("_perms").admin || modelobj.schema.get("_perms").user || modelobj.schema.get("_perms").owner || modelobj.schema.get("_perms").all)) {
				var model = {
					model: modelname,
					file: file,
					perms: modelobj.schema.get("_perms"),
				}
				models.push(model);
			}
		});
		res.json(models);
	})
});

router.get('/_websocket_test', function(req, res) {
	websocket.emit('testing', { hello: 'world'});
	res.send("Sent testing");
});

/* Password recovery */
router.route("/login/recover").post(function(req, res, next) {
	var email = req.body.email;
	if (!email) {
		req.log.error("Missing email");
		deny(req, res, next);
		return;
	}
	User.findOne({ email: email }, function(err, user) {
		if (err) { 
			req.log.error(err);
			return done(err); 
		}
		if (!user) {
			req.log.error("Incorrect username");
			deny(req, res, next);
			return;
		}
		user.temp_hash = require('rand-token').generate(16);
		user.save(function(err) {
			if (err) { 
				req.log.error(err); 
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
				req.log.debug({ msg: "Mailer result", result: result });
			});
			res.send("Sent recovery email");
		});
	});
});

router.route("/login/reset").post(function(req, res, next) {
	var password = req.body.password;
	var temp_hash = req.body.temp_hash;
	if (temp_hash.length < 16) {
		req.log.error("Hash error");
		deny(req, res, next);
		return;
	}
	if (password.length < 4) {
		req.log.error("Password too short");
		deny(req, res, next);
		return;
	}
	User.findOne({ temp_hash: temp_hash }, function(err, user) {
		if (err) { 
			req.log.error(err); 
			return done(err); 
		}
		if (!user) {
			req.log.error("Hash not found");
			deny(req, res, next);
			return;
		}
		user.password = encPassword(password);
		user.temp_hash = "";
		user.save(function(err) {
			if (err) { 
				req.log.error(err); 
				return done(err); 
			}
			res.send("User updated");
			return;
		});
	})
});

router.route("/login/logout").get(function(req, res, next) {
	var apikey = req.query.apikey;
	APIKey.findOne({ apikey: apikey }, function(err, apikey) {
		if (err) { 
			log.error(err);
			deny(req, res, next);
			return;
		}
		if (!apikey) {
			log.error("API Key not found");
			deny(req, res, next);
			return;
		}
		apikey.remove(function(err, item) {
			if (err) { 
				log.error(err);
				deny(req, res, next);
				return;
			}
			res.send("User logged out");
		});
	});
});

router.route("/login/oauth/:provider").get(function(req, res, next) { // Log in through an OAuth2 provider, defined in config.js
	var provider_config = config.oauth[req.params.provider];
	if (!provider_config) {
		res.status(500).send(req.params.provider + " config not defined");
		return;
	}
	var state = Math.random().toString(36).substring(7);
	var uri = provider_config.auth_uri + "?client_id=" + provider_config.app_id + "&redirect_uri=" + config.url + "/api/login/oauth/callback/" + req.params.provider + "&scope=" + provider_config.scope + "&state=" + state + "&response_type=code";
	// req.session.sender = req.query.sender;
	res.redirect(uri);
});

router.route("/login/oauth/callback/:provider").get(function(req, res, next) {
	console.log("Got callback", req.query);
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
		console.log("Got token");
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
		console.log(user);
		if (!user) {
			res.redirect(config.oauth.fail_uri + "?error=no_user");
			return;
		}
		user[provider] = data;
		return user.save();
	})
	.then(function(result) {
		console.log("Saved", result);
		//Generate new API key
		var apikey = new APIKey();
		apikey.user_id = user._id;
		apikey.apikey = require('rand-token').generate(16);
		apikey.save(function(err) {
			if (err) {
				log.error(err);
				res.redirect(config.oauth.fail_uri + "?error=unknown");
				// deny(req, res, next);
				return;
			}
			overviewLog.info({ action_id: 1, action: "User logged on", user: user });
			// res.json(apikey);
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
});

/* Our login endpoint. I'm afraid you can never have a model called login. */
router.use("/login", function(req, res, next) {
	var email = req.body.email;
	var password = req.body.password;
	var user = basicAuth(req);
	if (user) {
		email = user[0];
		password = user[1];
	}
	if ((!password) || (!email)) {
		log.error("Missing email or password");
		deny(req, res, next);
		return;
	}
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
		//Generate new API key
		var apikey = new APIKey();
		apikey.user_id = user._id;
		apikey.apikey = require('rand-token').generate(16);

		apikey.save(function(err) {
			if (err) {
				log.error(err);
				deny(req, res, next);
				return;
			}
			overviewLog.info({ action_id: 1, action: "User logged on", user: user });
			res.json(apikey);
		});
	});
});

var fixArrays = function(req, res, next) {
	if (req.body) {
		for(var i in req.body) {
			if (i.search(/\[\d+\]/) > -1) {
				var parts = i.match(/(^[A-Za-z]+)(\[)/);
				var el = parts[1];
				if (!req.body[el]) {
					req.body[el] = [];
				}
				req.body[el].push(req.body[i]);
			}
		}
	}
	next();
}

/* Groups */
router.route("/_groups/:user_id")
.put(fixArrays, function(req, res, next) {
	apiKeyAuth(req, res, function(user) {
		if (!user.admin) {
			deny(req, res, next);
			return;
		}
		var Groups = require("../models/usergroups_model.js");
		var user_id = req.params.user_id;
		var group = req.body.group;
		if (!group) {
			res.status(400).send("Group required");
			return;
		}
		Groups.findOne({ user_id: user_id }, function(err, userGroup) {
			if (err) {
				res.status(500).send(err);
				return;
			}
			if (!userGroup) {
				userGroup = new Groups();
				userGroup.user_id = user_id;
				userGroup.groups = [];
			}
			if (Array.isArray(group)) {
				group.forEach(function(g) {
					var i = userGroup.groups.indexOf(g);
					if (i == -1) {
						userGroup.groups.push(g);
					}
				});
			} else {
				var i = userGroup.groups.indexOf(group);
				if (i == -1) {
					userGroup.groups.push(group);
				}
			}
			userGroup.save(function(err, result) {
				if (err) {
					res.status(500).send(err);
					return;
				}
				res.send(result);
			});
		});
	});
})
.post(fixArrays, function(req, res, next) {
	apiKeyAuth(req, res, function(user) {
		if (!user.admin) {
			deny(req, res, next);
			return;
		}
		var Groups = require("../models/usergroups_model.js");
		var user_id = req.params.user_id;
		var group = req.body.group;
		if (!group) {
			group = [];
		}
		Groups.findOne({ user_id: user_id }, function(err, userGroup) {
			if (err) {
				res.status(500).send(err);
				return;
			}
			if (!userGroup) {
				userGroup = new Groups();
				userGroup.user_id = user_id;
			}
			userGroup.groups = [];
			if (Array.isArray(group)) {
				userGroup.groups = group;
			} else {
				userGroup.groups.push(group);
			}
			userGroup.save(function(err, result) {
				if (err) {
					res.status(500).send(err);
					return;
				}
				res.send(result);
			});
		});
	});
})
.get(function(req, res, next) {
	apiKeyAuth(req, res, function(user) {
		if (!user.admin) {
			deny(req, res, next);
			return;
		}
		var Groups = require("../models/usergroups_model.js");
		var user_id = req.params.user_id;
		Groups.findOne({ user_id: user_id }, function(err, userGroup) {
			if (err) {
				res.status(500).send(err);
				return;
			}
			if (!userGroup) {
				res.send({ groups: [] });
				return;
			}
			res.send(userGroup);
		});
	});
})
.delete(function(req, res, next) {
	apiKeyAuth(req, res, function(user) {
		if (!user.admin) {
			deny(req, res, next);
			return;
		}
		var Groups = require("../models/usergroups_model.js");
		var user_id = req.params.user_id;
		var group = req.body.group;
		if (!group) {
			res.status(400).send("Group required");
			return;
		}
		Groups.findOne({ user_id: user_id }, function(err, userGroup) {
			if (err) {
				res.status(500).send(err);
				return;
			}
			if (!userGroup) {
				res.status(400).send("User not found");
				return;
			}
			var i = userGroup.groups.indexOf(group);
			if (i > -1) {
				userGroup.groups.splice(i, 1);
			}
			userGroup.save(function(err, result) {
				if (err) {
					res.status(500).send(err);
					return;
				}
				res.send(result);
			});
		});
	});
});

/* This middleware prepares the correct Model */
router.use('/:modelname', function(req, res, next) {
	var modelname = req.params.modelname;
	req.modelname = modelname;
	try {
		req.Model = require('../models/' + modelname + "_model");
		next();
	} catch(err) {
		log.error(err);
		res.status(404).send("Model " + modelname + " not found");
	}
});

/* Deal with Passwords. Just always encrypt anything called 'password' */
router.use('/:modelname', function(req, res, next) {
	if (req.body["password"] && !(req.query["password_override"])) {
		var password = encPassword(req.body["password"]);
		req.body["password"] = password;
		log.debug("Password encrypted");
	}
	next();
});

/* This is our security module. See header for instructions */
var auth = function(req, res, next) {
	//Set up our child logger
	req.log = log.child({ req: req, user: req.user });
	req.log.debug("Started Auth");
	// Check against model as to whether we're allowed to edit this model
	var perms = req.Model.schema.get("_perms");
	var passed = {
		admin: false,
		owner: false,
		user: false,
		all: false
	};
	if (req.method == "GET") {
		var method = "r";
	} else if (req.method == "POST") {
		var method = "c";
	} else if (req.method == "PUT") {
		var method = "u";
	} else if (req.method == "DELETE") {
		var method = "d";
	} else {
		req.log.error("Unsupported method", req.method);
		deny(req, res, next);
		return;
	}
	req.authorized = false;
	req.log.debug("perms", perms.admin);
	//If no perms are set, then this isn't an available model
	if (!perms.admin) {
		req.log.error("Model not available");
		deny(req, res, next);
		return;
	}
	//First check if "all" is able to do this. If so, let's get on with it.
	if (perms["all"]) {
		if (perms["all"].indexOf(method) !== -1) {
			req.log.info("Matched permission 'all':" + method);
			req.authorized = true;
			next();
			return;
		}
	}
	
	//This isn't an 'all' situation, so let's log the user in and go from there
	apiKeyAuth(req, res, function(user) {
		//Let's check perms in this order - admin, user, group, owner
		//Admin check
		if ((req.user.admin) && (perms["admin"]) && (perms["admin"].indexOf(method) !== -1)) {
			req.log.info("Matched permission 'admin':" + method);
			req.authorized = true;
			next();
			return;
		}
		//User check
		if ((perms["user"]) && (perms["user"].indexOf(method) !== -1)) {
			req.log.info("Matched permission 'user':" + method);
			req.authorized = true;
			next();
			return;
		}
		//Group check
		req.groups.forEach(function(group) {
			if ((perms[group]) && (perms[group].indexOf(method) !== -1)) {
				req.log.info("Matched permission '" + group + "':" + method);
				req.authorized = true;
				next();
				return;
			}
		});
		//Owner check
		var owner_id = false;
		req.Model.findById(req.params.item_id, function(err, item) {
			if (err) {
				req.log.error(err);
			}
			if ((item) && (item._owner_id) && (item._owner_id.toString() == user._id.toString()) && ((perms["owner"]) && (perms["owner"].indexOf(method) !== -1))) {
					req.log.info("Matched permission 'owner':" + method);
					req.authorized = true;
					next();
					return;
			} else {
				req.log.error("All authorizations failed");
				if(!req.authorized) {
					deny(req, res, next);
					return;
				}
			}
		});
	}, function(code, err) {
		req.log.error({ msg: "API key fail", code: code, err: err });
		res.status(code).send(err);
		return;
	});
};

function format_filter(filter) {
	if (typeof(filter) == "object") {
		Object.keys(filter).forEach(function(key) {
			var val = filter[key];
			try {
				if (val.indexOf(":") !== -1) {
					var tmp = val.split(":");
					filter[key] = {}
					filter[key][tmp[0]] = tmp[1];
				}
				if (typeof(val) == "object") {
					result = format_filter(val);
					filter[key] = {};
					for(var x = 0; x < result.length; x++) {
						filter[key][Object.keys(result[x])[0]]=result[x][Object.keys(result[x])[0]];
					}
				}
			} catch(err) {
				// res.status(500).send("An error occured:" + err)
				throw(err);
			}
		});
	}
	log.debug("Filter:", filter);
	return filter;
}

var _deSerialize = function(data) {
	function assign(obj, keyPath, value) {
	// http://stackoverflow.com/questions/5484673/javascript-how-to-dynamically-create-nested-objects-using-object-names-given-by
		lastKeyIndex = keyPath.length - 1;
		for (var i = 0; i < lastKeyIndex; ++ i) {
			key = keyPath[i];
			if (!(key in obj))
				obj[key] = {};
			obj = obj[key];
		}
		obj[keyPath[lastKeyIndex]] = value;
	}
	for(datum in data) {
		var matches = datum.match(/\[(.+?)\]/g);
		if (matches) {
			var params = matches.map(function(match) {
				return match.replace(/[\[\]]/g, "");
			});
			if (isNaN(params[0])) {
				params.unshift(datum.match(/(.+?)\[/)[1]);
				assign(data, params, data[datum]);
			}
		}
	}
}

var _populateItem = function(item, data) {
	_deSerialize(data);
	for(prop in item) {
		if (typeof data[prop] != "undefined") {
			item[prop] = data[prop];
		}
		//Check for arrays that come in like param[1]=blah, param[2]=yack
		if (data[prop + "[0]"]) {
			var x = 0;
			var tmp = [];
			while(data[prop + "[" + x + "]"]) {
				tmp.push(data[prop + "[" + x + "]"]);
				x++;
			}
			item[prop] = tmp;
		}
	}

}

var _versionItem = function(item) {
	if (item._version || item._version === 0) {
		item._version++;
	} else {
		item._version = 0;
	}
}

/* Routes */
router.route('/:modelname')
.post(auth, function(req, res, next) {
	req.log.debug("Normal post", req.modelname);
	req.log.info(req.body);
	try {
		var item = new req.Model();
		_populateItem(item, datamunging.deserialize(req.body));
		if (req.user) {
			item._owner_id = req.user._id;
			item.__user = req.user;
		}

		item.save(function(err, result) {
			if (err) {
				req.log.error(err);
				res.status(500).send(err.toString());
				return;
			} else {
				req.log.info({ method: "post", user: req.user, data: result });
				overviewLog.info({ action_id: 4, action: "Post", type: req.modelname, id: result._id, user: req.user });
				websocket.emit(req.modelname, { method: "post", _id: result._id });
				res.status(200).json({ message: req.modelname + " created ", data: item });
				return;
			}
		});
	} catch(err) {
		req.log.error(err);
		res.status(500).send(err.toString());
		return;
	}
})
.get(auth, function(req, res) {
	var filters = {};
	try {
		filters = format_filter(req.query.filter, res);
	} catch(err) {
		req.log.error(err);
		res.status(500).send(err.toString());
		return;
	}
	var qcount = req.Model.find(filters);
	q = req.Model.find(filters);
	checkDeleted = [ { _deleted: false }, { _deleted: null }];
	if (!req.query.showDeleted) {
		qcount.or(checkDeleted);
		q.or(checkDeleted);
	}
	qcount.count(function(err, count) {
		if (err) {
			req.log.error(err);
			res.status(500).send(err.toString());
			return;
		}
		var result = {};
		result.count = count;
		// var q = req.Model.find(filters).or(checkDeleted);
		var limit = parseInt(req.query.limit);
		if (limit) {
			q.limit(limit);
			result.limit = limit;
			var page_count = Math.ceil(count / limit);
			result.page_count = page_count;
			var page = parseInt(req.query.page);
			page = (page) ? page : 1;
			result.page = page;
			if (page < page_count) {
				result.next = changeUrlParams(req, "page", (page + 1));
			}
			if (page > 1) {
				result.prev = changeUrlParams(req, "page", (page - 1));
				q.skip(limit * (page - 1));
			}
		}
		if (req.query.sort) {
			q.sort(req.query.sort);
			result.sort = req.query.sort;
		}
		if (req.query.populate) {
			try {
				q.populate(req.query.populate);
				result.populate = req.query.populate;
			} catch(err) {
				req.log.error(err);
				res.status(500).send(err.toString());
				return;
			}
		}
		if (req.query.autopopulate) {
			for(var key in req.Model.schema.paths) {
				var path = req.Model.schema.paths[key];
				if ((path.instance == "ObjectID") && (path.options.ref)) {
					q.populate(path.path);
				}
			}
			result.autopopulate = true;
		}
		try {
			q.exec(function(err, items) {
				if (err) {
					req.log.error(err);
					res.status(500).send(err.toString());
				} else {
					overviewLog.info({ action_id: 3, action: "Fetched documents", type: req.modelname, count: result.count, autopopulate: result.autopopulate, limit: result.limit, page: result.page, filters: filters, user: req.user });
					result.data = items;
					res.json(result);
				}
			});
		} catch(err) {
			req.log.error(err);
			res.status(500).send(err.toString());
			return;
		}
	});
});

/* Batch routes */
router.route('/:modelname/batch')
.post(auth, function(req, res, next) {
	req.log.debug("Batch post");
	var items = [];
	data = JSON.parse(req.body.json);
	data.forEach(function(data) {
		var item = new req.Model();
		if (req.user) {
			item.__user = req.user;
		}
		_populateItem(item, data);
		_versionItem(item);
		if (req.user) {
			item._owner_id = req.user._id;
		}
		items.push(item);
	});
	req.Model.create(items, function(err, docs) {
		if (err) {
			req.log.error(err);
			res.status(500).send(err.toString())
		} else {
			// websocket.emit(modelname, { method: "post", _id: result._id });
			overviewLog.info({ action_id: 8, action: "Batch insert", type: req.modelname, count: items.length, user: req.user });
			res.json({ message: req.modelname + " created ", data: items.length });
			return;
		}
	});
});

router.route('/:modelname/_describe')
.get(auth, function(req, res) {
	req.log.debug(Model.schema.paths);
	res.json(Model.schema.paths);
});

router.route('/:modelname/_test')
.get(auth, function(req, res) {
	req.model.debug(req.Model);
	res.send(req.Model.schema.get("test"));
});

router.route('/:modelname/_call/:method_name')
.get(auth, function(req, res) {
	req.Model[req.params.method_name]()
	.then(function(item) {
		overviewLog.info({ action_id: 7, action: "Method called", type: req.modelname, method: req.params.method_name, user: req.user });
		res.json(item);
	}, function(err) {
		req.log.error("Error 0.795", err);
		res.status(500).send(err.toString());
	});
})
.post(auth, function(req, res) {
	overviewLog.info({ action_id: 7, action: "Method called", type: req.modelname, method: req.params.method_name, user: req.user });
	req.Model[req.params.method_name](req.body)
	.then(function(result) {
		res.json(result);
	}, function(err) {
		req.log.error("Error 0.805", err);
		res.status(500).send(err.toString());
	});
});

var getOne = function(Model, item_id, params) {
	var deferred = Q.defer();
	var query = Model.findById(item_id);
	if (params.populate) {
		query.populate(params.populate);
	}
	if (params.autopopulate) {
		for(var key in Model.schema.paths) {
			var path = Model.schema.paths[key];
			if ((path.instance == "ObjectID") && (path.options.ref)) {
				query.populate(path.path);
			}
		}
	}
	query.exec(function(err, item) {
		if (err) {
			log.error(err);
			deferred.reject({ code: 500, msg: err });
			// res.status(500).send(err);
			return;
		} else {
			if (!item || item._deleted) {
				log.error("Could not find document");
				deferred.reject({ code: 404, msg: "Could not find document" });
				return;
			}
			//Don't ever return passwords
			item = item.toObject();
			delete item.password;
			deferred.resolve(item);
		}
	});
	return deferred.promise;
}

router.route('/:modelname/:item_id/:method_name')
.get(function(req, res) {
	req.Model.findById(req.params.item_id, function(err, item) {
		if (!item) {
			res.status(404).send("Document not found for " + req.params.method_name);
			return;
		}
		if (err) {
			req.log.error(err);
			res.status(500).send(err);
			return;
		}
		req.Model[req.params.method_name](item)
		.then(function(item) {
			overviewLog.info({ action_id: 7, action: "Method called", type: req.modelname, id: item._id, method: req.params.method_name, user: req.user });
			res.json(item);
		}, function(err) {
			req.log.error(err);
			res.status(500).send(err.toString())
		});
	});
});

router.route('/:modelname/:item_id')
.get(auth, function(req, res) {
	getOne(req.Model, req.params.item_id, req.query)
	.then(function(item) {
		overviewLog.info({ action_id: 2, action: "Fetched single document", type: req.modelname, id: req.params.item_id, user: req.user });
		res.send(item);
	}, function(err) {
		req.log.error(err);
		if (err.code) {
			res.status(err.code).send(err.msg);
		} else {
			res.status(500).send(err.toString());
		}
	});
})
.put(auth, function(req, res) {
	try {
		req.Model.findById(req.params.item_id, function(err, item) {
			if (err) {
				res.status(500).send(err.toString());
			} else {
				if (item) {
					_populateItem(item, datamunging.deserialize(req.body));
					_versionItem(item);
					try {
						if (req.user) {
							item.__user = req.user;
						}
						item.save(function(err, data) {
							if (err) {
								req.log.error(err);
								res.status(500).send(err.toString());
							} else {
								overviewLog.info({ action_id: 5, action: "Put", type: req.modelname, id: item._id, user: req.user });
								websocket.emit(req.modelname, { method: "put", _id: item._id });
								res.json({ message: req.modelname + " updated ", data: data });
							}
						});
					} catch(err) {
						req.log.error(err);
						res.status(500).send(err.toString());
						return;
					}
				} else {
					req.log.error("Document not found");
					res.status(404).send("Document not found");
					return;
				}
			}
		});
	} catch(err) {
		req.log.error(err);
		res.status(500).send(err.toString());
		return;
	}
})
.delete(auth, function(req, res) {
	req.Model.findById(req.params.item_id, function(err, item) {
		if (!item) {
			req.log.error("Couldn't find item for delete");
			res.status(404).send("Could not find document");
			return;
		}
		if (err) {
			req.log.error(err);
			res.status(500).send(err.toString());
			return;
		}
		if (req.user) {
			item.__user = req.user;
		}
		if (req.Model.schema.paths.hasOwnProperty("_deleted")) {
			req.log.debug("Soft deleting");
			item._deleted = true;
			_versionItem(item);
			item.save(function(err) {
				if (err) {
					req.log.error(err);
					res.status(500).send(err.toString());
				} else {
					overviewLog.info({ action_id: 6, action: "Delete", type: req.modelname, softDelete: true, id: item._id, user: req.user });
					websocket.emit(req.modelname, { method: "delete", _id: item._id });
					res.json({ message: req.modelname + ' deleted' });
				}
			})
		} else {
			req.log.debug("Hard deleting");
			item.remove(function(err) {
				if (err) {
					req.log.error(err);
					res.status(500).send(err.toString());
				} else {
					overviewLog.info({ action_id: 6, action: "Delete", type: req.modelname, softDelete: false, id: item._id, user: req.user });
					websocket.emit(req.modelname, { method: "delete", _id: item._id });
					res.json({ message: req.modelname + ' deleted' });
				}
			});
		}
	});
});

module.exports = router;
