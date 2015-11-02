var mongoose     = require('mongoose');
var Schema       = mongoose.Schema;

var Objectid = mongoose.Schema.Types.ObjectId;
var Location = require('./location_model');

var SageitemSchema   = new Schema({
	id: { type: Number, index: true },
	code: String,
	description: String,
	price_inclusive: Number,
	price_exclusive: Number,
	location: { type: Objectid, index: true, ref: "Location" },
	category: mongoose.Schema.Types.Mixed,
	tax_type_id: Number,
	text_user_field_1: String,
	text_user_field_2: String,
	text_user_field_3: String,
	yes_no_user_field_1: Boolean,
	yes_no_user_field_2: Boolean,
	yes_no_user_field_3: Boolean,
	_owner_id: Objectid
});

SageitemSchema.set("_perms", {
	admin: "crud",
	owner: "cr",
	user: ""
});

module.exports = mongoose.model('Sageitem', SageitemSchema);