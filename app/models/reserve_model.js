// var mongoose     = require('mongoose');
// var Schema       = mongoose.Schema;
// var Q = require("q");

// var Objectid = mongoose.Schema.Types.ObjectId;

// var User = require("./user_model");
// var Organisation = require("./organisation_model");
// var Purchase = require("./purchase_model");

// var ReserveSchema   = new Schema({
// 	user_id: { type: Objectid, index: true, required: true, ref: "User" },
// 	organisation_id: { type: Objectid, index: true, ref: "Organisation" },
// 	description: String,
// 	details: String,
// 	source_type: String,
// 	source_id: Objectid,
// 	date: { type: Date, default: Date.now },
// 	amount: { type: Number, validate: function(v) { return (v < 0) }, required: true },
// 	cred_type: { type: String, validate: /space|stuff/, index: true, required: true },
// 	_owner_id: Objectid
// });

// ReserveSchema.set("_perms", {
// 	admin: "crud",
// 	owner: "cr",
// 	user: "c"
// });

// var process_item = function(item) {
// 	var deferred = Q.defer();
// 	console.log("Processing item", item);
// 	purchase = new Purchase();
// 	for (var key in item) {
// 		purchase[key] = item[key];
// 	}
// 	item.remove(function(err) {
// 		if (err) {
// 			deferred.reject({ code: 500, msg: err });
// 		} else {
// 			console.log("Removed item");
// 			purchase.save(function(err, result) {
// 				if (err) {
// 					console.log(err);
// 					deferred.reject({ code: 500, msg: err });
// 				} else {
// 					console.log("Saved item");
// 					deferred.resolve(purchase);
// 				}
// 			})
// 		}
// 	});
// 	return deferred.promise;
// }

// ReserveSchema.statics.process = function(item) {
// 	return process_item(item);
// }

// ReserveSchema.statics.process_all = function(h) {
// 	var deferred = Q.defer();
// 	var s = (h * 3600) || (24 * 3600);
// 	var t = new Date() - s;
// 	console.log("Looking for items that are more than " + t + " old");
// 	this.find({ date: { "$lte": t } }, function(err, result) {
// 		if (!result.length) {
// 			console.log("All done");
// 			deferred.resolve("None to process");
// 			return;
// 		}
// 		var first = result.pop();
// 		console.log("First", first);
// 		var p = process_item(first);
// 		result.forEach(function(item) {
// 			p.then(process_item(item));
// 		});
// 		// console.log(result);
// 		deferred.resolve(p);
// 	});
// 	return deferred.promise;
// }

// ReserveSchema.pre("save", function(next) {
// 	var transaction = this;
// 	User.findOne({ _id: transaction.user_id }, function(err, user) {
// 		if (err) {
// 			console.warn("Err", err);
// 			return next(new Error('Insufficient Credit'));
// 		}
// 		if (!user) {
// 			console.log("Could not find user", transaction.user_id);
// 			transaction.invalidate("user_id", "could not find user");
// 			return next(new Error('Could not find user'));
// 		} else {
// 			Organisation.findOne({ _id: user.organisation_id }, function(err, organisation) {
// 				if (err) {
// 					console.warn("Err", err);
// 					return next(new Error('Insufficient Credit'));
// 				}
// 				if (!organisation) {
// 					console.log("Could not find organisation", user.organisation_id);
// 					transaction.invalidate("user_id", "could not find organisation associated with user");
// 					return next(new Error('Could not find organisation associated with user'));
// 				} else {
// 					(organisation[transaction.cred_type + "_total"]) ? test = organisation[transaction.cred_type + "_total"] + transaction.amount : test = transaction.amount;
// 					if (test < 0) {
// 						console.warn("Insufficient Credit", this);
// 						transaction.invalidate("amount", "insufficient credit");
//   						return next(new Error('Insufficient Credit'));
// 					}
// 				}
// 				transaction.organisation_id = organisation._id;
// 				next();
// 			});
// 		}
// 	});
// });

// ReserveSchema.post("save", function(transaction) { //Keep our running total up to date
// 	try {
// 		User.findOne({ _id: transaction.user_id }, function(err, user) {
// 			if (err) {
// 				console.log("Err", err);
// 				return;
// 			}
// 			if (!user) {
// 				console.log("Could not find user", transaction.user_id);
// 			} else {
// 				Organisation.findOne({ _id: user.organisation_id }, function(err, organisation) {
// 					if (err) {
// 						console.log("Err", err);
// 						return;
// 					}
// 					if (!user) {
// 						console.log("Could not find organisation", user.organisation_id);
// 					} else {
// 						(organisation[transaction.cred_type + "_total"]) ? organisation[transaction.cred_type + "_total"] = organisation[transaction.cred_type + "_total"] + transaction.amount : organisation[transaction.cred_type + "_total"] = transaction.amount;
// 						(organisation[transaction.cred_type + "_reserve"]) ? organisation[transaction.cred_type + "_reserve"] = organisation[transaction.cred_type + "_reserve"] + transaction.amount : organisation[transaction.cred_type + "_reserve"] = transaction.amount;
// 						organisation.save();
// 					}
// 				});
// 			}
// 		});
// 	} catch(err) {
// 		console.log("Error", err);
// 	}
// });

// ReserveSchema.post("remove", function(transaction) { //Keep our running total up to date
// 	console.log("Going to remove reserve");
// 	try {
// 		var User = require("./user_model");
// 		User.findOne({ _id: transaction.user_id }, function(err, user) {
// 			if (err) {
// 				console.log("Err", err);
// 				return;
// 			}
// 			if (!user) {
// 				console.log("Could not find user", transaction.user_id);
// 			} else {
// 				Organisation.findOne({ _id: user.organisation_id }, function(err, organisation) {
// 					if (err) {
// 						console.log("Err", err);
// 						return;
// 					}
// 					if (!user) {
// 						console.log("Could not find organisation", user.organisation_id);
// 					} else {
// 						(organisation[transaction.cred_type + "_total"]) ? organisation[transaction.cred_type + "_total"] = organisation[transaction.cred_type + "_total"] - transaction.amount : organisation[transaction.cred_type + "_total"] = ( transaction.amount * -1 );
// 						(organisation[transaction.cred_type + "_reserve"]) ? organisation[transaction.cred_type + "_reserve"] = organisation[transaction.cred_type + "_reserve"] - transaction.amount : organisation[transaction.cred_type + "_reserve"] = ( transaction.amount * -1 );
// 						organisation.save();
// 					}
// 				});
// 			}
// 		});
// 	} catch(err) {
// 		console.log("Error", err);
// 		// throw(err);
// 	}
// });

// module.exports = mongoose.model('Reserve', ReserveSchema);

module.exports = require("./ledger_model");