var JExpress = require("jexpress");
var config = require('config');
var mongoose = require("mongoose");
var websocket = require('../libs/websockets.js').connect();
var messagequeue = require("../libs/messagequeue");

var trimuser = function(user) {
	if (!user) {
		return null;
	}
	return {
		_id: user._id,
		email: user.email,
		name: user.name,
		organisation_id: user.organisation_id,
		location_id: user.location_id
	};
};

config.pre_hooks = {
	get: (req, res, next) => {
		console.log("Called Get Hook");
		if (!req.Model.schema.paths.location_id)
			return next();
		if (req.query.location_override)
			return next();
		if (req.query.filter && req.query.filter.location_id)
			return next();
		if (!req.user)
			return next();
		if (!req.query.filter)
			req.query.filter = {};
		req.query.filter.location_id = req.user.location_id + "";
		// console.log(req.query);
		next();
	}
};

config.callbacks = {
	post: function(modelname, item, user) {
		websocket.emit(modelname, { method: "post", _id: item._id });
		messagequeue.action(modelname, "post", trimuser(user), item);
	},
	put: function(modelname, item, user) {
		websocket.emit(modelname, { method: "put", _id: item._id });
		messagequeue.action(modelname, "put", trimuser(user), item);
	},
	delete: function(modelname, item, user, opts) {
		websocket.emit(modelname, { method: "delete", _id: item._id });
		messagequeue.action(modelname, "delete", trimuser(user), item);
	}
};

//DB connection
mongoose.connect('mongodb://' + config.mongo.server + '/' + config.mongo.db, function(err) {
	if (err) {
		console.log("Connection error", err);
	}
}, { db: { safe:true } }); // connect to our database

var server = new JExpress(config);

server.listen(config.port || 3001, function() {
	console.log('%s listening at %s', server.name, server.url);
});

module.exports = server; //For Testing