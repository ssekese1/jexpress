var mongoose     = require('mongoose');
var Schema       = mongoose.Schema;

var LocationSchema   = new Schema({
	name: String,
	city: String,
	address: String,
	img: String,
	description: String,
});

LocationSchema.set("_perms", {
	admin: "crud",
	user: "r",
});

module.exports = mongoose.model('Location', LocationSchema);