var mongoose     = require('mongoose');
var Schema       = mongoose.Schema;

var Objectid = mongoose.Schema.Types.ObjectId;
var Sageanalysiscategory = require("./sageanalysiscategory_model");

var MembershipSchema   = new Schema({
	name: String,
	space_credits_per_month: Number,
	stuff_credits_per_month: Number,
	print_credits_per_month: Number,
	// bandwidth_per_month: Number,
	description: String,
	cost: Number,
	cost_period: String,
	max_members: Number,
	cost_extra_member: Number,
	space_credits_per_month_extra_member: Number,
	stuff_credits_per_month_extra_member: Number,
	sage_analytics_categories: mongoose.Schema.Types.Mixed,
	// bandwidth_per_month_extra_member: Number,
	gigs: Number,
	business_address: Boolean,
	hotdesk: Boolean,
	boardroom_access: Boolean,
	free_printing: Boolean,
	hotdesk_discount: Number,
	boardroom_discount: Number,
	discount_multiplier: { type: Number, default: 1 },
	special: Boolean,
	sage: mongoose.Schema.Types.Mixed,
	datatill_product: Number,
	papercut_group: String,
	_owner_id: Objectid,
	_deleted: { type: Boolean, default: false, index: true },
});

MembershipSchema.set("_perms", {
	admin: "crud",
	owner: "r",
	user: "r",
	all: "r"
});

module.exports = mongoose.model('Membership', MembershipSchema);