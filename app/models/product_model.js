var mongoose     = require('mongoose');
var Schema       = mongoose.Schema;

var Objectid = mongoose.Schema.Types.ObjectId;

var ProductSchema   = new Schema({
	name: String,
	description: String,
	amount: { type: Number, validate: function(v) { return (v > 0) }, required: true },
	cred_type: { type: String, validate: /space|stuff|bandwidth/, index: true, required: true },
	_owner_id: Objectid
});

ProductSchema.set("_perms", {
	admin: "crud",
	owner: "r",
	user: "r",
	all: "r"
});


module.exports = mongoose.model('Product', ProductSchema);