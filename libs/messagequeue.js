var config = require("config");
var ampq = require('amqplib');

var connection = ampq.connect(config.rabbitmq.server);

var MessageQueue = {
	action: function(type, op, user, item) {
		return connection
		.then(function(conn) {
			return conn.createChannel();
		})
		.then(ch => {
			ch.assertQueue(config.rabbitmq.queue, {durable: true});
			var data = { type: type, op: op, params: [ user, item ], timestamp: +new Date() };
			// console.log("RabbitMQ data", JSON.stringify(data));
			return ch.sendToQueue(config.rabbitmq.queue, new Buffer(JSON.stringify(data)));
		})
		.then(null, function(err) {
			console.error("RabbitMQ error", err);
		})
		;
	}
};

module.exports = MessageQueue;