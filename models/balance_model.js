var mongoose     = require('mongoose');
var Schema       = mongoose.Schema;
var ObjectId     = mongoose.Schema.Types.ObjectId;
var User 	     = require("./user_model");
var Ledger 	     = require("./ledger_model");
var Wallet 	     = require("./wallet_model");
var Currency 	 = require("./currency_model");
var postFind 	 = require('../libs/mongoose-post-find');

var BalanceSchema   = new Schema({
	user_id: { type: ObjectId, index: true, ref: "User", required: true },
	cred_type: { type: String, index: true, required: true },
	balance: Number,
	last_update: Date,
	ledger_id: { type: ObjectId, index: true, ref: "Ledger" },
	_owner_id: ObjectId,
}, {
	strict: true
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

BalanceSchema.plugin(postFind, {
	find: function(rows, done) {
		var currencies = {};
		var wallets = null;
		Currency.find()
		.then(result => {
			result.forEach(currency => {
				currencies[currency.name.toLowerCase()] = currency._id;
			});
			return Wallet.find();
		})
		.then(result => {
			wallets = result.filter(wallet => (wallet.balance));
			rows.forEach(row => {
				row._doc.balance = 0;
				if (!currencies[row.cred_type])
					return;
				var filtered_wallets = wallets.filter(wallet => ((wallet.user_id.toString() == row.user_id.toString()) && (wallet.currency_id.toString() == currencies[row.cred_type])));
				row._doc.balance = filtered_wallets.reduce((sum, b) => ( sum + b.balance ), 0);
			});
			done(null, rows);
		})
		.catch(err => {
			console.error(err);
			done(err);
		});
	},

	findOne: function(row, done) {
		if (!row.cred_type) {
			done(null, row);
		}
		Currency.findOne({ name: row.cred_type[0].toUpperCase() + row.cred_type.slice(1) })
		.then(currency => {
			return Wallet.find({ user_id: row.user_id, currency_id: currency._id });
		})
		.then(wallets => {
			row._doc.balance = wallets.reduce((sum, b) => ( sum + b.balance ), 0);
			done(null, row);
		})
		.catch(err => {
			console.error(err);
			done(err);
		});
	}
});
module.exports = mongoose.model('Balance', BalanceSchema);
