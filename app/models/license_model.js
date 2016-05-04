var mongoose     = require('mongoose');
var Schema       = mongoose.Schema;

var Objectid = mongoose.Schema.Types.ObjectId;
var Organisation = require("./organisation_model");
var Membership = require("./membership_model");
var User = require("./user_model");
var Location = require("./location_model");

var LicenseSchema   = new Schema({
	organisation_id: { type: Objectid, ref: 'Organisation' },
	membership_id: { type: Objectid, ref: 'Membership' },
	location_id: { type: Objectid, ref: 'Location' },
	user_id: { type: Objectid, ref: 'User' },
	date_created: { type: Date, default: Date.now },
	_owner_id: Objectid,
	_deleted: { type: Boolean, default: false, index: true },
});

LicenseSchema.set("_perms", {
	admin: "crud",
	primary_member: "ru"
});

module.exports = mongoose.model('License', LicenseSchema);