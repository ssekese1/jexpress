var mongoose     = require('mongoose');
var Schema       = mongoose.Schema;

var ObjectId = mongoose.Schema.Types.ObjectId;
var Mixed = mongoose.Schema.Types.Mixed;
var Opportunity = require("./opportunity_model");
var User = require("./user_model");
var Track = require("./track_model");
var Task = require("./task_model");
var Location = require('./location_model');
var moment = require("moment");

var TaskSchema   = new Schema({
	name: String,
	category: { type: String, validate: /init|call|email|follow_up|meeting|milestone|site_visit/, index: true, default: "email", required: true },
	due_after_task: { type: ObjectId, ref: "Task" },
	due_after_days: Number,
	absolute_due_date: Date,
	original_due_date: Date,
	user_id: { type: ObjectId, ref: "User", index: true, required: true },
	opportunity_id: { type: ObjectId, ref: "Opportunity", index: true, required: true },
	location_id: { type: ObjectId, index: true, ref: "Location" },
	track_id: { type: ObjectId, ref: "Track", index: true },
	template_task_id: ObjectId,
	date_completed: Date,
	completed: { type: Boolean, default: false, index: true },
	abandoned: { type: Boolean, default: false, index: true },
	notes: [{ 
		note: String, 
		date_created: { type: Date, default: Date.now }, 
		user_id: { type: ObjectId, ref: "User" } 
	}],
	data: { type: Mixed },
	date_created: { type: Date, default: Date.now },
	due_date: { type: Date },
	_owner_id: ObjectId
});

TaskSchema.set("_perms", {
	admin: "crud",
});

var findDueDate = task => {
	// console.log({ task });
	if (!task)
		return Promise.resolve();
	if (task.category === "init")
		return Promise.resolve(task.date_created);
	if (task.absolute_due_date)
		return Promise.resolve(task.absolute_due_date);
	if (!task.due_after_task)
		return Promise.resolve(task.date_created);
	if (task.completed)
			return Promise.resolve(task.date_completed);
	let Task = require("./task_model");
	return Task.findOne({ _id: task.due_after_task })
	.then(due_after_task => {
		return moment(due_after_task.due_date).add(task.due_after_days || 0, "days");
	})
};

TaskSchema.pre("save", function(next) {
	var self = this;
	let Task = require("./task_model");
	findDueDate(self)
	.then(result => {
		self.due_date = result;
		return Task.find({ due_after_task: self._id });
	})
	.then(result => {
		if (result)
			result.forEach(item => item.save());
		if (self.isNew)
			self.original_due_date = self.due_date;
		return next();
	})
	.catch(err => {
		console.trace(err);
		return next(err);
	});
})

module.exports = mongoose.model('Task', TaskSchema);