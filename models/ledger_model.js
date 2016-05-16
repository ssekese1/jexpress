var mongoose     = require('mongoose');
// mongoose.set('debug', true);
var Schema       = mongoose.Schema;

var Objectid = mongoose.Schema.Types.ObjectId;

var User = require("./user_model");
var Organisation = require("./organisation_model");
var Source = require("./source_model");
var moment = require("moment");

var Q = require("q");

var bunyan = require("bunyan");
var log = bunyan.createLogger({ 
	name: "jexpress-ledger",
	serializers: {req: bunyan.stdSerializers.req}
});

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

LedgerSchema.statics.sync = function() {
	console.log("Syncing all orgs");
	var deferred = Q.defer();
	Organisation.find(function(err, organisations) {
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

var sender = null;

LedgerSchema.virtual("__user").set(function(usr) {
	sender = usr;
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
			log.error(err);
			return next(new Error('Unknown Error'));
		}
		if (!user) {
			log.error("Could not find user", transaction.user_id || transaction.email );
			transaction.invalidate("user_id", "could not find user");
			return next(new Error('Could not find user'));
		} else {
			transaction.user_id = user._id;
			Organisation.findOne({ _id: user.organisation_id }, function(err, organisation) {
				if (err) {
					log.error(err);
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
				
				
			});
		}
	});
});

LedgerSchema.post("save", function(transaction) { //Keep our running total up to date
	User.findOne({ _id: transaction.user_id }, function(err, user) {
		if (err) {
			log.error(err);
			return;
		}
		if (!user) {
			log.error("Could not find user", transaction.user_id);
			return;
		}
		Organisation.findOne({ _id: user.organisation_id }, function(err, organisation) {
			if (err) {
				log.error(err);
				return;
			}
			if (!user) {
				log.error("Could not find organisation", user.organisation_id);
				return;
			}
			_calcOrg(organisation);
		});
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