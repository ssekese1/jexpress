var mongoose     = require('mongoose');
var Schema       = mongoose.Schema;
var ObjectId = mongoose.Schema.Types.ObjectId;

var User = require("./user_model");
var Ledger = require("./ledger_model");

var Q = require("q");

var BalanceSchema   = new Schema({
	user_id: { type: ObjectId, index: true, ref: "User", required: true },
	cred_type: { type: String, validate: /space|stuff|daily/, index: true, required: true },
	balance: Number,
	last_update: Date,
	ledger_id: { type: ObjectId, index: true, ref: "Ledger" },
	_owner_id: ObjectId,
});

BalanceSchema.set("_perms", {
	admin: "crud",
	owner: "cr",
	user: "r",
	all: ""
});

BalanceSchema.pre("save", function(next) {
	var self = this;
	this._owner_id = this.user_id; // Ensure the owner is always the user for this model
	next();
});

module.exports = mongoose.model('Balance', BalanceSchema);