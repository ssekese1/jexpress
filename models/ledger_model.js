var mongoose     = require('mongoose');
// mongoose.set('debug', true);
var Schema       = mongoose.Schema;

var ObjectId = mongoose.Schema.Types.ObjectId;
var Mixed =  mongoose.Schema.Types.Mixed;

var User = require("./user_model");
var Organisation = require("./organisation_model");
var Partner = require("./partner_model");
var Source = require("./source_model");
var Balance = require("./balance_model");
var Log = require("./log_model");
var Currency = require("./currency_model");
var Wallet = require("./wallet_model");
var moment = require("moment");
var async = require("async");

var credTypes = ["space", "stuff", "daily"];

var LedgerSchema   = new Schema({
	user_id: { type: ObjectId, index: true, ref: "User", required: true },
	organisation_id: { type: ObjectId, index: true, ref: "Organisation" },
	description: String,
	details: Mixed,
	partner_id: { type: ObjectId, index: true, ref: "Partner" },
	partner_reference: { type: Mixed, unique: true },
	date: { type: Date, default: Date.now, required: true, index: true },
	source_type: String,
	source_id: ObjectId,
	amount: { type: Number, required: true },
	balance: Number,
	reserve: { type: Boolean, default: false },
	reserve_expires: { type: Date, default: Date.now },
	cred_type: { type: String, validate: /space|stuff|creditcard|account|daily/, index: true, required: true },
	currency_id: { type: ObjectId, index: true, ref: "Currency" },
	wallet_id: [{ type: ObjectId, index: true, ref: "Wallet" }],
	wallet_split: [ Mixed ],
	email: String,
	transaction_type: { type: String, validate: /credit|debit|reserve/ },
	is_transfer: { type: Boolean, default: false },
	_owner_id: ObjectId,
	_deleted: { type: Boolean, default: false, index: true },
});

LedgerSchema.set("_perms", {
	admin: "crud",
	owner: "cru",
	user: "cr",
	all: ""
});

var log = (id, level, title, message, data, code) => {
	log = new Log({
		id: id,
		model: "ledger",
		level,
		user_id: self.__user || null,
		title,
		message,
		code,
		data,
	}).save();
};

var logError = (id, title, message, data) => {
	log(id, 1, title, message, data, "ledger-error");
};

var notDeleted = function(item) {
	return item._deleted !== true;
};

var getUsers = function() {
	return new Promise((resolve, reject) => {
		User.find(function(err, users) {
			if (err) {
				console.error(err);
				reject(err);
			} else {
				resolve(users.filter(notDeleted));
			}
		});
	});
};

var getOrganisations = function() {
	return new Promise((resolve, reject) => {
		Organisation.find(function(err, organisations) {
			if (err) {
				console.error(err);
				return reject(err);
			}
			return resolve(organisations.filter(notDeleted));
		});
	});
};

var getUser = _id => {
	return new Promise((resolve, reject) => {
		User.findOne({_id}, (err, user) => {
			if (err)
				return reject(err);
			if (!user)
				return reject(new Error("Cannot find user"));
			if (user.status === "inactive" || user._deleted === true)
				return reject(new Error("User is inactive"));
			if (user._deleted === true)
				return reject(new Error("User is deleted"));
			resolve(user);
		});
	});
};

var getOrganisation = _id => {
	return new Promise((resolve, reject) => {
		Organisation.findOne({_id}, (err, organisation) => {
			if (err)
				return reject(err);
			if (!organisation)
				return reject(new Error("Cannot find organisation"));
			resolve(organisation);
		});
	});
};

var getLedger = _id => {
	return new Promise((resolve, reject) => {
		mongoose.model('Ledger', LedgerSchema).findOne({_id}, (err, ledger) => {
			if (err)
				return reject(err);
			// if (!ledger)
			// 	return reject(new Error("Cannot find ledger"));
			resolve(ledger);
		});
	});
};

LedgerSchema.statics.transfer = function(data) {
	return new Promise((resolve, reject) => {
		if ((data.sender + "" !== data.__user._id + "") && (!data.__user.admin)) {
			console.log("Reject", data.sender, data.__user._id);
			reject("This is not your account and you are not an admin");
		} else {
			var Ledger = require("./ledger_model");
			// sender = data.__user;
			var credit = new Ledger();
			var debit = new Ledger();
			var sender = null;
			var recipient = null;
			getUser(data.sender)
			.then(function(user) {
				sender = user;
				return getUser(data.recipient);
			})
			.then(function(user) {
				recipient = user;
				credit.user_id = data.recipient;
				credit.amount = Math.abs(data.amount);
				credit.cred_type = data.cred_type;
				credit.description = "Transfer from " + sender.name + " <" + sender.email + "> to " + recipient.name + " <" + recipient.email + ">";
				credit.__user = data.__user;
				credit.is_transfer = true;
				debit.user_id = data.sender;
				debit.amount = Math.abs(data.amount) * -1;
				debit.cred_type = data.cred_type;
				debit.description = "Transfer from " + sender.name + " <" + sender.email + "> to " + recipient.name + " <" + recipient.email + ">";
				debit.__user = data.__user;
				debit.is_transfer = true;
				debit.save(function(err, result) {
					if (err) {
						console.error(err);
						reject(err);
					} else {
						credit.save(function(err, result) {
							if (err) {
								console.error(err);
								reject(err);
							} else {
								resolve({ credit: credit, debit: debit });
							}
						});
					}
				});
			})
			.then(null, function(err) {
				console.error(err);
				reject(err);
			});
		}
	});
};

LedgerSchema.statics.confirm_reserve = function(_id) {
	return new Promise((resolve, reject) => {
		var Ledger = require("./ledger_model");
		Ledger.findOne({ _id: _id }, (err, ledger) => {
			if (err)
				reject(err);
			if (!ledger)
				reject("Could not find ledger entry");
			if (!ledger.reserve)
				reject("Ledger is not a reserve");
			ledger.transaction_type = "debit";
			ledger.reserve = false;
			ledger.save((err, result) => {
				if (err) {
					return reject(err);
				}
				resolve(result);
			});
		});
	});
};

LedgerSchema.statics.report = function(params) {
	return new Promise((resolve, reject) => {
		var Ledger = require("./ledger_model");
		params = params || {};
		find = {};
		params.start_date = params.start_date || moment().subtract(1, "month").toISOString();
		params.end_date = params.end_date || moment().toISOString();
		find.date = { "$gte": params.start_date, "$lte": params.end_date };
		if (params.cred_type && (params.cred_type != "*")) {
			find.cred_type = params.cred_type;
		} else {
			params.cred_type = "*";
		}
		if (params.partner_id && (params.partner_id != "*")) {
			find.partner_id = params.partner_id;
		} else {
			params.partner_id = "*";
		}
		Ledger.find(find).sort({ date: 1 }).exec(function(err, entries) {
			if (!entries) {
				reject("No entries found");
				return;
			}
			console.log("Entries found", entries);
			var tot = 0;
			var debs = 0;
			var creds = 0;
			entries.forEach(function(entry) {
				tot += entry.amount;
				if (entry.amount >= 0) {
					creds += entry.amount;
				} else {
					debs += entry.amount;
				}
			});
			var avg = tot / entries.length;
			resolve({ params: params, total: tot, average: avg, count: entries.length, debits: debs, credits: creds });
		});
	});
};

var totalFromWallets = (user_id, currency_id) => {
	return new Promise((resolve, reject) => {
		Wallet.find({ user_id, currency_id }).sort({ priority: 1 }).exec()
		.then(result => {
			var total = result.reduce((sum, wallet) => sum + wallet.balance, 0);
			resolve(total);
		})
		.catch(err => {
			console.error(err);
			reject();
		});
	});
};

LedgerSchema.pre("save", function(next) {
	console.log("Saving Ledger");
	var transaction = this;
	var user = null;
	var organisation = null;
	var totals = null;
	var original = null;
	var currency = null;
	if (!transaction.user_id) {
		transaction.invalidate("user_id", "could not find user");
		return next(new Error("user_id required"));
	}
	getUser(transaction.user_id)
	.then(result => {
		user = result;
		return getOrganisation(user.organisation_id);
	}, err => {
		transaction.invalidate("user_id", err);
		console.error(err);
		next(new Error(err));
	})
	.then(result => {
		organisation = result;
		if (!transaction.currency_id) {
			return Currency.findOne({ name: transaction.cred_type[0].toUpperCase() + transaction.cred_type.slice(1) });
		} else {
			return Currency.findOne({ _id: transaction.currency_id });
		}
	})
	.then(result => {
		currency = result;
		transaction.currency_id = currency._id;

		transaction.organisation_id = organisation._id;

		// Set Transaction Type
		if (transaction.amount >= 0) {
			transaction.transaction_type = "credit";
		} else {
			if (transaction.reserve) {
				transaction.transaction_type = "reserve";
			} else {
				transaction.transaction_type = "debit";
			}
		}
		// Reserves must be negative
		if ((transaction.amount > 0) && (transaction.reserve)) {
			throw("Reserves must be a negative value");
		}
		// Only admins can assign Credit
		if ((transaction.amount > 0) && (!transaction.sender.admin) && (!transaction.is_transfer)) {
			throw("Only admins can give credit. Amount must be less than zero.");
		}
		// Only admins can delete non-reserve
		if ((transaction._deleted) && (transaction.transaction_type !== "reserve") && (!transaction.sender.admin)) {
			throw("You are not allowed to reverse this transaction");
		}
		// Only admins can assign Credit
		if ((transaction.amount > 0) && (!transaction.sender.admin) && (!transaction.is_transfer)) {
			throw("Only admins can give credit. Amount must be less than zero.");
		}
		// Only admins can delete non-reserve
		if ((transaction._deleted) && (transaction.transaction_type !== "reserve") && (!transaction.sender.admin)) {
			throw("You are not allowed to reverse this transaction");
		}
	}, err => {
		transaction.invalidate("organisation_id", err);
		console.error(err);
		return next(new Error(err));
	})
	.then(result => {
		totals = result;
		if (this._id)
			return getLedger(this._id);
	})
	.then(result => {
		// If this is a reserve conversion, don't check totals
		if (result) {
			if ((result.reserve) && (!transaction.reserve)) {
				return next();
			}
		}
		// Users can only debit from their own accounts
		if ((String(transaction.user_id) !== String(transaction.sender._id)) && (!transaction.sender.admin) && (!transaction.is_transfer)) {
			throw("This is not your account");
		}
		return totalFromWallets(transaction.user_id, transaction.currency_id, transaction.amount);
	})
	.then(result => {
		// Make sure we have credit
		var test = transaction.amount + result;
		if ((transaction.amount < 0) && (test < 0)) {
			throw("Insufficient Credit");
		} else {
			next();
		}
	})
	.catch(err => {
		transaction.invalidate("amount", err);
		console.error(err);
		return next(new Error(err));
	});
});

LedgerSchema.post("save", function(transaction) { //Keep our running total up to date
	// console.log("Transaction", transaction);
	if (transaction.amount < 0) {
		Wallet.find({ user_id: transaction.user_id, currency_id: transaction.currency_id }).sort({ priority: 1 }).exec()
		.then(result => {
			// console.log("Wallets", result);
			var wallets = result;
			var outstanding = Math.abs(transaction.amount);
			var wallet_split = [];
			while ((outstanding > 0) && wallets) {
				var wallet = wallets.shift();
				if (wallet.balance) { // Ignore empty wallets
					if (outstanding <= wallet.balance) { // Enough money in this wallet;
						wallet_split.push({ _id: wallet._id, amount: outstanding, balance: wallet.balance - outstanding });
						outstanding = 0;
					} else { // Not enough money, clear out this wallet and continue
						wallet_split.push({ _id: wallet._id, amount: wallet.balance, balance: 0 });
						outstanding -= wallet.balance;
					}
				}
			}
			var queue = [];
			// console.log(wallet_split);
			wallet_split.forEach(wallet => {
				queue.push(cb => {
					Wallet.findByIdAndUpdate(wallet._id, { $set: { balance: wallet.balance } })
					.then(result => {
						cb(null, result);
					})
					.catch(err => {
						console.error(err);
						cb(err);
					});
				});
			});
			queue.push(cb => {
				LedgerModel.findByIdAndUpdate(transaction._id, { $set: { wallet_split } })
				.then(result => {
					cb(null);
				}, err => {
					cb(err);
				});
			});
			async.series(queue, (err, result) => {
				if (err)
					console.error(err);
			});
		})
		.catch(err => {
			console.error(err);
		});
	}
});

LedgerSchema.virtual("__user").set(function(user) {
	this.sender = user;
});

var LedgerModel = mongoose.model('Ledger', LedgerSchema);
module.exports = mongoose.model('Ledger', LedgerSchema);