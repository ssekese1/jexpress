var JExpress = require("jexpress");
var config = require('../config');
var mongoose = require("mongoose");
var websocket = require('../libs/websockets.js').connect();
var messagequeue = require("../libs/messagequeue");

config.callbacks = {
	post: function(modelname, item, user) {
		websocket.emit(modelname, { method: "post", _id: item._id });
		messagequeue.action(modelname, "post", user, item);
	},
	put: function(modelname, item, user) {
		websocket.emit(modelname, { method: "put", _id: item._id });
		messagequeue.action(modelname, "put", user, item);
	},
	delete: function(modelname, item, user, opts) {
		websocket.emit(modelname, { method: "delete", _id: item._id });
		messagequeue.action(modelname, "delete", user, item);
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