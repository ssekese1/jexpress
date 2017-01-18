var config = require("config");
var ampq = require('amqplib');

var connection = ampq.connect(config.rabbitmq.server);

var MessageQueue = {
	action: function(type, op, user, item) {
		return connection.then(function(conn) {
			var ok = conn.createChannel();
			ok = ok.then(function(ch) {
				ch.assertQueue(config.rabbitmq.queue, {durable: true});
				ch.sendToQueue(config.rabbitmq.queue, new Buffer(JSON.stringify({ type: type, op: op, params: [ user, item ] })));
			});
			return ok;
		})
		.then(null, function(err) {
			console.error(err);
		})
		;
	}
};

module.exports = MessageQueue;