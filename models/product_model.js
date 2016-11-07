var mongoose     = require('mongoose');
var Schema       = mongoose.Schema;

var ObjectId = mongoose.Schema.Types.ObjectId;
var ProductType = require("./producttype_model");

var ProductSchema   = new Schema({
	name: String,
	description: String,
	producttype_id: { type: ObjectId, ref: 'ProductType' },
	price: { type: Number, validate: function(v) { return (v > 0); }, required: true },
	member_discount: { type: Number, default: 0 },
	topup_size: Number,
	volume: Number,
	xero_account: String,
	xero_code: { type: String, index: true },
	_owner_id: ObjectId,
	_deleted: { type: Boolean, default: false, index: true },
});

ProductSchema.set("_perms", {
	admin: "crud",
	owner: "r",
	user: "r",
	all: "r"
});


module.exports = mongoose.model('Product', ProductSchema);