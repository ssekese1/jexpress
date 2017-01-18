// Websockets library
var Websockets = (function() {
	var self = this;
	this.io = false;
	var connect = function() {
		var config = require('config');
		var port = (config.websocket_port ? config.websocket_port : parseInt(config.port) + 1);
		console.log("Connecting to Socket.io on port", port);
		this.io = require("socket.io").listen(port);
		this.io.sockets.on('connection', function (s) {
			console.log("Socket.io connection established");
		});
		return this;
		// var io_nsp = io.of("/" + config.websocket_namespace)
	};

	var post = function(req, res, next) {
		cosole.log("Caught POST");
		console.log(req.result.data);
		this.emit(modelname, { method: "post", _id: req.result.data._id });
		next();
	};

	var emit = function(name, data) {
		this.io.sockets.emit(name, data);
	};

	var broadcast = function(data) {
		this.io.sockets.emit(data);
	};

	return {
		connect: connect,
		io: this.io,
		broadcast: broadcast,
		emit: emit,
		post: post,
	};
});

module.exports = Websockets();