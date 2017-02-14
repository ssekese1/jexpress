var config = require('config');
var WebSocket = require("ws");

module.exports = (function() {
	if (!config.websocket) {
		console.error("Websocket not configured");
		return;
	}
	var ws = new WebSocket(config.websocket);
	var self = this;
	self.connected = false;
	ws.on("open", () => {
		console.log("Connected to WebSocket " + config.websocket);
		self.connected = true;
	});
	self.emit = (model, action, _id) => {
		var data = {
			type: "broadcast",
			action,
			model,
			_id,
			room: model + "s"
		};
		ws.send(JSON.stringify(data));
	};

	return this;
});