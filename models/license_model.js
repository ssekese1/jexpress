var mongoose     = require('mongoose');
var Schema       = mongoose.Schema;

var Objectid = mongoose.Schema.Types.ObjectId;
var Organisation = require("./organisation_model");
var Membership = require("./membership_model");
var User = require("./user_model");
var Location = require("./location_model");

var LicenseSchema   = new Schema({
	organisation_id: { type: Objectid, ref: 'Organisation', index: true, required: true },
	membership_id: { type: Objectid, ref: 'Membership', required: true },
	location_id: { type: Objectid, ref: 'Location', required: true },
	xero_account: String,
	user_id: { type: Objectid, ref: 'User', index: true },
	date_created: { type: Date, default: Date.now },
	_owner_id: Objectid,
	_deleted: { type: Boolean, default: false, index: true },
});

LicenseSchema.set("_perms", {
	admin: "crud",
	primary_member: "ru"
});

module.exports = mongoose.model('License', LicenseSchema);