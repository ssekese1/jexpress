var mongoose     = require('mongoose');
var Schema       = mongoose.Schema;

var Objectid = mongoose.Schema.Types.ObjectId;
var Organisation = require("./organisation_model");
var Location = require("./location_model");

var UserSchema   = new Schema({
	name: String,
	organisation_id: { type: Objectid, ref: "Organisation" },
	location_id: { type: Objectid, ref: "Location" },
	email: { type: String, unique: true, index: true },
	password: String,
	admin: Boolean,
	temp_hash: String,
	twitter: String,
	facebook: String,
	google: String,
	linkedin: String,
	skype: String,
	mobile: String,
	about: String,
	url: String,
	img: { type: String, default: '/avatars/grey_avatar_1.png' },
	start_date: { type: Date, default: Date.now },
	referee: String,
	referal_method: String,
	status: { type: String, validate: /active|inactive/, index: true, default: "inactive" },
	newsletter: Boolean,
	_owner_id: Objectid,
});

UserSchema.set("_perms", {
	admin: "cru",
	owner: "cru",
	user: "r",
});

UserSchema.post("save", function(user) {
	var Useradmin 	= require('./useradmin_model');
	Useradmin.findOne({ user_id: user._id }, function(err, useradmin) {
		if (err) {
			console.log("Err", err);
			return;
		}
		if (useradmin) {
			console.log("Useradmin already exists, bailing");
			return;
		} else {
			useradmin = Useradmin();
			useradmin.user_id = user._id;
			useradmin.extra_credits = 0;
			useradmin._owner_id = user._id;
			useradmin.save();
			console.log("Created useradmin entry");
		}
	});
});

module.exports = mongoose.model('User', UserSchema);