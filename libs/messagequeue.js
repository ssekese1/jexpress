var config = require("config");
const {PubSub} = require('@google-cloud/pubsub');
// Instantiates a client
const pubsub = new PubSub({
	projectId: config.google.projectId,
	keyFilename: config.google.keyFilename
});
// The name for the new topic
const topicName = config.google.topicName;

var MessageQueue = {
	action: async (type, op, user, item) => {
		try {
			const data = JSON.stringify([ user, item ]);
			const data_buffer = Buffer.from(data);
			console.log({ type, op, _id: item._id + "" });
			const message_id = await pubsub.topic(topicName).publisher().publish(data_buffer, { type, op, _id: item._id + "" });
			console.log(`${ new Date() } Message ${message_id} published.`);
			return message_id;
		} catch(err) {
			console.error(err);
			return Promise.reject();
		}
	}
};

module.exports = MessageQueue;
