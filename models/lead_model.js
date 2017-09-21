var mongoose     = require('mongoose');
var Schema       = mongoose.Schema;

var ObjectId = mongoose.Schema.Types.ObjectId;
var Location = require('./location_model');
var Membership = require('./membership_model');

var LeadSchema   = new Schema({
	name: { type: String, index: true },
	organisation: String,
	location_id: { type: ObjectId, index: true, ref: "Location" },
	email: { type: String, index: true },
	mobile: String,
	date_created: { type: Date, default: Date.now },
	source: String,
	url: String,
	type: String,
	intercom_id: String,
	mailtemplate_id: ObjectId,
	membership_id: { type: ObjectId, ref: "Membership" },
	short_name: String,
	legal_name: String,
	accounts_email: String,
	website: String,
	address: String,
	postal_address: String,
	vat: String,
	company_registration_number: String,
	seats: Number,
	spam: { type: Boolean, default: false },
	data: mongoose.Schema.Types.Mixed,
	_deleted: { type: Boolean, default: false, index: true },
});

LeadSchema.set("_perms", {
	admin: "crud",
	user: "cr",
	all: "c",
});

module.exports = mongoose.model('Lead', LeadSchema);