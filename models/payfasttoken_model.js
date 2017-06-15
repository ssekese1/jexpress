var mongoose     = require('mongoose');
var Schema       = mongoose.Schema;

var ObjectId = mongoose.Schema.Types.ObjectId;
var User = require("./user_model");
var Organisation = require("./organisation_model");

var PayfasttokenSchema   = new Schema({
	token: { type: String, index: true, unique: true },
	user_id: { type: ObjectId, ref: 'User', index: true },
	organisation_id: { type: ObjectId, ref: 'Organisation', index: true },
	card_number: String,
	expiration_date: { type: Date, index: true },
	date_created: { type: Date, default: Date.now },
	_owner_id: ObjectId,
	_deleted: { type: Boolean, default: false, index: true },
});

PayfasttokenSchema.set("_perms", {
	super_user: "crud",
	admin: "r",
	owner: "r",
});


module.exports = mongoose.model('Payfasttoken', PayfasttokenSchema);