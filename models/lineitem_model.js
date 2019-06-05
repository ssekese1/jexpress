const mongoose 			= require("mongoose");
const Schema 			= mongoose.Schema;

const ObjectId 		= mongoose.Schema.Types.ObjectId;
const Organisation 	= require("./organisation_model");
const Product 		= require("./product_model");
const Invoice 		= require("./invoice_model");
const Booking 		= require("./booking_model");
const License 		= require("./license_model");
const Location 		= require("./location_model");
const User 			= require("./user_model");
const Discount 		= require("./discount_model");

const LineItemSchema = new Schema({
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
	discount: { type: Number, default: 0 },
	discount_date_start: Date,
	discount_date_end: Date,
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
	},
	timestamps: true
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

var _calculate_row_discount = (row, org_discounts) => {
	var now = new Date();
	row._doc.calculated_discount = row._doc.discount;
	if (!org_discounts.length) {
		return row;
	}
	var lineitem_discounts = [];
	for (discount of org_discounts) {
		if (discount.lineitem_id && discount.lineitem_id + "" === row._id + "") {
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
	row._doc.discounts = lineitem_discounts.map(discount => discount._id);
	row._doc.calculated_discount = lineitem_discounts.filter(discount => (!discount.date_start || now > discount.date_start) && (!discount.date_end || now < discount.date_end)).reduce((sum, b) => ( sum + b.discount ), row._doc.discount);
	if (row._doc.calculated_discount > 100) {
		row._doc.calculated_discount = 100;
	}
	return row;
}

LineItemSchema.post("find", async (rows, next) => {
	try {
		const discounts = await Discount.find({ _deleted: false });
		for (let row of rows) {
			row._doc.calculated_discount = 0;
			const org_discounts = discounts.filter(discount => (row.organisation_id + "" === discount.organisation_id + "") || (row.organisation_id && row.organisation_id._id + "" === discount.organisation_id + ""));
			row = _calculate_row_discount(row, org_discounts);
		}
		next();
	} catch(err) {
		console.error(err);
		next(err);
	}
});

LineItemSchema.post("findOne", async (row, next) => {
	try {
		if (!row || !row.organisation_id) return next();
		const discounts = await Discount.find({ organisation_id: row.organisation_id, _deleted: false });
		row = _calculate_row_discount(row, discounts);
		next();
	} catch(err) {
		console.error(err);
		next(err);
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
				})
				.catch(err => {
					console.error(err);
					next(err);
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
				.catch(err => {
					console.error(err);
					next(err);
				});
			}
		}
	})
	.catch(err => {
		console.error(err);
		next(err);
	});
});

module.exports = mongoose.model("LineItem", LineItemSchema);
