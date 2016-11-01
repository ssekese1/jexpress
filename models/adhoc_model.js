var mongoose     = require('mongoose');
var Schema       = mongoose.Schema;

var ObjectId = mongoose.Schema.Types.ObjectId;
var Organisation = require("./organisation_model");
var Product = require("./product_model");
var Invoice = require("./invoice_model");

var AdhocSchema   = new Schema({
	description: String,
	organisation_id: { type: ObjectId, ref: 'Organisation' },
	product_id: { type: ObjectId, ref: "Product" },
	amount: { type: Number, validate: function(v) { return (v > 0); }, required: true },
	price: { type: Number, validate: function(v) { return (v >= 0); }, required: true },
	tax_type: String,
	comment: String,
	discount: { type: Number, default: 0 },
	date_created: { type: Date, default: Date.now },
	is_quote: Boolean,
	xero_account: String,
	invoice_id: { type: ObjectId, ref: "Invoice" },
	_owner_id: ObjectId,
	_deleted: { type: Boolean, default: false, index: true },
});

AdhocSchema.set("_perms", {
	admin: "crud",
	owner: "cr",
	primary_member: "r",
	user: "",
	all: ""
});


module.exports = mongoose.model('Adhoc', AdhocSchema);