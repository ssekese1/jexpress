var mongoose     = require('mongoose');
var Schema       = mongoose.Schema;

var ObjectId = mongoose.Schema.Types.ObjectId;

var Organisation = require("./organisation_model");
var User = require("./user_model");
var Location = require("./location_model");
var Membership = require("./membership_model");

var QuoteSchema   = new Schema({
	ambitions_achieve: String,
	ambitions_community: String,
	ambitions_contribution: String,
	ambitions_social_contribution: String,
	organisation_name: String,
	organisation_legal_name: String,
	organisation_product: String,
	organisation_year_founded: Number,
	organisation_employee_count: String,
	organisation_website: String,
	organisation_facebook: String,
	organisation_twitter: String,
	user_name: String,
	user_email: String,
	user_passions: String,
	user_expertise: String,
	user_mobile: String,
	user_facebook: String,
	personal_twitter: String,
	quote_number: Number,
	location_id: { type: ObjectId, ref: "Location" },
	membership_id: { type: ObjectId, ref: "Membership" },
	quote_space: String,
	quote_questions: String,
	date_created: { type: Date, default: Date.now },
	quote_accepted: { type: Boolean, default: false, index: true },
	date_accepted: Date,
	accepted_by: { type: ObjectId, ref: 'User' },
	user_id: { type: ObjectId, ref: 'User' },
	organisation_id: { type: ObjectId, ref: "Organisation" },
	_version: { type: Number, default: 0 },
	_deleted: { type: Boolean, default: false, index: true },
});

QuoteSchema.set("_perms", {
	admin: "crud"
});

module.exports = mongoose.model('Quote', QuoteSchema);