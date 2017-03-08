var mongoose     = require('mongoose');
// mongoose.set('debug', true);
var Schema       = mongoose.Schema;

var ObjectId = mongoose.Schema.Types.ObjectId;

var User = require("./user_model");
var Organisation = require("./organisation_model");
var Partner = require("./partner_model");
var Source = require("./source_model");
var Balance = require("./balance_model");
var Log = require("./log_model");
var moment = require("moment");
var async = require("async");

var credTypes = ["space", "stuff", "daily"];

var LedgerSchema   = new Schema({
	user_id: { type: ObjectId, index: true, ref: "User", required: true },
	organisation_id: { type: ObjectId, index: true, ref: "Organisation" },
	description: String,
	details: mongoose.Schema.Types.Mixed,
	partner_id: { type: ObjectId, index: true, ref: "Partner" },
	partner_reference: mongoose.Schema.Types.Mixed,
	date: { type: Date, default: Date.now, required: true, index: true },
	source_type: String,
	source_id: ObjectId,
	amount: { type: Number, required: true },
	balance: Number,
	reserve: { type: Boolean, default: false },
	reserve_expires: { type: Date, default: Date.now },
	cred_type: { type: String, validate: /space|stuff|creditcard|account|daily/, index: true, required: true },
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

var _calcUser = function(user) {
	var saveBalance = function(user_id, cred_type, balance) {
		return function(cb) {
			var Balance = require("./balance_model");
			Balance.findOne({ user_id: user_id, cred_type: cred_type }).exec((err, row) => {
				if (err) {
					return cb(err);
				}
				if (!row) {
					row = new Balance();
				}
				row.user_id = user_id;
				row.cred_type = cred_type;
				row.balance = balance;
				row.last_update = new Date();
				row.save((err, row) => {
					if (err)
						return cb(err);
					return cb(null, row);
				});
			});
		};
	};

	return new Promise((resolve, reject) => {
		mongoose.model('Ledger', LedgerSchema).find({ user_id: user._id }).exec(function(err, transactions) {
			var balances = {};
			credTypes.forEach(function(credType) {
				balances[credType] = 0;
			});
			if (err) {
				console.error(user.email, err);
				return reject(err);
			}
			if (!transactions) {
				return resolve(balances);
			}
			credTypes.forEach(function(credType) {
				var balance = 0;
				transactions
				.filter(transaction => {
					return credType == transaction.cred_type;
				})
				.filter(notDeleted)
				.forEach(transaction => {
					balance += transaction.amount;
				});
				balance = Math.round(balance * 100) / 100;
				balances[credType] = balance;
			});
			var queue = [];
			for (var cred_type in balances) {
				queue.push(saveBalance(user._id, cred_type, balances[cred_type]));
			}
			async.series(queue, (err, result) => {
				if (err) {
					console.error(err);
					return reject(err);
				}
				return resolve(balances);
			});
		});
	});
};

LedgerSchema.statics.sync_users = function() {
	console.log("Syncing all users");
	var queue = [];
	return getUsers()
	.then(function(users) {
		users.forEach(user => {
			queue.push(cb => {
				_calcUser(user)
				.then(result => {
					result.user_id = user._id;
					cb(null, result);
				});
			});
		});
		return new Promise((resolve, reject) => {
			async.series(queue, function(err, result) {
				console.log("Done");
				if (err)
					return reject(err);
				return resolve(result);
			});	
		});
	});
};

LedgerSchema.statics.sync_user = function(data) {
	console.log("Syncing user", data._id);
	return getUser(data._id)
	.then(function(user) {
		return _calcUser(user);
	});
};

LedgerSchema.statics.fix_balances = function(data) {
	var broke_stuff = [];
	var organisations = [];
	var queue = [];
	return getOrganisations()
	.then(function(result) {
		organisations = result;
		// console.log(organisations);
		return getUsers();
	})
	.then(function(result) {
		var users = result.map((user) => {
			return {
				_id: user._id,
				email: user.email,
				name: user.name,
				stuff_total: user.stuff_total,
				space_total: user.space_total,
				organisation_id: user.organisation_id,
				organisation: organisations.find((organisation) => {
					return "" + user.organisation_id === "" + organisation._id;
				})
			};
		});
		users.forEach(function(user) {
			if (user.organisation && user.organisation.user_id) {
				if (user.stuff_total < 0) {
					broke_stuff.push(user);
					var params = {
						sender: user.organisation.user_id,
						recipient: user._id,
						amount: user.stuff_total,
						cred_type: "stuff",
						__user: data.__user
					};
					queue.push(function(callback) {
						mongoose.model('Ledger', LedgerSchema).transfer(params)
						.then(function(result) {
							callback(null, result);
						}, function(err) {
							console.error(params, err);
							callback(err);
						});
					});
				}
			}
		});
		async.series(queue);
		return broke_stuff;
	});
};

var getUser = function(id) {
	return new Promise((resolve, reject) => {
		User.findOne({ _id: id }, function(err, user) {
			if (err) {
				console.error(err);
				return reject(err);
			}
			if (!user)
				return reject("User not found");
			return resolve(user);
		});
	});
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

LedgerSchema.statics.transfer = function(data) {
	return new Promise((resolve, reject) => {
		console.log("transfer", data);
		if ((data.sender + "" !== data.__user._id + "") && (!data.__user.admin)) {
			console.log("Reject", data.sender, data.__user._id);
			reject("This is not your account and you are not an admin");
		} else {
			var Ledger = mongoose.model('Ledger', LedgerSchema);
			// sender = data.__user;
			var credit = new Ledger();
			var debit = new Ledger();
			var sender = null;
			var recipient = null;
			getUser(data.sender)
			.then(function(user) {
				console.log(user);
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
	console.log("Confirming reserve transaction to Debit", _id);
	var Ledger = require("./ledger_model");
	Ledger.findOne({ _id: _id }, (err, ledger) => {
		console.log(ledger);
		if (err)
			throw(err);
		if (!ledger)
			throw("Could not find ledger entry");
		ledger.transaction_type = "debit";
		ledger.reserve = false;
		ledger.save((err, result) => {
			if (err)
				throw(err);
			return result;
		});
	});
};

var sender = null;

LedgerSchema.virtual("__user").set(function(user) {
	this.sender = user;
});

var getBalance = function(user_id, cred_type) {
	return new Promise((resolve, reject) => {
		Balance.findOne({ user_id: user_id, cred_type: cred_type }, (err, row) => {
			if (err)
				return reject(err);
			if (!row)
				return resolve(0);
			return resolve(row.balance);
		});
	});
};

LedgerSchema.pre("save", function(next) {
	var transaction = this;
	var search_criteria = { _id: transaction.user_id };
	if (!transaction.user_id) {
		search_criteria = { email: transaction.email };
	}
	if (!search_criteria) {
		transaction.invalidate("user_id", "could not find user");
		return next(new Error("user_id or email required"));
	}
	User.findOne(search_criteria, function(err, user) {
		if (err) {
			console.error(err);
			return next(new Error('Unknown Error'));
		}
		if (!user) {
			console.error("Could not find user", transaction.user_id || transaction.email );
			transaction.invalidate("user_id", "could not find user");
			return next(new Error('Could not find user'));
		} else {
			transaction.user_id = user._id;
			if (user.status === "inactive" || user._deleted === true) {
				console.error("User is not active", user );
				transaction.invalidate("user_id", "User is not active");
				return next(new Error('User is not active'));
			}
			Organisation.findOne({ _id: user.organisation_id }, function(err, organisation) {
				if (err) {
					console.error(err);
					return next(new Error('Could not find organisation'));
				}
				if (!organisation) {
					transaction.invalidate("user_id", "could not find organisation associated with user");
					console.log("Error 1.220: Could not find organisation associated with user", user._id);
					return next(new Error('Could not find organisation associated with user'));
				} else {
					transaction.organisation_id = organisation._id;
					// Reserves must be negative
					if ((transaction.amount > 0) && (transaction.reserve)) {
						transaction.invalidate("amount", "Reserves must be a negative value");
						console.error("Reserves must be a negative value");
						return next(new Error("Reserves must be a negative value"));
					}
					if (!organisation) {
						transaction.invalidate("user_id", "could not find organisation associated with user");
						console.log("Error 1.220: Could not find organisation associated with user", user._id);
						return next(new Error('Could not find organisation associated with user'));
					} else {
						transaction.organisation_id = organisation._id;
						// Reserves must be negative
						if ((transaction.amount > 0) && (transaction.reserve)) {
							transaction.invalidate("amount", "Reserves must be a negative value");
							console.error("Reserves must be a negative value");
							return next(new Error("Reserves must be a negative value"));
						}
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
						// Only admins can assign Credit
						if ((transaction.amount > 0) && (!transaction.sender.admin) && (!transaction.is_transfer)) {
							transaction.invalidate("amount", "Only admins can give credit. Amount must be less than zero.");
							console.error("Only admins can give credit. Amount must be less than zero.");
							return next(new Error("Only admins can give credit. Amount must be less than zero."));
						}
						// Only admins can delete non-reserve
						if ((transaction._deleted) && (transaction.transaction_type !== "reserve") && (!transaction.sender.admin)) {
							transaction.invalidate("_deleted", "Only admins can delete non-reserved.");
							console.error("Only admins can delete non-reserved.");
							return next(new Error("You are not allowed to reverse this transaction"));
						}
						// Make sure we have credit
						_calcUser(user).then(function(totals) {
							var test = transaction.amount + totals[transaction.cred_type];
							if ((transaction.amount < 0) && (test < 0)) {
								transaction.invalidate("amount", "insufficient credit");
								console.error("Insufficient credit");
								return next(new Error( "Insufficient Credit"));
							} else {
								next();
							}
						});
					}
					// Only admins can assign Credit
					if ((transaction.amount > 0) && (!transaction.sender.admin) && (!transaction.is_transfer)) {
						transaction.invalidate("amount", "Only admins can give credit. Amount must be less than zero.");
						console.error("Only admins can give credit. Amount must be less than zero.");
						return next(new Error("Only admins can give credit. Amount must be less than zero."));
					}
					// Only admins can delete non-reserve
					if ((transaction._deleted) && (transaction.transaction_type !== "reserve") && (!transaction.sender.admin)) {
						transaction.invalidate("_deleted", "Only admins can delete non-reserved.");
						console.error("Only admins can delete non-reserved.");
						return next(new Error("You are not allowed to reverse this transaction"));
					}
					// Make sure we have credit
					getBalance(user._id, transaction.cred_type).then(function(balance) {
						var test = transaction.amount + balance;
						if ((transaction.amount < 0) && (test < 0)) {
							transaction.invalidate("amount", "insufficient credit");
							console.error("Insufficient credit");
							return next(new Error( "Insufficient Credit"));
						} else {
							next();
						}
					});
				}
			});
		}
	});
});

LedgerSchema.post("save", function(transaction) { //Keep our running total up to date
	User.findOne({ _id: transaction.user_id }, function(err, user) {
		if (err) {
			console.error(err);
			return;
		}
		if (!user) {
			console.error("Could not find user", transaction.user_id);
			return;
		}
		_calcUser(user);
	});
});

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

module.exports = mongoose.model('Ledger', LedgerSchema);