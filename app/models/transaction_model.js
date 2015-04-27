var mongoose     = require('mongoose');
var Schema       = mongoose.Schema;

var Objectid = mongoose.Schema.Types.ObjectId;

var User = require("./user_model");
var Organisation = require("./organisation_model");
var Product = require("./product_model");

var TransactionSchema   = new Schema({
	user_id: { type: Objectid, index: true, required: true, ref: "User" },
	organisation_id: { type: Objectid, index: true, ref: "Organisation" },
	product_id: { type: Objectid, index: true, ref: "Product" },
	description: String,
	date: { type: Date, default: Date.now },
	amount: { type: Number, validate: function(v) { return (v > 0) }, required: true },
	cred_type: { type: String, validate: /space|stuff|bandwidth/, index: true, required: true },
	transaction_status: Number,
	result_code: Number,
	auth_code: Number,
	result_desc: String,
	transaction_id: { type: Number, unique: true },
	risk_indicator: String,
	_owner_id: Objectid
});

TransactionSchema.set("_perms", {
	admin: "crud",
	owner: "ru",
	user: "",
});


module.exports = mongoose.model('Transaction', TransactionSchema);