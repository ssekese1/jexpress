var mongoose     = require('mongoose');
// mongoose.set('debug', true);
var Schema       = mongoose.Schema;

var Objectid = mongoose.Schema.Types.ObjectId;

var User = require("./user_model");
var Organisation = require("./organisation_model");
var Source = require("./source_model");

var LedgerSchema   = new Schema({
	user_id: { type: Objectid, index: true, ref: "User", required: true },
	organisation_id: { type: Objectid, index: true, ref: "Organisation" },
	description: String,
	details: String,
	date: { type: Date, default: Date.now, required: true, index: true },
	source_type: String,
	source_id: Objectid,
	amount: { type: Number, required: true },
	reserve: { type: Boolean, default: false },
	reserve_expires: { type: Date, default: Date.now },
	cred_type: { type: String, validate: /space|stuff/, index: true, required: true },
	email: String,
	_owner_id: Objectid
});

LedgerSchema.set("_perms", {
	admin: "crud",
	owner: "cr",
	user: "c"
});

LedgerSchema.statics.move = function() { //Move all old reserves, credits and debits into here
	var Ledger = this;
	var Credit = require("./credit_model");
	var Purchase = require("./purchase_model");
	var Reserve = require("./reserve_model");
	Credit.find(function(err, data) {
		data.forEach(function(row) {
			try {
				var ledger = new Ledger(row);
				ledger.save();
			} catch(e) {
				console.log("Error", e, ledger);
			}
		});
	});
	Purchase.find(function(err, data) {
		data.forEach(function(row) {
			var ledger = new Ledger(row);
			ledger.save();
		});
	});
	Reserve.find(function(err, data) {
		data.forEach(function(row) {
			var ledger = new Ledger(row);
			ledger.reserve = true;
			ledger.save();
		});
	});
	return "Okay";
}

var _calcOrg = function(organisation) {
	require("./ledger_model").where("organisation_id", organisation._id).exec(function(err, transactions) {
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
	});
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

LedgerSchema.pre("save", function(next) {
	var transaction = this;
	var search_criteria = { _id: transaction.user_id };
	if (!transaction.user_id) {
		search_criteria = { email: transaction.email };
	}
	User.findOne(search_criteria, function(err, user) {
		if (err) {
			console.warn("Err", err);
			next(new Error('Unknown Error'));
			return;
		}
		if (!user) {
			console.log("Could not find user", transaction.user_id || transaction.email );
			transaction.invalidate("user_id", "could not find user");
			return next(new Error('Could not find user'));
		} else {
			transaction.user_id = user._id;
			Organisation.findOne({ _id: user.organisation_id }, function(err, organisation) {
				if (err) {
					console.warn("Err", err);
					return next(new Error('Could not find organisation'));
				}
				if (!organisation) {
					console.log("Could not find organisation", user.organisation_id);
					transaction.invalidate("user_id", "could not find organisation associated with user");
					return next(new Error('could not find organisation associated with user'));
				} else {
					// (organisation[transaction.cred_type + "_total"]) ? test = organisation[transaction.cred_type + "_total"] + transaction.amount : test = transaction.amount;
					// if (test < 0) {
					// 	console.log(transaction.amount, organisation[transaction.cred_type + "_total"]);
					// 	console.warn("Insufficient Credit", this);
					// 	transaction.invalidate("amount", "insufficient credit");
  			// 			return next(new Error('Insufficient Credit'));
					// }
				}
				transaction.organisation_id = organisation._id;
				next();
			});
		}
	});
});

LedgerSchema.post("save", function(transaction) { //Keep our running total up to date
	var Ledger = require("./ledger_model");
	// console.log("This", this);
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
			_calcOrg(organisation, Ledger);
		});
	});
});

module.exports = mongoose.model('Ledger', LedgerSchema);