var mongoose     = require('mongoose');
var Schema       = mongoose.Schema;

var Objectid = mongoose.Schema.Types.ObjectId;

var CreditSchema   = new Schema({
	user_id: { type: Objectid, index: true },
	description: String,
	date: { type: Date, default: Date.now },
	amount: { type: Number, validate: function(v) { return (v > 0) } },
	reserved: Boolean,
	reserved_until: Date,
	cred_type: { type: String, validate: /space|stuff/, index: true },
	_owner_id: Objectid
});

CreditSchema.set("_perms", {
	admin: "crud",
	owner: "r",
	user: "",
});

CreditSchema.post("save", function(transaction) { //Keep our running total up to date
	var User = require("./user_model");
	User.findOne({ _id: transaction.user_id }, function(err, user) {
		if (err) {
			console.log("Err", err);
			return;
		}
		if (!user) {
			console.log("Could not find user", transaction.user_id);
		} else {
			(user[transaction.cred_type + "_total"]) ? user[transaction.cred_type + "_total"] = user[transaction.cred_type + "_total"] + transaction.amount : user[transaction.cred_type + "_total"] = transaction.amount;
			(user[transaction.cred_type + "_credit"]) ? user[transaction.cred_type + "_credit"] = user[transaction.cred_type + "_credit"] + transaction.amount : user[transaction.cred_type + "_credit"] = transaction.amount;
			console.log(user);
			user.save();
		}
	});
});

module.exports = mongoose.model('Credit', CreditSchema);