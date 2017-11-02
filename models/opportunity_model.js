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
	track_id: { type: ObjectId, ref: "Track", index: true },
	user_id: { type: ObjectId, ref: "User", index: true },
	location_id: { type: ObjectId, index: true, ref: "Location" },
	date_created: { type: Date, default: Date.now },
	value: Number,
	assigned_to: { type: ObjectId, index: true, ref: "User" },
	probability: Number,
	notes: [{ 
		note: String, 
		date_created: { type: Date, default: Date.now }, 
		user_id: { type: ObjectId, ref: "User" } 
	}],
	abandoned: { type: Boolean, default: false, index: true },
	completed: { type: Boolean, default: false, index: true },
	date_completed: Date,
	data: mongoose.Schema.Types.Mixed,
	
});

OpportunitySchema.set("_perms", {
	admin: "crud",
});

// Set Completed Date
OpportunitySchema.pre("save", function(next) {
	var self = this;
	if (self.isNew)
		return;
	if (self.completed && !self.date_completed)
		self.date_completed = new Date();
	next();
});

module.exports = mongoose.model('Opportunity', OpportunitySchema);