var mongoose     = require('mongoose');
var Schema       = mongoose.Schema;

var friendly = require("mongoose-friendly");

var Objectid = mongoose.Schema.Types.ObjectId;
var Mixed = mongoose.Schema.Types.Mixed;
var Organisation = require("./organisation_model");
var Location = require("./location_model");
var Membership = require("./membership_model");

var UserSchema   = new Schema({
	name: { type: String },
	urlid: { type: String, unique: true, index: true },
	organisation_id: { type: Objectid, ref: "Organisation" },
	location_id: { type: Objectid, ref: "Location" },
	membership_id: { type: Objectid, ref: "Membership" },
	email: { type: String, unique: true, index: true, set: toLower },
	emails: [String],
	password: String,
	admin: Boolean,
	temp_hash: String,
	position: String,
	twitter: { type: Mixed },
	facebook: { type: Mixed },
	google: { type: Mixed },
	linkedin: { type: Mixed },
	skype: String,
	mobile: String,
	about: String,
	url: String,
	timezone: String,
	img: { type: String, default: '/avatars/grey_avatar_1.png' },
	start_date: { type: Date, default: Date.now },
	referee: String,
	referal_method: String,
	status: { type: String, validate: /active|inactive|hidden/, index: true, default: "inactive" },
	newsletter: Boolean,
	radius_id: Number,
	pin: String,
	card: String,
	first_login: { type: Boolean, default: true },
	_owner_id: Objectid,
	_deleted: { type: Boolean, default: false, index: true },
});

UserSchema.set("_perms", {
	admin: "crud",
	owner: "cru",
	user: "r",
	member: "r",
	api: "r"
});

var UserModel = mongoose.model('User', UserSchema);

UserSchema.pre("save", function(next) {
	var self = this;
	this._owner_id = this._id; // Ensure the owner is always the user for this model
	var emails = this.emails;
	if (emails.length) {
		emails.forEach(function(email) {
			console.log("Checking email ", email);
			UserModel.findOne({ email: email }, function(err, doc) {
				console.log("Check one");
				if (err) {
					return next(err);
				}
				if (doc) {
					if (doc._id.toString() !== self._id.toString()) {
						console.error("Err", "Alternative email already in use in primary mails", email, doc._id, self._id);
						self.invalidate("emails", "Alternative email already in use")
						return next(new Error('Alternative email already in use'));
						// return;
					}
				}
			
				UserModel.findOne({ emails: email }, function(err, doc) {
					console.log("Check two");
					if (err) {
						return next(err);
					}
					if (doc) {
						if (doc._id.toString() !== self._id.toString()) {
							console.error("Err", "Alternative email already in use in alternative mails", email, doc._id, self._id);
							self.invalidate("emails", "Alternative email already")
							return next(new Error('Alternative email already in use'));
							// return;
						}
					} 
					return next();
				});
			});
		});
	} else {
		return next();
	}
	
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

UserSchema.path('name').validate(function (v) {
	return v.length > 0;
}, 'Name cannot be empty');

UserSchema.plugin(friendly, {
	source: 'name',
	friendly: 'urlid'
});

function toLower (v) {
	return v.toLowerCase();
};

module.exports = mongoose.model('User', UserSchema);