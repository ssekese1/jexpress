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

Possible values are:
"c"  | create
"r"  | read
"u"  | update
"d"  | delete

###Soft Delete

If you want a model to soft delete, add a _deleted property as follows:

```
_deleted: { type: Boolean, default: false, index: true },
```

If _deleted equals true, the document will not show up when you get the list of 
documents, and calling it directly will result in a 404.

###Calling Static Methods

You can define a method for a Model in the model as follows:
```
TestSchema.statics.test = function() {
	return "Testing OKAY!";
}
```

Then to call that method through the API, use `https://my.api/api/_call/test`. 
If you POST, all variables will be passed through to the method.

*/

var express = require('express');
var User = require('../models/user_model');
var APIKey = require('../models/apikey_model');
var bcrypt = require('bcrypt');
var router = express.Router();
var config = require('../../config');
var querystring = require('querystring');
var websocket = require('../middleware/websockets.js').connect();
var Q = require("q");

var modelname = "";
var Model = false;

var deny = function(req, res, next) {
	console.log("Denying auth");
	res.status(403).send("Unauthorized");
	req.authorized = false;
}

var encPassword = function(password) {
	return hash = bcrypt.hashSync(password, 4);
}

var changeUrlParams = function(req, key, val) {
	console.log(req);
	var q = req.query;
	q[key] = val;
	var pathname = require("url").parse(req.url).pathname;
	return req.protocol + '://' + req.get('host') + req._parsedOriginalUrl.pathname + "?" + querystring.stringify(q);
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
	var apikey = false;
	if (req.query.apikey) {
		apikey = req.query.apikey;
	} else if (req.headers.authorization) {
		try {
			parts = req.headers.authorization.split(" ");
			if (parts[0].toLowerCase() == "api_key") {
				apikey = parts[1];
			}
		} catch(err) {
			// Do nothing
		}
	}
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
			return next(user);
		});
	});
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
			console.log(modelobj.schema.get("_perms").size);
			if (modelobj.schema.get("_perms") && (modelobj.schema.get("_perms").admin || modelobj.schema.get("_perms").user || modelobj.schema.get("_perms").owner || modelobj.schema.get("_perms").all)) {
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

router.route('/_websocket_test')
	.get(function(req, res) {
		// io.on('connection', function (socket) {
			websocket.emit('testing', { hello: 'world'});
			res.send("Sent testing");
		// 	socket.emit('news', { hello: 'world' });
		// 	socket.on('test', function (data) {
		// 		console.log(data);
		// 		res.json(data);
		// 	});
		// });
	});

/* Password recovery */
router.route("/login/recover").post(function(req, res, next) {
	var email = req.body.email;
	if (!email) {
		console.log("Missing email");
		deny(req, res, next);
		return;
	}
	User.findOne({ email: email }, function(err, user) {
		if (err) { console.log("Err"); return done(err); }
		if (!user) {
			console.log("Incorrect username");
			deny(req, res, next);
			return;
		}
		user.temp_hash = require('rand-token').generate(16);
		user.save(function(err) {
			if (err) { console.log("Err"); return done(err); }
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
				console.log("Mailer result", result);
			});
			res.send("Sent recovery email");
		});
	});
});

router.route("/login/reset").post(function(req, res, next) {
	var password = req.body.password;
	var temp_hash = req.body.temp_hash;
	if (temp_hash.length < 16) {
		console.log("Hash error");
		deny(req, res, next);
		return;
	}
	if (password.length < 4) {
		console.log("Password too short");
		deny(req, res, next);
		return;
	}
	User.findOne({ temp_hash: temp_hash }, function(err, user) {
		if (err) { console.log("Err"); return done(err); }
		if (!user) {
			console.log("Hash not found");
			deny(req, res, next);
			return;
		}
		user.password = encPassword(password);
		user.temp_hash = "";
		user.save(function(err) {
			if (err) { console.log("Err"); return done(err); }
			res.send("User updated");
			return;
		});
	})
});

router.route("/login/logout").get(function(req, res, next) {
	var apikey = req.query.apikey;
	APIKey.findOne({ apikey: apikey }, function(err, apikey) {
		if (err) { 
			console.log("Err", err);
			deny(req, res, next);
			return;
		}
		if (!apikey) {
			console.log("API Key not found");
			deny(req, res, next);
			return;
		}
		apikey.remove(function(err, item) {
			if (err) { 
				console.log("Err", err);
				deny(req, res, next);
				return;
			}
			res.send("User logged out");
		});
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
		console.log("Missing email or password");
		deny(req, res, next);
		return;
	}
	User.findOne({ email: email }, function(err, user) {
		if (err) { console.log("Err"); return done(err); }
		if (!user) {
			console.log("Incorrect username");
			deny(req, res, next);
			return;
		}
		try {
			if (!bcrypt.compareSync(password, user.password)) {
				console.log("Incorrect password");
				deny(req, res, next);
				return;
			}
		} catch (err) {
			console.log("Erm, something went wrong");
			console.log(err);
			deny(req, res, next);
			return;
		}
		//Generate new API key
		var apikey = new APIKey();
		apikey.user_id = user._id;
		apikey.apikey = require('rand-token').generate(16);

		apikey.save(function(err) {
			if (err) {
				console.log("Error", err);
				deny(req, res, next);
				return;
			}
			// console.log(user);
			res.json(apikey);
		});
	});
});



/* This middleware prepares the correct Model */
router.use('/:modelname', function(req, res, next) {
	modelname = req.params.modelname;
	try {
		Model = require('../models/' + modelname + "_model");
		next();
	} catch(err) {
		res.status(404).send("Model " + modelname + " not found");

	}
});

/* Deal with Passwords. Just always encrypt anything called 'password' */
router.use('/:modelname', function(req, res, next) {

	if (req.body["password"] && !(req.query["password_override"])) {
		var password = encPassword(req.body["password"]);
		req.body["password"] = password;
		console.log("Password generated: " + password)
	}
	next();
});

/* This is our security module. See header for instructions */
var auth = function(req, res, next) {
	// console.log("permAuth");
	// Check against model as to whether we're allowed to edit this model
	var user = req.user;
	var perms = Model.schema.get("_perms");
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
		console.log("Unsupported method", req.method);
		deny(req, res, next);
		return;
	}
	req.authorized = false;
	//If no perms are set, then this isn't an available model
	console.log("perms", perms.admin);
	if (!perms.admin) {
		console.log("Model not available");
		deny(req, res, next);
		return;
	}
	//First check if "all" is able to do this. If so, let's get on with it.
	if (perms["all"]) {
		if (perms["all"].indexOf(method) !== -1) {
			console.log("Matched permission 'all':", method);
			req.authorized = true;
			next();
			return;
		}
	}
	
	//This isn't an 'all' situation, so let's log the user in and go from there
	apiKeyAuth(req, res, function(user) {
		//Let's check perms in this order - admin, user, owner
		//Admin check
		if ((perms["admin"]) && (perms["admin"].indexOf(method) !== -1)) {
			console.log("Matched permission 'admin':", method);
			req.authorized = true;
			next();
			return;
		}
		//User check
		if ((perms["user"]) && (perms["user"].indexOf(method) !== -1)) {
			console.log("Matched permission 'user':", method);
			req.authorized = true;
			next();
			return;
		}
		//Owner check
		var owner_id = false;
		Model.findById(req.params.item_id, function(err, item) {
			if (err) {
				console.log("Err", err);
			}
			if ((item) && (item._owner_id) && (item._owner_id.toString() == user._id.toString()) && ((perms["owner"]) && (perms["owner"].indexOf(method) !== -1))) {
					console.log("Matched permission 'owner':", method);
					req.authorized = true;
					next();
					return;
			} else {
				console.log("All authorizations failed");
				if(!req.authorized) {
					deny(req, res, next);
					return;
				}
			}
		});
	}, function(code, err) {
		console.log("API key fail", code, err);
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
	console.log("Filter:", filter);
	return filter;
}

var _populateItem = function(item, data) {
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
		console.log("Normal post");
		try {
			var item = new Model();
			_populateItem(item, req.body);
			if (req.user) {
				item._owner_id = req.user._id;
			}
			item.save(function(err, result) {
				if (err) {
					console.log(err);
					res.status(500).send("An error occured:" + err);
					return;
				} else {
					websocket.emit(modelname, { method: "post", _id: result._id });
					res.status(200).json({ message: modelname + " created ", data: item });
					return;
				}
			});
		} catch(err) {
			res.status(500).send("An error occured:" + err);
		}
	})
	.get(auth, function(req, res) {
		var filters = {};
		try {
			filters = format_filter(req.query.filter, res);
		} catch(err) {
			res.status(500).send("An error occured:" + err)
		}
		var checkDeleted = null;
		if (Model.schema.paths.hasOwnProperty("_deleted")) {
			checkDeleted = [ { _deleted: false }, { _deleted: null }];
		}
		Model.find(filters).or(checkDeleted).count(function(err, count) {
			var result = {};
			result.count = count;
			var q = Model.find(filters).or(checkDeleted);
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
				q.populate(req.query.populate);
				result.populate = req.query.populate;
			}
			if (req.query.autopopulate) {
				for(var key in Model.schema.paths) {
					var path = Model.schema.paths[key];
					if ((path.instance == "ObjectID") && (path.options.ref)) {
						q.populate(path.path);
					}
				}
				result.autopopulate = true;
			}
			q.exec(function(err, items) {
				if (err) {
					res.status(500).send(err);
				} else {
					result.data = items;
					res.json(result);
				}
			});
		});
	});

/* Batch routes */
router.route('/:modelname/batch')
	.post(auth, function(req, res, next) {
		console.log("Batch post");
		var items = [];
		data = JSON.parse(req.body.json);
		data.forEach(function(data) {
			var item = new Model();
			_populateItem(item, data);
			_versionItem(item);
			if (req.user) {
				item._owner_id = req.user._id;
			}
			items.push(item);
		});
		Model.create(items, function(err, docs) {
			if (err) {
				console.log(err);
				res.status(500).send("An error occured:" + err)
			} else {
				// websocket.emit(modelname, { method: "post", _id: result._id });
				res.json({ message: modelname + " created ", data: items.length });
				return;
			}
		});
	});

router.route('/:modelname/_describe')
	.get(auth, function(req, res) {
		console.log(Model.schema.paths);
		res.json(Model.schema.paths);
	});

router.route('/:modelname/_test')
	.get(auth, function(req, res) {
		console.log(Model);
		res.send(Model.schema.get("test"));
	});

router.route('/:modelname/_call/:method_name')
.get(auth, function(req, res) {
	Model[req.params.method_name]()
	.then(function(item) {
		res.json(item);
	}, function(err) {
		res.status(500).send(err)
	});
})
.post(auth, function(req, res) {
	var result = Model[req.params.method_name](req.body);
	res.json(result);
});

var getOne = function(item_id, params) {
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
			deferred.reject({ code: 500, msg: err });
			// res.status(500).send(err);
			return;
		} else {
			if (!item || item._deleted) {
				// console.log("Err 404", item);
				deferred.reject({ code: 404, msg: "Could not find document" });
				// res.status(404).send("Could not find document");
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
	Model.findById(req.params.item_id, function(err, item) {
		if (!item) {
			res.status(404).send("Document not found for " + req.params.method_name);
			return;
		}
		if (err) {
			console.log("Err", err);
			res.status(500).send(err);
			return;
		}
		Model[req.params.method_name](item)
		.then(function(item) {
			res.json(item);
		}, function(err) {
			res.status(500).send(err)
		});
	});
});

router.route('/:modelname/:item_id')
	.get(auth, function(req, res) {
		getOne(req.params.item_id, req.query)
		.then(function(item) {
			res.send(item);
		}, function(err) {
			console.log("Err", err);
			if (err.code) {
				res.status(err.code).send(err.msg);
			} else {
				res.status(500).send(err);
			}
		});
	})
	.put(auth, function(req, res) {
		try {
			Model.findById(req.params.item_id, function(err, item) {
				if (err) {
					res.status(500).send(err);
				} else {
					if (item) {
						_populateItem(item, req.body);
						_versionItem(item);
						try {
							item.save(function(err, data) {
								if (err) {
									res.status(500).send(err);
								} else {
									websocket.emit(modelname, { method: "put", _id: item._id });
									res.json({ message: modelname + " updated ", data: data });
								}
							});
						} catch(err) {
							res.status(500).send("An error occured:", err)
						}
					} else {
						res.status(404).send("Document not found");
					}
				}
			});
		} catch(err) {
			res.status(500).send("An error occured:", err)
		}
	})
	.delete(auth, function(req, res) {
		Model.findById(req.params.item_id, function(err, item) {
			if (!item) {
				console.log("Couldn't find item for delete");
				res.status(404).send("Could not find document");
				return;
			}
			if (err) {
				console.error("Error: ", err);
				res.status(500).send(err);
				return;
			}
			if (Model.schema.paths.hasOwnProperty("_deleted")) {
				console.log("Soft deleting");
				item._deleted = true;
				_versionItem(item);
				item.save(function(err) {
					if (err) {
						res.status(500).send(err);
					} else {
						websocket.emit(modelname, { method: "delete", _id: item._id });
						res.json({ message: modelname + ' deleted' });
					}
				})
			} else {
				console.log("Hard deleting");
				item.remove(function(err) {
					if (err) {
						res.status(500).send(err);
					} else {
						websocket.emit(modelname, { method: "delete", _id: item._id });
						res.json({ message: modelname + ' deleted' });
					}
				});
			}
		});
	});

module.exports = router;
