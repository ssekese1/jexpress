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

There's also a special route, /:modelname/_describe, which returns the model

User model should look a bit like:

var mongoose     = require('mongoose');
var Schema       = mongoose.Schema;

var Objectid = mongoose.Schema.Types.ObjectId;

var UserSchema   = new Schema({
	name: String,
	email: String,
	password: String,
	token: String
});

module.exports = mongoose.model('User', UserSchema);

*/

var express = require('express');
var passport = require('passport')
var BasicStrategy = require('passport-http').BasicStrategy;
var LocalApiKeyStrategy = require('passport-localapikey').Strategy;
// var auth = require('./auth');
var User = require('../models/user');
var bcrypt = require('bcrypt');
var router = express.Router();

var modelname = "";
var Model = false;

/* Security! */
router.use(passport.initialize());

passport.use(
	new BasicStrategy(
	function(username, password, done) {
		User.findOne({ email: username }, function(err, user) {
			if (err) { console.log("Err"); return done(err); }
			if (!user) {
				return done(null, false, { message: 'Incorrect username.' });
			}
			if (!bcrypt.compareSync(password, user.password)) {
				return done(null, false, { message: 'Incorrect password.' });
			}
			return done(null, user);
		});
	})
);

passport.use(new LocalApiKeyStrategy(
	function(apikey, done) {
		console.log("API Key login");
		User.findOne({ apikey: apikey }, function(err, user) {
			if (err) { console.log("Err"); return done(err); }
			if (!user) {
				return done(null, false, { message: 'Incorrect token.' });
			}
			return done(null, user);
		});
	}
));

passport.serializeUser(function(user, done) {
	// console.log(user);
	done(null, user._id);
});

passport.deserializeUser(function(id, done) {
	// done(err, user);
	User.findById(id, function (err, user) {
		// console.log(user);
		done(err, user);
	});
});

var adminAuth = function(req, res, next) {
	if (req.user && req.user.admin)
		next();
	else
		res.send(401, 'Unauthorized');
		
}

var auth = passport.authenticate('localapikey', { session : false });

/* This middleware prepares the correct Model */
router.use('/:modelname', function(req, res, next) {
	modelname = req.params.modelname;
	Model = require('../models/' + modelname);
	next();
});

/* Deal with Passwords. Just always encrypt anything called 'password' */
router.use('/:modelname', function(req, res, next) {

	function encPassword(password) {
		
		return hash = bcrypt.hashSync(password, 4);
	}

	if (req.body["password"]) {
		var password = encPassword(req.body["password"]);
		req.body["password"] = password;
		console.log("Password generated: " + password)
	}
	next();
});

/* Routes */
router.route('/:modelname')
	.post(auth, adminAuth, function(req, res) {
		var item = new Model();
		for(prop in item) {
			if (req.body[prop]) {
				item[prop] = req.body[prop];
			}
		}
		console.log(item);
		item.save(function(err) {
			if (err) {
				res.send(err);
			} else {
				res.json({ message: modelname + " created ", data: item });
			}
		});
	})
	.get(auth, function(req, res) {
		Model.find(req.query.filter, function(err, items) {
			if (err) {
				res.send(err);
			} else {
				res.json(items);
			}
		});
	});

router.route('/:modelname/_describe')
	.get(auth, function(req, res) {
		console.log(Model.schema.paths);
		res.json(Model.schema.paths);
	});

router.route('/:modelname/:item_id')
	.get(auth, function(req, res) {
		Model.findById(req.params.item_id, function(err, item) {
			if (err) {
				res.send(err);
			} else {
				res.json(item);
			}
		});
	})
	.put(auth, adminAuth, function(req, res) {
		Model.findById(req.params.item_id, function(err, item) {
			if (err) {
				res.send(err);
			} else {
				for(prop in item) {
					if (req.body[prop]) {
						item[prop] = req.body[prop];
					}
				}
				item.save(function(err) {
					if (err) {
						res.send(err);
					} else {
						res.json({ message: modelname + " updated ", data: item });
					}
				});
			}
		});	
	})
	.delete(auth, adminAuth, function(req, res) {
		Model.remove({
			_id: req.params.item_id
		}, function(err, item) {
			if (err) {
				res.send(err);
			} else {
				res.json({ message: modelname + ' deleted' });
			}
		});
	});



module.exports = router;
