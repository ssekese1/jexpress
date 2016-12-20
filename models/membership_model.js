var mongoose     = require('mongoose');
var Schema       = mongoose.Schema;

var ObjectId = mongoose.Schema.Types.ObjectId;
var Sageanalysiscategory = require("./sageanalysiscategory_model");
var Location = require("./location_model");

var MembershipSchema   = new Schema({
	name: String,
	location_id: { type: ObjectId, ref: 'Location' },
	space_credits_per_month: Number,
	stuff_credits_per_month: Number,
	print_credits_per_month: Number,
	bandwidth_per_month: Number,
	description: String,
	marketing_description: String,
	cost: Number,
	cost_period: String,
	max_members: Number,
	cost_extra_member: Number,
	space_credits_per_month_extra_member: Number,
	stuff_credits_per_month_extra_member: Number,
	business_address: Boolean,
	hotdesk: Boolean,
	boardroom_access: Boolean,
	free_printing: Boolean,
	hotdesk_discount: Number,
	boardroom_discount: Number,
	discount_multiplier: { type: Number, default: 1 },
	special: Boolean,
	datatill_product: Number,
	papercut_group: String,
	xero_account: String,
	xero_itemid: String,
	_owner_id: ObjectId,
	_deleted: { type: Boolean, default: false, index: true },
});

MembershipSchema.set("_perms", {
	admin: "crud",
	owner: "r",
	user: "r",
	all: "r"
});

module.exports = mongoose.model('Membership', MembershipSchema);