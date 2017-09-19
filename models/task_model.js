var mongoose     = require('mongoose');
var Schema       = mongoose.Schema;

var ObjectId = mongoose.Schema.Types.ObjectId;
var Mixed = mongoose.Schema.Types.Mixed;
var Opportunity = require("./opportunity_model");
var User = require("./user_model");
var Track = require("./track_model");
var Task = require("./task_model");

var TaskSchema   = new Schema({
	name: String,
	category: { type: String, validate: /init|call|email|follow_up|meeting|milestone|site_visit/, index: true, default: "email", required: true },
	due_after_task: { type: ObjectId, ref: "Task" },
	due_after_days: Number,
	absolute_due_date: Date,
	user_id: { type: ObjectId, ref: "User", index: true, required: true },
	opportunity_id: { type: ObjectId, ref: "Opportunity", index: true, required: true },
	track_id: { type: ObjectId, ref: "Track", index: true },
	date_completed: Date,
	completed: { type: Boolean, default: false, index: true },
	notes: [{ 
		note: String, 
		date_created: { type: Date, default: Date.now }, 
		user_id: { type: ObjectId, ref: "User" } 
	}],
	data: { type: Mixed },
	date_created: { type: Date, default: Date.now },
	_owner_id: ObjectId
});

TaskSchema.set("_perms", {
	admin: "crud",
});

module.exports = mongoose.model('Task', TaskSchema);