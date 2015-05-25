var mongoose     = require('mongoose');
var Schema       = mongoose.Schema;

var Objectid = mongoose.Schema.Types.ObjectId;
var Membership = require('./membership_model');
var Location = require('./location_model');
var User = require('./user_model');

var OrganisationSchema   = new Schema({
	name: { type: String, unique: true, index: true },
	tel: String,
	mobile: String,
	email: String,
	website: String,
	address: String,
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
	space_reserve: { type: Number, default: 0 },
	space_purchase: { type: Number, default: 0 },
	space_credit: { type: Number, default: 0 },
	stuff_total: { type: Number, default: 0 }, //Debit + Credit
	stuff_reserve: { type: Number, default: 0 },
	stuff_purchase: { type: Number, default: 0 },
	stuff_credit: { type: Number, default: 0 },
	membership: { type: Objectid, ref: 'Membership' },
	_owner_id: Objectid,
	_deleted: { type: Boolean, default: false, index: true },
});

OrganisationSchema.set("_perms", {
	admin: "crud",
	owner: "crud",
	user: "cr",
	all: "r"
});

module.exports = mongoose.model('Organisation', OrganisationSchema);