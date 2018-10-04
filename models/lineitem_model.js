var mongoose = require("mongoose");
var Schema = mongoose.Schema;

var ObjectId = mongoose.Schema.Types.ObjectId;
var Organisation = require("./organisation_model");
var Product = require("./product_model");
var Invoice = require("./invoice_model");
var Booking = require("./booking_model");
var License = require("./license_model");
var Location = require("./location_model");
var User = require("./user_model");
var Discount = require("./discount_model");
var postFind 	 = require('../libs/mongoose-post-find');

var LineItemSchema = new Schema({
	description: String,
	organisation_id: { type: ObjectId, ref: "Organisation", index: true },
	location_id: { type: ObjectId, ref: "Location", index: true },
	user_id: { type: ObjectId, ref: "User" },
	product_id: { type: ObjectId, ref: "Product" },
	invoice_id: { type: ObjectId, ref: "Invoice" },
	booking_id: { type: ObjectId, ref: "Booking" },
	license_id: { type: ObjectId, ref: "License" },
	amount: {
		type: Number,
		validate: function(v) {
			return v > 0;
		},
		required: true
	},
	price: {
		type: Number,
		validate: function(v) {
			return v >= 0;
		},
		required: true
	},
	price_customised: { type: Boolean, default: false },
	price_customised_user_id: { type: ObjectId, ref: "User" },
	price_customised_reason: String,
	price_customised_date: Date,
	tax_type: String,
	comment: String,
	discounts: [ { type: ObjectId, ref: "Discount" } ],
	// discount: { type: Number, default: 0 },
	date_created: { type: Date, default: Date.now },
	is_quote: Boolean,
	xero_id: String,
	date_start: Date,
	date_end: Date,
	_owner_id: ObjectId,
	_deleted: { type: Boolean, default: false, index: true },
	_version: { type: Number, default: 0 },
}, {
	toObject: {
		virtuals: true
	},
	toJSON: {
		virtuals: true
	}
});

LineItemSchema.set("_perms", {
	admin: "crud",
	owner: "cr",
	primary_member: "r",
	user: "r",
	all: ""
});

LineItemSchema.virtual("status").get(function() {
	var now = new Date();
	if (!this.date_start) return "current";
	var date_start = +new Date(this.date_start);
	if (date_start > now) return "pending";
	if (!this.date_end) return "current";
	var date_end = +new Date(this.date_end);
	if (date_end && date_end < now) return "expired";
	return "current";
});

LineItemSchema.plugin(postFind, {
	find: function(rows, done) {
		Discount.find()
		.then(discounts => {
			rows.forEach(row => {
				row._doc.calculated_discount = 0;
				var org_discounts = discounts.filter(discount => discount.organisation_id + "" === row.organisation_id + "");
				if (!org_discounts.length) return;
				var lineitem_discounts = [];
				for (discount of org_discounts) {
					if (discount.lineitem_id && discount.lineitem_id === row.id) {
						lineitem_discounts.push(discount);
					} else if (discount.apply_to.includes("all")) {
						lineitem_discounts.push(discount);
					} else if (discount.apply_to.includes("product") && row.product_id) {
						lineitem_discounts.push(discount);
					} else if (discount.apply_to.includes("license") && row.license_id) {
						lineitem_discounts.push(discount);
					} else if (discount.apply_to.includes("booking") && row.booking_id) {
						lineitem_discounts.push(discount);
					}
				}
				// console.log({ lineitem_discounts });
				row._doc.discounts = lineitem_discounts.map(discount => discount._id);
				row._doc.calculated_discount = lineitem_discounts.reduce((sum, b) => ( sum + b.discount ), 0);
			});
			done(null, rows);
		})
		.catch(err => {
			console.error(err);
			done(err);
		});
	},

	findOne: function(row, done) {
		Discount.find({ organisation_id: row.organisation_id })
		.then(discounts => {
			console.log(row);
			row._doc.calculated_discount = 0;
			var org_discounts = discounts.filter(discount => discount.organisation_id + "" === row.organisation_id + "");
			if (!org_discounts.length) {
				return done(null, row);
			}
			var lineitem_discounts = [];
			for (discount of org_discounts) {
				if (discount.lineitem_id && discount.lineitem_id === row.id) {
					lineitem_discounts.push(discount);
				} else if (discount.apply_to.includes("all")) {
					lineitem_discounts.push(discount);
				} else if (discount.apply_to.includes("product") && row.product_id) {
					lineitem_discounts.push(discount);
				} else if (discount.apply_to.includes("license") && row.license_id) {
					lineitem_discounts.push(discount);
				} else if (discount.apply_to.includes("booking") && row.booking_id) {
					lineitem_discounts.push(discount);
				}
			}
			// console.log({ lineitem_discounts });
			row._doc.discounts = lineitem_discounts.map(discount => discount._id);
			row._doc.calculated_discount = lineitem_discounts.reduce((sum, b) => ( sum + b.discount ), 0);
			done(null, row);
		})
		.catch(err => {
			console.error(err);
			done(err);
		});
		// Currency.findOne({ name: row.cred_type[0].toUpperCase() + row.cred_type.slice(1) })
		// .then(currency => {
		// 	return Wallet.find({ user_id: row.user_id, currency_id: currency._id });
		// })
		// .then(wallets => {
		// 	row._doc.balance = wallets.reduce((sum, b) => ( sum + b.balance ), 0);
		// 	done(null, row);
		// })
		// .catch(err => {
		// 	console.error(err);
		// 	done(err);
		// });
	}
});

// Check if we've changed the value of the product or license
LineItemSchema.pre("save", function(next) {
	var lineitem = this;
	if (!lineitem.product_id && !lineitem.license_id) {
		// Nothing to see here
		return next();
	}
	var LineItem = require("./lineitem_model");
	LineItem.findOne({ _id: lineitem._id })
	.then(result => {
		if (result) {
			lineitem._is_new = false;
			if (result.price !== lineitem.price) {
				lineitem.price_customised = true;
				lineitem.price_customised_user_id = lineitem.__user._id;
				lineitem.price_customised_date = new Date();
			}
			next();
		} else {
			lineitem._is_new = false;
			if (lineitem.product_id) {
				Product.findOne({ _id: lineitem.product_id })
				.then(product => {
					if (product.price !== lineitem.price) {
						lineitem.price_customised = true;
						lineitem.price_customised_user_id = lineitem.__user._id;
						lineitem.price_customised_date = new Date();
					}
					next();
				});
			} else {
				License.findOne({ _id: lineitem.license_id }).populate('membership_id').populate('organisation_id')
				.then(license => {
					var price = null;
					if (license.organisation_id.user_id === license.user_id) {
						price = license.membership_id.cost;
					} else {
						price = license.membership_id.cost_extra_member;
					}
					if (price !== lineitem.price) {
						lineitem.price_customised = true;
						lineitem.price_customised_user_id = lineitem.__user._id;
						lineitem.price_customised_date = new Date();
					}
					next();
				})
			}
		}
	});
});

module.exports = mongoose.model("LineItem", LineItemSchema);
