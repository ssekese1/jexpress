var mongoose     = require('mongoose');
var Schema       = mongoose.Schema;

var ObjectId = mongoose.Schema.Types.ObjectId;
var Location = require("./location_model");
var License = require("./license_model");
var SpaceType = require("./spacetype_model");
var Claylock = require("./claylock_model");

var SpaceSchema   = new Schema({
	name: String,
	location_id: { type: ObjectId, ref: 'Location' },
	meters_squared: Number,
	spacetype_id: { type: ObjectId, ref: 'SpaceType' },
	claylock_id: [{ type: ObjectId, ref: 'Claylock' }],
	date_created: { type: Date, default: Date.now },
	seats: Number,
	hot_oversell: Number,
	occasional_oversell: Number,
	shared: Boolean,
	budget_price: Number, // Use this to calculate individual line item amounts
	actual_price: Number,
	_owner_id: ObjectId,
	_deleted: { type: Boolean, default: false, index: true },
}, {
	toObject: {
		virtuals: true
	},
	toJSON: {
		virtuals: true
	}
});

SpaceSchema.set("_perms", {
	admin: "crud",
	owner: "r",
	user: "r",
	all: "r"
});

SpaceSchema.virtual("budget_value_per_m2").get(function() {
	return this.budget_price/this.meters_squared;
});

SpaceSchema.virtual("actual_value_per_m2").get(function() {
	return this.actual_price/this.meters_squared;
});

module.exports = mongoose.model('Space', SpaceSchema);
