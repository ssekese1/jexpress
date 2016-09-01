var mongoose     = require('mongoose');
var Schema       = mongoose.Schema;

var Objectid = mongoose.Schema.Types.ObjectId;
var Organisation = require("./organisation_model");
var Membership = require("./membership_model");
var User = require("./user_model");
var Location = require("./location_model");
var diff = require('deep-diff').diff;
var Log = require("./log_model");

var LicenseSchema   = new Schema({
	organisation_id: { type: Objectid, ref: 'Organisation', index: true, required: true },
	membership_id: { type: Objectid, ref: 'Membership', required: true },
	location_id: { type: Objectid, ref: 'Location', required: true },
	xero_account: String,
	user_id: { type: Objectid, ref: 'User', index: true },
	date_created: { type: Date, default: Date.now },
	_owner_id: Objectid,
	_deleted: { type: Boolean, default: false, index: true },
});

LicenseSchema.set("_perms", {
	admin: "crud",
	primary_member: "ru"
});

/*
 * Log changes
 */
LicenseSchema.post('validate', function(doc) {
	console.log("Validating");
	var self = this;
	var log = null;
	var LicenseModel = mongoose.model('License', LicenseSchema);
	LicenseModel.findOne({ _id: doc._id }, function(err, original) {
		if (!original) {
			log = new Log({
				id: doc._id,
				model: "license",
				level: 3,
				user_id: self.__user,
				title: "License created",
				message: "License created",
				code: "license-create",
				data: doc,
			}).save();
		} else {
			var d = diff(original.toObject(), doc.toObject());
			if (d) {
				log = new Log({
					id: doc._id,
					model: "license",
					level: 3,
					user_id: self.__user,
					title: "License changed",
					message: "License changed",
					code: "license-change",
					data: d,
				}).save();
			}
		}
	});
});

module.exports = mongoose.model('License', LicenseSchema);