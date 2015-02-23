var mongoose     = require('mongoose');
var Schema       = mongoose.Schema;

var Objectid = mongoose.Schema.Types.ObjectId;
var Room = require("./room_model");
var User = require("./user_model");

var BookingSchema   = new Schema({
	room: { type: Objectid, ref: "Room" },
	start_time: Date,
	end_time: Date,
	title: String,
	description: String,
	message: String,
	attendees: [{ type: Objectid, ref: "User" }],
	external_attendees: [String],
	user: { type: Objectid, ref: "User" },
	cost: Number,
	created: { type: Date, default: Date.now },
	_owner_id: Objectid
});

BookingSchema.set("_perms", {
	admin: "crud",
	owner: "crud",
	user: "cr",
});

BookingSchema.post("save", function(transaction) { //Keep our running total up to date
	try {
		var Reserve = require("./reserve_model");
		var reserve = Reserve({
			user_id: transaction._owner_id,
			description: "Booking",
			amount: transaction.cost * -1,
			cred_type: "space",
			source_type: "booking",
			source_id: transaction._id
		});
		reserve.save();
	} catch(err) {
		console.log("Error", err);
		// throw(err);
	}
});

BookingSchema.post("remove", function(transaction) { //Keep our running total up to date
	console.log("Going to remove reserve");
	console.log(transaction);
	try {
		var Reserve = require("./reserve_model");
		Reserve.findOne({
			source_type: "booking",
			source_id: transaction._id
		}, function(err, item) {
			if (err) {
				console.log("Error", err);
				return;
			}
			if (!item) {
				console.log("Could not find Reserve");
				return;
			}
			item.remove();
		});
	} catch(err) {
		console.log("Error", err);
		// throw(err);
	}
});

module.exports = mongoose.model('Booking', BookingSchema);