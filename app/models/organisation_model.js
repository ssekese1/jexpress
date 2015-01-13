var mongoose     = require('mongoose');
var Schema       = mongoose.Schema;

var Objectid = mongoose.Schema.Types.ObjectId;

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
	user_id: Objectid,
	sage_uid: Number,
	vat: String,
	_owner_id: Objectid
});

OrganisationSchema.set("_perms", {
	admin: "crud",
	owner: "crud",
	user: "cr",
	all: "r"
});

module.exports = mongoose.model('Organisation', OrganisationSchema);