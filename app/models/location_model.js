var mongoose     = require('mongoose');
var Schema       = mongoose.Schema;

var LocationSchema   = new Schema({
	name: String,
	city: String,
	address: String,
	img: String,
	description: String,
	email: String,
	_deleted: { type: Boolean, default: false, index: true },
});

LocationSchema.set("_perms", {
	admin: "crud",
	user: "r",
	all: "r"
});

module.exports = mongoose.model('Location', LocationSchema);