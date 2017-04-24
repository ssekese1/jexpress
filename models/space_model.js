var mongoose     = require('mongoose');
var Schema       = mongoose.Schema;

var ObjectId = mongoose.Schema.Types.ObjectId;
var Location = require("./location_model");

var SpaceSchema   = new Schema({
	name: String,
	location_id: { type: ObjectId, ref: 'Location' },
	xero_account: String,
	meters_squared: Number,
	date_created: { type: Date, default: Date.now },
	_owner_id: ObjectId,
	_deleted: { type: Boolean, default: false, index: true },
});

SpaceSchema.set("_perms", {
	admin: "crud",
	owner: "r",
	user: "r",
	all: "r"
});

module.exports = mongoose.model('Space', SpaceSchema);