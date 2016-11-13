var mongoose     = require('mongoose');
var Schema       = mongoose.Schema;

var Objectid = mongoose.Schema.Types.ObjectId;

var GuestSchema   = new Schema({
	name: { type: String, index: true },
	organisation: String,
	location_id: Objectid,
	email: { type: String, index: true },
	mobile: String,
	invited_by: [ Objectid ],
	created_date: { type: Date, default: Date.now },
	visiting_date: Date,
	source: String,
	mac: [ mongoose.Schema.Types.Mixed ],
	ip: [ mongoose.Schema.Types.Mixed ]
});

GuestSchema.set("_perms", {
	admin: "crud",
	user: "cr",
});

module.exports = mongoose.model('Guest', GuestSchema);