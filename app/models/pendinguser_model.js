var mongoose     = require('mongoose');
var Schema       = mongoose.Schema;

var Objectid = mongoose.Schema.Types.ObjectId;

var PendinguserSchema   = new Schema({
	name: String,
	organisation_id: Objectid,
	email: { type: String, unique: true, index: true },
	mobile: String,
	password: String,
	referee: String,
	referal_method: String,
	url: String,
	newsletter: Boolean,
});

PendinguserSchema.set("_perms", {
	admin: "crud",
	all: "c",
});

module.exports = mongoose.model('Pendinguser', PendinguserSchema);