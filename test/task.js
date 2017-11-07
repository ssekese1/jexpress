process.env.NODE_ENV = 'test';

var Task = require("../models/task_model");
var Opportunity = require("../models/opportunity_model");
var Lead = require("../models/lead_model");
var Track = require("../models/track_model");
var Location = require("../models/location_model");

var chai = require('chai');
var chaiHttp = require('chai-http');
var should = chai.should();

var server = require("../bin/server");

var init = require("./init");

chai.use(chaiHttp);

describe('CRM', () => {
	var lead_id = null;
	var opportunity_id = null;
	var track_id = null;
	before(init.init);

	before(done => {
		Task.remove({}, err => {
			done();
		});
	});

	var location = null;
	before(done => {
		Location.findOne({}, (err, result) => {
			if (err)
				throw(err);
			location = result;
			done();
		});
	});

	describe("/POST track", () => {
		it("it should POST a new track", (done) => {
			var track = {
				"tasks" : [
					{
						"name" : "Task 1",
						"due_after_event" : "track_start",
						"due_after_days" : 1,
						"category" : "milestone"
					},
					{
						"name" : "Task 2",
						"due_after_event" : "last_task",
						"due_after_days" : 2,
						"category" : "call"
					},
					{
						"name" : "Task 3",
						"due_after_event" : "last_task",
						"due_after_days" : 3,
						"category" : "email"
					}
				]
			};
			chai.request(server)
			.post("/api/track")
			.send(track)
			.auth(init.admin_account.email, init.admin_account.password)
			.end((err, res) => {
				track_id = res.body.data._id;
				res.should.have.status(200);
				res.body.should.have.property("status").eql("ok");
				res.body.data.should.be.an('object');
				res.body.data.should.have.property("_id");
				res.body.data.should.have.property("tasks");
				done();
			});
		});
	});

	describe("/POST lead", () => {
		it("it should POST a new lead", (done) => {
			var lead = {
				name: "Test lead",
				email: "test@test.blah",
				location_id: location._id
			};
			chai.request(server)
			.post("/api/lead")
			.send(lead)
			// .auth(init.admin_account.email, init.admin_account.password)
			.end((err, res) => {
				lead_id = res.body.data._id;
				res.should.have.status(200);
				res.body.should.have.property("status").eql("ok");
				res.body.data.should.be.an('object');
				res.body.data.should.have.property("_id");
				res.body.data.should.have.property("name");
				res.body.data.should.have.property("email");
				done();
			});
		});
	});

	describe("/POST opportunity", () => {
		it("it should POST a new opportunity", (done) => {
			var opportunity = {
				name: "Test opportunity",
				lead_id,
				track_id,
				user_id: "" + init.admin_account._id,
				location_id: location._id
			};
			chai.request(server)
			.post("/api/opportunity")
			.send(opportunity)
			.auth(init.admin_account.email, init.admin_account.password)
			.end((err, res) => {
				opportunity_id = res.body.data._id;
				res.should.have.status(200);
				res.body.should.have.property("status").eql("ok");
				res.body.data.should.be.an('object');
				res.body.data.should.have.property("_id");
				res.body.data.should.have.property("name");
				done();
			});
		});
	});

	// describe("/POST task", () => {
	// 	it("it should POST a new task", (done) => {
	// 		var task = {
	// 			name: "Test task",
	// 			start_date: new Date(),
	// 			end_date: new Date(),
	// 			opportunity_id,
	// 			user_id: init.admin_account._id
	// 		};
	// 		console.log(task);
	// 		chai.request(server)
	// 		.post("/api/task")
	// 		.send(task)
	// 		.auth(init.admin_account.email, init.admin_account.password)
	// 		.end((err, res) => {
	// 			// console.log(res.body);
	// 			res.should.have.status(200);
	// 			res.body.should.have.property("status").eql("ok");
	// 			res.body.data.should.be.an('object');
	// 			res.body.data.should.have.property("_id");
	// 			res.body.data.should.have.property("name");
	// 			res.body.data.should.have.property("start_date");
	// 			res.body.data.should.have.property("end_date");
	// 			done();
	// 		});
	// 	});
	// });

	describe("/GET task", () => {
		it("it should GET all the tasks", (done) => {
			chai.request(server)
			.get("/api/task")
			.auth(init.admin_account.email, init.admin_account.password)
			.end((err, res) => {
				res.should.have.status(200);
				res.body.data.should.be.a('array');
				res.body.data.length.should.be.eql(4);
				done();
			});
		});
	});

	

});