var config = require("config");
var restler = require("restler-q");

var MessageQueue = {
	action: function(type, op, user, item) {
		return restler.post(`${ config.open_queue.server }/action`, { username: config.open_queue.username, password: config.open_queue.password, data: { type, op, params: JSON.stringify([ user, item ]) } });
	}
};

module.exports = MessageQueue;