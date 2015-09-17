var mongoose     = require('mongoose');
// mongoose.set('debug', true);
var Schema       = mongoose.Schema;

var Objectid = mongoose.Schema.Types.ObjectId;

var User = require("./user_model");
var Organisation = require("./organisation_model");
var Source = require("./source_model");

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
	reserve: { type: Boolean, default: false },
	reserve_expires: { type: Date, default: Date.now },
	cred_type: { type: String, validate: /space|stuff/, index: true, required: true },
	email: String,
	transaction_type: { type: String, validate: /credit|debit|reserve/ },
	_owner_id: Objectid
});

LedgerSchema.set("_perms", {
	admin: "crud",
	owner: "cr",
	user: "c",
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
	deferred = Q.defer();
	require("./ledger_model").where("organisation_id", organisation._id).exec(function(err, transactions) {
		if (err) {
			deferred.reject(err);
			return;
		}
		var totals = {
			stuff: 0,
			space: 0
		};
		transactions.forEach(function(transaction) {
			totals[transaction.cred_type] += transaction.amount;
		});
		organisation.stuff_total = totals.stuff;
		organisation.space_total = totals.space;
		organisation.save();
		console.log("Totals", organisation.name, totals);
		deferred.resolve(totals);
	});
	return deferred.promise;
}

LedgerSchema.statics.sync = function() {
	Organisation.find(function(err, organisations) {
		organisations.forEach(function(organisation) {
			_calcOrg(organisation);
		});
	});
	return "Reconciled organisations";
}

LedgerSchema.statics.syncOrg = function(organisation_id) {
	console.log(organisation_id);
	Organisation.findOne({"_id": req.query.organisation_id}, function(err, organisation) {
		_calcOrg(organisation);
	});
}

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
			console.error("Err", err);
			return next(new Error('Unknown Error'));
		}
		if (!user) {
			console.error("Could not find user", transaction.user_id || transaction.email );
			transaction.invalidate("user_id", "could not find user");
			return next(new Error('Could not find user'));
		} else {
			transaction.user_id = user._id;
			Organisation.findOne({ _id: user.organisation_id }, function(err, organisation) {
				transaction.organisation_id = organisation._id;
				if (err) {
					console.warn("Err", err);
					return next(new Error('Could not find organisation'));
				}
				if (!organisation) {
					console.log("Could not find organisation", user.organisation_id);
					transaction.invalidate("user_id", "could not find organisation associated with user");
					return next(new Error('could not find organisation associated with user'));
				} else {
					// Reserves must be negative
					if ((transaction.amount > 0) && (transaction.reserve)) {
						transaction.invalidate("amount", "Reserves must be a negative value");
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
						return next(new Error( "Only admins can give credit. Amount must be less than zero."));
					}
					// Make sure we have credit
					_calcOrg(organisation).then(function(totals) {
						var test = transaction.amount + totals[transaction.cred_type];
						if (test < 0) {
							transaction.invalidate("amount", "insufficient credit");
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
			console.log("Err", err);
			return;
		}
		if (!user) {
			console.log("Could not find user", transaction.user_id);
			return;
		}
		Organisation.findOne({ _id: user.organisation_id }, function(err, organisation) {
			if (err) {
				console.log("Err", err);
				return;
			}
			if (!user) {
				console.log("Could not find organisation", user.organisation_id);
				return;
			}
			_calcOrg(organisation);
		});
	});
});

module.exports = mongoose.model('Ledger', LedgerSchema);