var mongoose     = require('mongoose');
var Schema       = mongoose.Schema;

// var monguurl = require("monguurl");
var friendly = require("mongoose-friendly");

var Objectid = mongoose.Schema.Types.ObjectId;
var Membership = require('./membership_model');
var Location = require('./location_model');
var Sageitems = require('./sageitem_model');
var User = require('./user_model');
var diff = require('deep-diff').diff;
var Log = require("./log_model");
var messagequeue = require("../libs/messagequeue");

var OrganisationSchema   = new Schema({
	name: { type: String, unique: true, index: true },
	legal_name: String,
	urlid: { type: String, unique: true, index: true },
	short_name: { type: String, unique: true, index: true, set: shortname },
	tel: String,
	mobile: String,
	email: { type: String, unique: true, index: true, set: toLower },
	accounts_email: { type: String, set: toLower },
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
	print_credits_per_month_override: Number,
	cost_per_month_override: Number,
	items: mongoose.Schema.Types.Mixed,
	status: { type: String, validate: /active|inactive|hidden|prospect|pending/, index: true, default: "active" },
	datatill_customer_account_id: Number,
	datatill_radius_account_id: Number,
	product: String,
	year_founded: Number,
	employee_count: Number,
	discount: Number,
	discount_expires: Date,
	pin: String,
	papercut_username: String,
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

function shortname(s) {
	return (s) ? s.toLowerCase().replace(/[^a-z0-9\-]+/g, "") : null;
}

OrganisationSchema.plugin(friendly, {
	source: 'name',
	friendly: 'urlid'
});
var OrganisationModel = mongoose.model('Organisation', OrganisationSchema);

/*
 * Log changes
 */
OrganisationSchema.post('validate', function(doc) {
	var self = this;
	var log = null;
	OrganisationModel.findOne({ _id: doc._id }, function(err, original) {
		if (!original) {
			log = new Log({
				id: doc._id,
				model: "organisation",
				level: 3,
				user_id: self.__user,
				title: "Organisation created",
				message: "Organisation created " + doc.email,
				code: "organisation-create",
				data: doc,
			}).save();
		} else {
			var d = diff(original.toObject(), doc.toObject());
			if (d) {
				log = new Log({
					id: doc._id,
					model: "organisation",
					level: 3,
					user_id: self.__user,
					title: "Organisation changed",
					message: "Organisation changed " + doc.email,
					code: "organisation-change",
					data: d,
				}).save();
			}
		}
	});
});

var onboard = function(id, owner) {
	messagequeue.action("organisation", "onboard", owner, id);
};

var offboard = function(id, owner) {
	messagequeue.action("organisation", "offboard", owner, id);
};

/*
 * Onboard, offboard, suspend or unsuspend a user
 */
OrganisationSchema.post('validate', function(doc) {
	var inactiveStates = ["inactive", "prospect", "pending"];
	var activeStates = ["active", "hidden"];
	var self = this;
	doc._isNew = false;
	OrganisationModel.findOne({ _id: doc._id }, function(err, original) {
		doc.active = (activeStates.indexOf(doc.status) !== -1);
		console.log("Active:", doc.active, doc.status);
		if (!original) {
			if (doc.active) {
				//New, active
				doc._isNew = true;
			}
		} else {
			original.active = (original.status !== "inactive");
			if (doc.active !== original.active) {
				//Status has changed
				if (doc.active) {
					//Status changed to active
					onboard(doc._id, self.__user);
				} else {
					//Status changed to inactive
					offboard(doc._id, self.__user);
				}
			}
			if (doc._deleted && !original._deleted) {
				//Doc has been deleted
				onboard(doc._id, self.__user);
			} else if (!doc._deleted && original._deleted) {
				//Doc has been undeleted
				offboard(doc._id, self.__user);
			}
		}
	});
});

OrganisationSchema.post('save', function(doc) {
	var self = this;
	if (doc._isNew)
		onboard(doc._id, self.__user);
});

module.exports = mongoose.model('Organisation', OrganisationSchema);