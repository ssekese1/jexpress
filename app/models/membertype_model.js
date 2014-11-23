var mongoose     = require('mongoose');
var Schema       = mongoose.Schema;

var Objectid = mongoose.Schema.Types.ObjectId;

var MembertypeSchema   = new Schema({
	name: String,
	credits_per_month: Number,
	_owner_id: Objectid,
});

MembertypeSchema.set("_perms", {
	admin: "crud",
	owner: "r",
	user: "r",
	all: "r"
});

module.exports = mongoose.model('Membertype', MembertypeSchema);