var mongoose = require("mongoose");
var Schema = mongoose.Schema;

var LocationSchema = new Schema({
	name: String,
	city: String,
	address: String,
	img: String,
	description: String,
	email: String,
	datatill_group_id: Number,
	bank_account: Number,
	bank_code: String,
	community_manager_name: String,
	community_manager_email: String,
	community_manager_tel: String,
	mail_template: String,
	xero_paypal_id: String,
	xero_creditcard_id: String,
	xero_eft_id: String,
	xero_tax_type: String,
	xero_tracking_name: String,
	clay_id: String,
	nas_ip: String,
	_deleted: { type: Boolean, default: false, index: true }
});

LocationSchema.set("_perms", {
	admin: "crud",
	user: "r",
	all: "r"
});

module.exports = mongoose.model("Location", LocationSchema);
