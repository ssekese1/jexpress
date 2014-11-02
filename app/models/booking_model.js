var mongoose     = require('mongoose');
var Schema       = mongoose.Schema;

var Objectid = mongoose.Schema.Types.ObjectId;

var BookingSchema   = new Schema({
	room: Objectid,
	start_time: Date,
	end_time: Date,
	title: String,
	member: String,
	_owner_id: Objectid
});

BookingSchema.set("_perms", {
	admin: "crud",
	owner: "crud",
	user: "cr",
});

module.exports = mongoose.model('Booking', BookingSchema);