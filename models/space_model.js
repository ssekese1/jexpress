var mongoose     = require('mongoose');
var Schema       = mongoose.Schema;

var ObjectId = mongoose.Schema.Types.ObjectId;
var Location = require("./location_model");
var License = require("./license_model");
var SpaceType = require("./spacetype_model");
var Room = require("./room_model");
var Claylock = require("./claylock_model");

var SpaceSchema   = new Schema({
	name: String,
	spacetype_id: { type: ObjectId, ref: 'SpaceType', required: true },
	room_id: [{ type: ObjectId, ref: 'Room' }],
	claylock_id: [{ type: ObjectId, ref: 'Claylock' }],
	_owner_id: ObjectId,
	_deleted: { type: Boolean, default: false, index: true },
}, {
	toObject: {
		virtuals: true
	},
	toJSON: {
		virtuals: true
	},
	timestamps: true
});

SpaceSchema.set("_perms", {
	admin: "crud",
	owner: "r",
	user: "r",
	all: "r"
});

SpaceSchema.virtual("total_value").get(function() {
	return 0;
});

SpaceSchema.virtual("meters_squared").get(function() {
	return 0;
});

SpaceSchema.virtual("seats").get(function () {
	return 0;
});

module.exports = mongoose.model('Space', SpaceSchema);
