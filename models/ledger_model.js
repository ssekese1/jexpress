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
	cred_type: { type: String, validate: /space|stuff/, index: true, required: true },
	email: String,
	transaction_type: { type: String, validate: /credit|debit|reserve/ },
	_owner_id: Objectid,
	_deleted: { type: Boolean, default: false, index: true },
});

LedgerSchema.set("_perms", {
	admin: "crud",
	owner: "cr",
	user: "cr",
	all: ""
});

// LedgerSchema.statics.move = function() { //Move all old reserves, credits and debits into here
// 	var Ledger = this;
// 	var Credit = require("./credit_model");
// 	var Purchase = require("./purchase_model");
// 	var Reserve = require("./reserve_model");
// 	Credit.find(function(err, data) {
// 		data.forEach(function(row) {
// 			try {
// 				var ledger = new Ledger(row);
// 				ledger.save();
// 			} catch(e) {
// 				console.log("Error", e, ledger);
// 			}
// 		});
// 	});
// 	Purchase.find(function(err, data) {
// 		data.forEach(function(row) {
// 			var ledger = new Ledger(row);
// 			ledger.save();
// 		});
// 	});
// 	Reserve.find(function(err, data) {
// 		data.forEach(function(row) {
// 			var ledger = new Ledger(row);
// 			ledger.reserve = true;
// 			ledger.save();
// 		});
// 	});
// 	return "Okay";
// }

var _calcOrg = function(organisation) {
	var start = new Date().getTime();
	if (!organisation || !organisation._id || !organisation.name) {
		throw("Missing organisation ID or name");
	}
	console.log("Starting timer for", organisation._id, organisation.name);
	deferred = Q.defer();
	require("./ledger_model").where("organisation_id", organisation._id).exec(function(err, transactions) {
		if (err) {
			deferred.reject(err);
			return;
		}
		if (!transactions) {
			return deferred.reject("No transactions found", organisation._id, organisation.name);
		}
		console.log("get ledger lines", new Date().getTime() - start);
		var totals = {
			stuff: 0,
			space: 0
		};
		transactions.forEach(function(transaction) {
			totals[transaction.cred_type] += transaction.amount;
		});
		console.log("add transactions", new Date().getTime() - start);
		organisation.stuff_total = Math.round(totals.stuff * 100) / 100;
		organisation.space_total = Math.round(totals.space * 100) / 100;
		organisation.save();
		console.log("save", new Date().getTime() - start);
		console.log("Totals", organisation.name, totals);
		deferred.resolve(totals);
	});
	return deferred.promise;
};

var _calcUser = function(user) {
	console.time("_calcUser");
	deferred = Q.defer();
	console.log(user.email);
	mongoose.model('Ledger', LedgerSchema).find({ user_id: user._id }).exec(function(err, transactions) {
		if (err) {
			console.error(user.email, err);
			deferred.reject(err);
			return;
		}
		if (!transactions) {
			return deferred.reject("No transactions found", organisation._id, organisation.name);
		}
		console.log("Total transactions", transactions.length);
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
			console.timeEnd("_calcUser");
			deferred.resolve(totals);
		});
	});
	return deferred.promise;
};

LedgerSchema.statics.sync = function() {
	console.log("Syncing all orgs");
	var deferred = Q.defer();
	Organisation.find({ _deleted: false }, function(err, organisations) {
		var tasks = organisations.map(function(organisation) {
			console.log(organisation.name);
			return function() {
				console.log("Calculating", organisation.name, organisation._id);
				return _calcOrg(organisation);
			};
		});
		tasks.push(function() {
			deferred.resolve("Organisations synced");
		});
		tasks.reduce(function(soFar, f) {
			return soFar.then(f);
		}, Q());
	});
	return deferred.promise;
};

LedgerSchema.statics.sync_users = function() {
	console.log("Syncing all users");
	var deferred = Q.defer();
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
	return deferred.promise;
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
	})
}

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
}

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
}

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

var findPreviousEntry = function(entry) {
	var deferred = Q.defer();
	var date = entry.date;
	var cred_type = entry.cred_type;
	var organisation_id = entry.organisation_id;
	require("./ledger_model").where("date", "$lt:" + date).where("organisation_id", organisation_id).where("cred_type", cred_type).findOne(function(err, match) {
		if (err) {
			deferred.reject(err);
		} else {
			deferred.resolve(match);
		}
	});
	return deferred.promise;
};

var updateBalance = function(entry, prev) {
	var deferred = Q.defer();
	var prev_balance = 0;
	if (prev.balance) {
		prev_balance = prev.balance;
	}
	entry.balance = prev_balance + entry.amount;
	console.log("Balance", entry.balance);
	entry.save(function(err, result) {
		if (err) {
			deferred.reject(err);
		} else {
			deferred.resolve(result);
		}
	});
	return deferred.promise;
};

LedgerSchema.statics.balances = function() {
	var deferred = Q.defer();
	var Ledger = require("./ledger_model");
	Ledger.find().sort({ date: 1}).exec(function(err, entries) {
		console.log("Entries found", entries.length);
		entries.forEach(function(entry) {
			findPreviousEntry(entry)
			.then(function(prev) {
				return updateBalance(entry, prev);
			})
			.then(null, function(err) {
				console.log("Err", err);
			});
		});
		deferred.resolve({ count: entries.length });
	});
	return deferred.promise;
};

_syncOrg = function(organisation_id) {
	console.log("Syncing", organisation_id);
	var deferred = Q.defer();
	Organisation.findOne({"_id": organisation_id}, function(err, organisation) {
		if (err) {
			return deferred.reject(err);
		}
		if (!organisation) {
			return deferred.reject("Organisation not found");
		}
		_calcOrg(organisation)
		.then(function(result) {
			deferred.resolve(result);
		}, function(err) {
			console.error(err);
			deferred.reject(err);
		});
	});
	return deferred.promise;
};

LedgerSchema.statics.syncOrg = function(data) {
	console.log("Data", data);
	return _syncOrg(data.organisation_id);
};

LedgerSchema.virtual("__user").set(function(user) {
	this.sender = user;
});

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
		// Organisation.findOne({ _id: user.organisation_id }, function(err, organisation) {
		// 	if (err) {
		// 		console.error(err);
		// 		return;
		// 	}
		// 	if (!user) {
		// 		console.error("Could not find organisation", user.organisation_id);
		// 		return;
		// 	}
		// 	_calcOrg(organisation);
		// });
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