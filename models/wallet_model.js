var mongoose     = require('mongoose');
var Schema       = mongoose.Schema;

var ObjectId = mongoose.Schema.Types.ObjectId;
var Currency = require('./currency_model');
var User = require("./user_model");
var Organisation = require("./organisation_model");

var WalletSchema   = new Schema({
	name: String,
	currency_id: { type: ObjectId, index: true, ref: "Currency" },
	priority: Number,
	quota_frequency: { type: String, validate: /daily|weekly|monthly|annually|never/, index: true, default: "never" },
	quota_amount: Number,
	last_quota_date: { type: Date, index: true },
	user_id: [{ type: ObjectId, index: true, ref: "User" }],
	organisation_id: { type: ObjectId, index: true, ref: "Organisation" },
	balance: { type: Number, default: 0 },
	date_created: { type: Date, default: Date.now },
	_owner_id: ObjectId
});

WalletSchema.set("_perms", {
	admin: "crud",
	user: "r",
});

module.exports = mongoose.model('Wallet', WalletSchema);