var mongoose     = require('mongoose');
var Schema       = mongoose.Schema;

var LocationSchema   = new Schema({
	name: String,
	city: String,
	address: String,
	img: String,
	description: String,
	email: String,
	sage_uid: String,
	sage_product_id: String,
	sage_taxtype_id: String,
	sage_message: String,
	_deleted: { type: Boolean, default: false, index: true },
});

LocationSchema.set("_perms", {
	admin: "crud",
	user: "r",
	all: "r"
});

module.exports = mongoose.model('Location', LocationSchema);