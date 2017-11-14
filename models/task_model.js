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
var async = require("async");

var postFind = require('../libs/mongoose-post-find');

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

var checkNoCalc = task => {
	return ((task.category === "init") || (task.absolute_due_date) || (!task.due_after_task) || (task.completed))
}

// Leaving this here as an example
var rawFind = (searchObj => {
	return new Promise((resolve, reject) => {
		mongoose.connection.db.collection("tasks").find(searchObj).toArray((err, result) => {
			if (err)
				return reject(err);
			return resolve(result);
		})
	})
})

var findDueDate = (task) => {
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
	let opportunity_id = (task.opportunity_id) ? task.opportunity_id._id : task.opportunity_id;
	return Task.find({ opportunity_id })
	.then(tasks => {
		let queue = [task];
		due_after_task = (task.due_after_task._id) ? task.due_after_task._id : task.due_after_task;
		var nextTask = tasks.find(t => "" + t._id === "" + due_after_task)
		while(nextTask) {
			queue.unshift(nextTask);
			nextTask = tasks.find(t => "" + t._id === "" + nextTask.due_after_task)
		}
		for (var x = 0; x < queue.length - 1; x++) {
			if (queue[x + 1].absolute_due_date) {
				queue[x + 1].due_date = queue[x + 1].absolute_due_date;
			} else if (queue[x + 1].completed) {
				queue[x + 1].due_date = queue[x + 1].date_completed;
			} else {
				queue[x + 1].due_date = moment(queue[x].due_date).add(queue[x + 1].due_after_days || 0, "days").toDate();
			}
		}
		return queue.pop().due_date;
	})
};

// Set wasNew
TaskSchema.pre("save", function(next) {
	var self = this;
	self.wasNew = !!self.isNew;
	next();
});

// Due Date calculations
TaskSchema.pre("save", function(next) {
	let doc = this;
	let due_date = null;
	findDueDate(doc)
	.then(result => {
		doc.due_date = result;
		if (doc.isNew)
			doc.original_due_date = doc.due_date;
		return next();
	})
	.catch(err => {
		console.trace(err);
		return next(err);
	});
});

// Set Completed Date
TaskSchema.pre("save", function(next) {
	var self = this;
	if (self.isNew)
		return next();
	if (self.completed && !self.date_completed)
		self.date_completed = new Date();
	next();
});

TaskSchema.plugin(postFind, {
	find: function(rows, done) {
		var queue = rows.map(row => {
			return cb => {
				findDueDate(row)
				.then(due_date => {
					row.due_date = new Date(due_date);
					cb(null, row);
				})
				.catch(err => {
					cb(err);
				});
			}
		})
		async.series(queue, done);
	},

	findOne: function(row, done) {
		findDueDate(row)
		.then(due_date => {
			row._doc.due_date = due_date;
			done(null, row);
		})
		.catch(err => {
			console.error(err);
			done(err);
		});
	}
});

module.exports = mongoose.model('Task', TaskSchema);