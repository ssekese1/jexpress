var mongoose     = require('mongoose');
var Schema       = mongoose.Schema;

var Objectid = mongoose.Schema.Types.ObjectId;

var PendinguserSchema   = new Schema({
	name: String,
	company: String,
	email: { type: String, unique: true, index: true },
	mobile: String,
	password: String,
});

PendinguserSchema.set("_perms", {
	admin: "crud",
	all: "c",
});

module.exports = mongoose.model('Pendinguser', PendinguserSchema);