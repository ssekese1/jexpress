var mongoose     = require('mongoose');
var Schema       = mongoose.Schema;

// var monguurl = require("monguurl");
var friendly = require("mongoose-friendly");

var Objectid = mongoose.Schema.Types.ObjectId;
var Membership = require('./membership_model');
var Location = require('./location_model');
var Sageitems = require('./sageitem_model');
var User = require('./user_model');

var OrganisationSchema   = new Schema({
	name: { type: String, unique: true, index: true },
	legal_name: String,
	urlid: { type: String, unique: true, index: true },
	tel: String,
	mobile: String,
	email: { type: String, unique: true, index: true, set: toLower },
	website: String,
	address: String,
	postal_address: String,
	twitter: String,
	facebook: String,
	linkedin: String,
	img: String,
	about: String,
	user_id: { type: Objectid, ref: 'User' },
	sage_uid: Number,
	vat: String,
	location_id: { type: Objectid, ref: 'Location' },
	space_total: { type: Number, default: 0 }, //Debit + Credit
	stuff_total: { type: Number, default: 0 }, //Debit + Credit
	membership: { type: Objectid, ref: 'Membership' },
	space_credits_per_month_override: Number,
	stuff_credits_per_month_override: Number,
	bandwidth_per_month_override: Number,
	cost_per_month_override: Number,
	items: mongoose.Schema.Types.Mixed,
	status: { type: String, validate: /active|inactive|hidden|prospect/, index: true, default: "active" },
	datatill_customer_account_id: Number,
	datatill_radius_account_id: Number,
	products: [ String ],
	year_founded: Number,
	employee_count: Number,
	start_date: { type: Date, default: Date.now },
	date_created: { type: Date, default: Date.now },
	_owner_id: Objectid,
	_deleted: { type: Boolean, default: false, index: true },
});

OrganisationSchema.set("_perms", {
	admin: "crud",
	owner: "crud",
	user: "cr",
	all: "cr"
});

OrganisationSchema.path('name').validate(function (v) {
	return v.length > 0;
}, 'Name cannot be empty');

function toLower (v) {
	return v.toLowerCase();
}

OrganisationSchema.plugin(friendly, {
	source: 'name',
	friendly: 'urlid'
});

module.exports = mongoose.model('Organisation', OrganisationSchema);