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
var Q = require("q");
var jwt = require("jsonwebtoken");
var url = require('url');
var datamunging = require("../libs/datamunging");
var messagequeue = require("../libs/messagequeue");
var security = require("../libs/security");
var login = require("./login");

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
};

var changeUrlParams = function(req, key, val) {
	if (req.log)
		req.log.debug(req);
	var q = req.query;
	q[key] = val;
	var pathname = require("url").parse(req.url).pathname;
	return config.url + req._parsedOriginalUrl.pathname + "?" + querystring.stringify(q);
};

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
				};
				models.push(model);
			}
		});
		res.json(models);
	});
});

router.get('/_websocket_test', function(req, res) {
	websocket.emit('testing', { hello: 'world'});
	res.send("Sent testing");
});

/* Login Routes */
router.route("/login/recover").post(login.recover);

router.route("/login/reset").post(login.reset);

// Generates a JWT with email and apikey that can be used to log in
// Only accessible for admins
router.route("/login/getjwt").post(security.apiKeyAuth, login.getJWT);

router.route("/login/logout").get(login.logout).post(login.logout);

router.route("/login/oauth/:provider").get(login.oauth);

router.route("/login/oauth/callback/:provider").get(login.oauth_callback);

/* Our login endpoint. I'm afraid you can never have a model called login. */
router.use("/login", login.login);

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
};

/* Groups */
router.route("/_groups/:user_id")
.put(fixArrays, function(req, res, next) {
	security.apiKeyAuth(req, res, function(user) {
		if (!req.user.admin) {
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
	security.apiKeyAuth(req, res, function(user) {
		if (!req.user.admin) {
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
	security.apiKeyAuth(req, res, function(user) {
		if (!req.user.admin) {
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
	security.apiKeyAuth(req, res, function(user) {
		if (!req.user.admin) {
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
	if (req.body.password && !(req.query.password_override)) {
		var password = security.encPassword(req.body.password);
		req.body.password = password;
		log.debug("Password encrypted");
	}
	next();
});

function format_filter(filter) {
	if (typeof(filter) == "object") {
		Object.keys(filter).forEach(function(key) {
			var val = filter[key];
			try {
				if (val.indexOf(":") !== -1) {
					var tmp = val.split(":");
					filter[key] = {};
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
	for(var datum in data) {
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
};

var _populateItem = function(item, data) {
	_deSerialize(data);
	for(var prop in item) {
		if (typeof data[prop] != "undefined") {
			item[prop] = data[prop];
			// Unset any blank values - essentially 'deleting' values on editing
			if (data[prop] === "") {
				item[prop] = null;
			}
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
};

var _versionItem = function(item) {
	if (item._version || item._version === 0) {
		item._version++;
	} else {
		item._version = 0;
	}
};

/* Routes */
router.route('/:modelname')
.post(security.auth, function(req, res, next) {
	req.log.debug("Normal post", req.modelname);
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
				messagequeue.action(req.modelname, "post", req.user, result);
				res.json({ status: "ok", message: req.modelname + " created", data: item });
				return;
			}
		});
	} catch(err) {
		req.log.error(err);
		res.status(500).send(err.toString());
		return;
	}
})
.get(security.auth, function(req, res) {
	var parse_search = function(search) {
		var result = {};
		for(var i in search) {
			result[i] = new RegExp(search[i], "i");
		}
		return result;
	};

	var filters = {};
	try {
		filters = format_filter(req.query.filter);
	} catch(err) {
		req.log.error(err);
		res.status(500).send(err.toString());
		return;
	}
	var search = parse_search(req.query.search);
	for (var i in search) {
		filters[i] = search[i];
	}
	var qcount = req.Model.find(filters);
	var q = req.Model.find(filters);
	var checkDeleted = [ { _deleted: false }, { _deleted: null }];
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
			} catch(error) {
				req.log.error(error);
				res.status(500).send(error.toString());
				return;
			}
		}
		try {
			if (req.query.autopopulate) {
				for(var key in req.Model.schema.paths) {
					var path = req.Model.schema.paths[key];
					if ((path.instance == "ObjectID") && (path.options.ref)) {
						q.populate(path.path);
					}
				}
				result.autopopulate = true;
			}
		} catch(error) {
			req.log.error(error);
			res.send(500, error.toString());
			return;
		}
		try {
			q.exec(function(err, items) {
				if (err) {
					req.log.error(err);
					res.send(500, err.toString());
				} else {
					overviewLog.info({ action_id: 3, action: "Fetched documents", type: req.modelname, count: result.count, autopopulate: result.autopopulate, limit: result.limit, page: result.page, filters: filters, user: req.user });
					result.data = items;
					res.json(result);
				}
			});
		} catch(error) {
			req.log.error(error);
			res.send(500, error.toString());
			return;
		}
	});
});

/* Batch routes */
router.route('/:modelname/batch')
.post(security.auth, function(req, res, next) {
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
			res.status(500).send(err.toString());
		} else {
			// websocket.emit(modelname, { method: "post", _id: result._id });
			overviewLog.info({ action_id: 8, action: "Batch insert", type: req.modelname, count: items.length, user: req.user });
			res.json({ message: req.modelname + " created ", data: items.length });
			return;
		}
	});
});

router.route('/:modelname/_describe')
.get(security.auth, function(req, res) {
	req.log.debug(Model.schema.paths);
	res.json(Model.schema.paths);
});

router.route('/:modelname/_test')
.get(security.auth, function(req, res) {
	req.model.debug(req.Model);
	res.send(req.Model.schema.get("test"));
});

router.route('/:modelname/_call/:method_name')
.get(security.auth, function(req, res) {
	req.Model[req.params.method_name]()
	.then(function(item) {
		overviewLog.info({ action_id: 7, action: "Method called", type: req.modelname, method: req.params.method_name, user: req.user });
		res.json(item);
	}, function(err) {
		req.log.error("Error 0.795", err);
		res.status(500).send(err.toString());
	});
})
.post(security.auth, function(req, res) {
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
};

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
			res.status(500).send(err.toString());
		});
	});
});

router.route('/:modelname/:item_id')
.get(security.auth, function(req, res) {
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
.put(security.auth, function(req, res) {
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
								messagequeue.action(req.modelname, "put", req.user, data);
								res.json({ message: req.modelname + " updated ", data: data });
							}
						});
					} catch(error) {
						req.log.error(error);
						res.status(500).send(error.toString());
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
.delete(security.auth, function(req, res) {
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
					messagequeue.action(req.modelname, "delete-soft", req.user, item);
					res.json({ message: req.modelname + ' deleted' });
				}
			});
		} else {
			req.log.debug("Hard deleting");
			item.remove(function(err) {
				if (err) {
					req.log.error(err);
					res.status(500).send(err.toString());
				} else {
					overviewLog.info({ action_id: 6, action: "Delete", type: req.modelname, softDelete: false, id: item._id, user: req.user });
					websocket.emit(req.modelname, { method: "delete", _id: item._id });
					messagequeue.action(req.modelname, "delete", req.user, item);
					res.json({ message: req.modelname + ' deleted' });
				}
			});
		}
	});
});

module.exports = router;
