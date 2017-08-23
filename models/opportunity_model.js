var mongoose     = require('mongoose');
var Schema       = mongoose.Schema;

var ObjectId = mongoose.Schema.Types.ObjectId;
var Location = require('./location_model');
var Lead = require('./lead_model');
var Track = require('./track_model');
var User = require('./user_model');

var OpportunitySchema   = new Schema({
	name: { type: String, index: true, required: true },
	lead_id: { type: ObjectId, index: true, ref: "Lead" },
	track_id: { type: ObjectId, ref: "Track" },
	location_id: { type: ObjectId, index: true, ref: "Location" },
	date_created: { type: Date, default: Date.now },
	value: Number,
	assigned_to: { type: ObjectId, index: true, ref: "User" },
	probability: Number,
	data: mongoose.Schema.Types.Mixed,
	
});

OpportunitySchema.set("_perms", {
	admin: "crud",
	user: "cr",
	all: "c",
});

module.exports = mongoose.model('Opportunity', OpportunitySchema);