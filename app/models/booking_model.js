var mongoose     = require('mongoose');
var Schema       = mongoose.Schema;

var Objectid = mongoose.Schema.Types.ObjectId;
var Room = require("./room_model");
var User = require("./user_model");
var Reserve = require("./reserve_model");

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

BookingSchema.pre("save", function(next) {

	console.log("Looking for existing reserve");
	transaction = this;
	console.log(transaction);
	try {
		
		//Remove the reserve if it already exists
		
		Reserve.findOne({
			source_type: "booking",
			source_id: transaction._id
		}, function(err, item) {
			if (item) {
				console.log("Found existing reserve, removing it");
				item.remove();
			}
		});
		
	} catch(err) {
		console.log("Error", err);
		// throw(err);
	}

	//Is this free? If so, cool, don't do any more
	if (!transaction.cost) {
		return next();
	}

	//Reserve the moneyz
	//We do this here, because if it fails we don't want to process the payment.
	try {
		var reserve = Reserve({
			user_id: transaction.user,
			description: "Booking",
			amount: transaction.cost * -1,
			cred_type: "space",
			source_type: "booking",
			source_id: transaction._id
		});
		console.log(reserve);
		reserve.save(function(err) {
			if (err) {
				console.error(err);
				return next(err);
			}
			return next();
		});
	} catch(err) {
		console.log("Error", err); 
		//Roll back booking

	}
})

BookingSchema.post("save", function(transaction) {
	
});

BookingSchema.post("remove", function(transaction) { //Keep our running total up to date
	console.log("Remove called, Going to remove reserve");
	console.log(transaction);
	try {
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