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
			const dataBuffer = Buffer.from(data);
			const messageId = await pubsub
				.topic(topicName)
				.publisher()
				.publish(dataBuffer, { type, op, _id: item._id + "" });
			console.log(`${ new Date() } Message ${messageId} published.`);
			return messageId;
		} catch(err) {
			console.error(err);
			return Promise.reject();
		}
	}
};

module.exports = MessageQueue;
