var mongoose     = require('mongoose');
// mongoose.set('debug', true);
var Schema       = mongoose.Schema;

var Objectid = mongoose.Schema.Types.ObjectId;

var User = require("./user_model");
var Organisation = require("./organisation_model");
var Source = require("./source_model");
var moment = require("moment");
var async = require("async");

var Q = require("q");

var credTypes = ["space", "stuff", "daily"];

var LedgerSchema   = new Schema({
	user_id: { type: Objectid, index: true, ref: "User", required: true },
	organisation_id: { type: Objectid, index: true, ref: "Organisation" },
	description: String,
	details: mongoose.Schema.Types.Mixed,
	partner_id: Objectid,
	partner_reference: mongoose.Schema.Types.Mixed,
	date: { type: Date, default: Date.now, required: true, index: true },
	source_type: String,
	source_id: Objectid,
	amount: { type: Number, required: true },
	balance: Number,
	reserve: { type: Boolean, default: false },
	reserve_expires: { type: Date, default: Date.now },
	cred_type: { type: String, validate: /space|stuff|creditcard|account|daily/, index: true, required: true },
	email: String,
	transaction_type: { type: String, validate: /credit|debit|reserve/ },
	_owner_id: Objectid,
	_deleted: { type: Boolean, default: false, index: true },
});

LedgerSchema.set("_perms", {
	admin: "crud",
	owner: "cru",
	user: "cr",
	all: ""
});


var _calcUser = function(user) {
	var Balance = require("./balance_model");
	var saveBalance = function(user_id, cred_type, balance) {
		return function(cb) {
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

	deferred = Q.defer();
	mongoose.model('Ledger', LedgerSchema).find({ user_id: user._id }).exec(function(err, transactions) {
		if (err) {
			console.error(user.email, err);
			deferred.reject(err);
			return;
		}
		if (!transactions) {
			return deferred.reject("No transactions found", user._id, user.email);
		}
		console.log("Total transactions", transactions.length);
		balances = {};
		credTypes.forEach(function(credType) {
			var balance = 0;
			transactions.filter((transaction) => {
				return credType == transaction.cred_type;
			}).forEach((transaction) => {
				if (!transaction._deleted)
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
			if (err) 
				console.error(err);
			console.log(result);
		});
		
		var totals = {
			stuff: 0,
			space: 0
		};
		transactions.forEach(function(transaction) {
			if (!transaction._deleted)
				totals[transaction.cred_type] += transaction.amount;
		});
		totals.stuff = Math.round(totals.stuff * 100) / 100;
		totals.space = Math.round(totals.space * 100) / 100;
		user.stuff_total = totals.stuff;
		user.space_total = totals.space;
		user.save((err, result) => {
			if (err) {
				console.error(user.email, err);
			}
			console.log("Totals", user.email, totals);
			deferred.resolve(totals);
		});
	});
	return deferred.promise;
};

LedgerSchema.statics.sync_users = function() {
	console.log("Syncing all users");
	return getUsers()
	.then(function(users) {
		console.log(users.length);
		var tasks = users.map(function(user) {
			return function() {
				console.log(user.email);
				return _calcUser(user);
			};
		});
		tasks.push(function() {
			return(users.length + " Users synced");
		});
		return tasks.reduce(function(soFar, f) {
			return soFar.then(f);
		}, Q());
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
	var deferred = Q.defer();
	User.findOne({ _id: id }, function(err, user) {
		if (err) {
			console.error(err);
			deferred.reject(err);
		} else {
			deferred.resolve(user);
		}
	});
	return deferred.promise;
};

var notDeleted = function(item) {
	return item._deleted !== true;
};

var getUsers = function() {
	var deferred = Q.defer();
	User.find(function(err, users) {
		if (err) {
			console.error(err);
			deferred.reject(err);
		} else {
			deferred.resolve(users.filter(notDeleted));
		}
	});
	return deferred.promise;
};

var getOrganisations = function() {
	var deferred = Q.defer();
	Organisation.find(function(err, organisations) {
		if (err) {
			console.error(err);
			deferred.reject(err);
		} else {
			deferred.resolve(organisations.filter(notDeleted));
		}
	});
	return deferred.promise;
};

LedgerSchema.statics.transfer = function(data) {
	var deferred = Q.defer();
	console.log("transfer", data);
	if ((data.sender !== data.__user._id) && (!data.__user.admin)) {
		deferred.reject("This is not your account and you are not an admin");
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
			debit.user_id = data.sender;
			debit.amount = Math.abs(data.amount) * -1;
			debit.cred_type = data.cred_type;
			debit.description = "Transfer from " + sender.name + " <" + sender.email + "> to " + recipient.name + " <" + recipient.email + ">";
			debit.__user = data.__user;
			debit.save(function(err, result) {
				if (err) {
					console.error(err);
					deferred.reject(err);
				} else {
					credit.save(function(err, result) {
						if (err) {
							console.error(err);
							deferred.reject(err);
						} else {
							deferred.resolve({ credit: credit, debit: debit });
						}
					});
				}
			});
		})
		.then(null, function(err) {
			console.error(err);
			deferred.reject(err);
		});
	}
	return deferred.promise;
};

LedgerSchema.statics.syncOrg = function(data) {
	console.log("Data", data);
	return _syncOrg(data.organisation_id);
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
	var Balance = require("./balance_model");
	var deferred = Q.defer();
	Balance.findOne({ user_id: user_id, cred_type: cred_type }, (err, row) => {
		if (err)
			return deferred.reject(err);
		if (!row)
			return deferred.resolve(0);
		return deferred.resolve(row.balance);
	});
	return deferred.promise;
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
							log.error("Reserves must be a negative value");
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
						if ((transaction.amount > 0) && (!sender.admin)) {
							transaction.invalidate("amount", "Only admins can give credit. Amount must be less than zero.");
							log.error("Only admins can give credit. Amount must be less than zero.");
							return next(new Error("Only admins can give credit. Amount must be less than zero."));
						}
						// Only admins can delete non-reserve
						if ((transaction._deleted) && (transaction.transaction_type !== "reserve") && (!sender.admin)) {
							transaction.invalidate("_deleted", "Only admins can delete non-reserved.");
							log.error("Only admins can delete non-reserved.");
							return next(new Error("You are not allowed to reverse this transaction"));
						}
						// Make sure we have credit
						_calcOrg(organisation).then(function(totals) {
							var test = transaction.amount + totals[transaction.cred_type];
							if ((transaction.amount < 0) && (test < 0)) {
								transaction.invalidate("amount", "insufficient credit");
								log.error("Insufficient credit");
								return next(new Error( "Insufficient Credit"));
							} else {
								next();
							}
						});
					}
					// Only admins can assign Credit
					if ((transaction.amount > 0) && (!transaction.sender.admin)) {
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
	var deferred = Q.defer();
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
			deferred.reject("No entries found");
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
		deferred.resolve({ params: params, total: tot, average: avg, count: entries.length, debits: debs, credits: creds });
	});
	return deferred.promise;
};

module.exports = mongoose.model('Ledger', LedgerSchema);