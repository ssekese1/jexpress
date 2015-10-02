var mongoose     = require('mongoose');
var Schema       = mongoose.Schema;

var Objectid = mongoose.Schema.Types.ObjectId;

var GuestSchema   = new Schema({
	name: String,
	organisation: String,
	location_id: Objectid,
	email: { type: String, unique: true, index: true },
	mobile: String,
	invited_by: [ Objectid ],
	created_date: { type: Date, default: Date.now },
	visiting_date: Date,
});

GuestSchema.set("_perms", {
	admin: "crud",
	user: "cr",
});

module.exports = mongoose.model('Guest', GuestSchema);