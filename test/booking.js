process.env.NODE_ENV = 'test';

var Booking = require("../models/booking_model");
var Room = require('../models/room_model');

var chai = require('chai');
var chaiHttp = require('chai-http');
var should = chai.should();

var server = require("../bin/server");

var init = require("./init");

var hour = 60 * 60 * 1000;
var time = new Date().getTime();

chai.use(chaiHttp);

describe('Booking', () => {
	before(init.init);

	var room = null;
	before(done => {
		Room.findOne({}, (err, result) => {
			if (err)
				throw(err);
			room = result;
			done();
		});
	});

	before(done => {
		Booking.remove({}, err => {
			done();
		});
	});

	describe("/GET booking", () => {
		it("it should GET all the bookings", (done) => {
			chai.request(server)
			.get("/api/booking")
			.auth(init.user_account.email, init.user_account.password)
			.end((err, res) => {
				res.should.have.status(200);
				res.body.data.should.be.a('array');
				res.body.data.length.should.be.eql(0);
				done();
			});
		});
	});

	describe("/POST booking", () => {
		it("it should POST a new booking", (done) => {
			var booking = {
				title: "Test Booking",
				start_time: new Date(time),
				end_time: new Date(time + hour),
				room: room._id
			};
			chai.request(server)
			.post("/api/booking")
			.send(booking)
			.auth(init.user_account.email, init.user_account.password)
			.end((err, res) => {
				res.should.have.status(200);
				res.body.data.should.be.an('object');
				res.body.data.should.have.property("_id");
				res.body.data.should.have.property("title");
				res.body.data.should.have.property("start_time");
				res.body.data.should.have.property("end_time");
				done();
			});
		});
	});

	describe("/POST booking - Admin", () => {
		it("it should POST a new booking as an admin", (done) => {
			var booking = {
				title: "Test Booking",
				start_time: new Date(time + hour),
				end_time: new Date(time + (hour * 2)),
				user_id: init.user_account._id,
				room: room._id
			};
			chai.request(server)
			.post("/api/booking")
			.send(booking)
			.auth(init.admin_account.email, init.admin_account.password)
			.end((err, res) => {
				res.should.have.status(200);
				res.body.data.should.be.an('object');
				res.body.data.should.have.property("_id");
				res.body.data.should.have.property("title");
				res.body.data.should.have.property("start_time");
				res.body.data.should.have.property("end_time");
				done();
			});
		});
	});

	describe("/POST booking - Checks", () => {
		it("it should fail without a room", (done) => {
			var booking = {
				title: "Test Booking",
				start_time: new Date(time),
				end_time: new Date(time + hour),
				user_id: init.user_account._id
			};
			chai.request(server)
			.post("/api/booking")
			.send(booking)
			.auth(init.admin_account.email, init.admin_account.password)
			.end((err, res) => {
				res.should.have.status(500);
				done();
			});
		});
		it("it should fail without a start time", (done) => {
			var booking = {
				title: "Test Booking",
				room: room._id,
				end_time: new Date(time + hour),
				user_id: init.user_account._id
			};
			chai.request(server)
			.post("/api/booking")
			.send(booking)
			.auth(init.admin_account.email, init.admin_account.password)
			.end((err, res) => {
				res.should.have.status(500);
				done();
			});
		});
		it("it should fail without an end time", (done) => {
			var booking = {
				title: "Test Booking",
				room: room._id,
				start_time: new Date(time + hour),
				user_id: init.user_account._id
			};
			chai.request(server)
			.post("/api/booking")
			.send(booking)
			.auth(init.admin_account.email, init.admin_account.password)
			.end((err, res) => {
				res.should.have.status(500);
				done();
			});
		});
		it("it should fail without a title", (done) => {
			var booking = {
				room: room._id,
				start_time: new Date(time),
				end_time: new Date(time + hour),
				user_id: init.user_account._id
			};
			chai.request(server)
			.post("/api/booking")
			.send(booking)
			.auth(init.admin_account.email, init.admin_account.password)
			.end((err, res) => {
				res.should.have.status(500);
				done();
			});
		});
		it("it should fail if start_time > end_time", (done) => {
			var booking = {
				title: "Test Booking",
				room: room._id,
				start_time: new Date(time + hour),
				end_time: new Date(time),
				user_id: init.user_account._id
			};
			chai.request(server)
			.post("/api/booking")
			.send(booking)
			.auth(init.admin_account.email, init.admin_account.password)
			.end((err, res) => {
				res.should.have.status(500);
				done();
			});
		});
		it("it should fail if user tries to get another user to pay", (done) => {
			var booking = {
				title: "Test Booking",
				room: room._id,
				start_time: new Date(time),
				end_time: new Date(time + hour),
				user: init.admin_account._id,
			};
			chai.request(server)
			.post("/api/booking")
			.send(booking)
			.auth(init.user_account.email, init.user_account.password)
			.end((err, res) => {
				res.should.have.status(500);
				done();
			});
		});
	});

	describe("/POST booking - Collision Detection", () => {
		it("it should post an appointment", (done) => {
			var booking = {
				title: "Test Booking",
				room: room._id,
				start_time: new Date(time + (hour * 2)),
				end_time: new Date(time + (hour * 3)),
			};
			chai.request(server)
			.post("/api/booking")
			.send(booking)
			.auth(init.admin_account.email, init.admin_account.password)
			.end((err, res) => {
				res.should.have.status(200);
				done();
			});
		});
		it("it should fail because an appointment already exists", (done) => {
			var booking = {
				title: "Test Booking",
				room: room._id,
				start_time: new Date(time),
				end_time: new Date(time + hour),
			};
			chai.request(server)
			.post("/api/booking")
			.send(booking)
			.auth(init.user_account.email, init.user_account.password)
			.end((err, res) => {
				res.should.have.status(500);
				done();
			});
		});
	});

	describe("/PUT booking", () => {
		var appointment = null;
		it("it should post an appointment", (done) => {
			var booking = {
				title: "Test Booking",
				room: room._id,
				start_time: new Date(time + (hour * 4)),
				end_time: new Date(time + (hour * 5)),
			};
			chai.request(server)
			.post("/api/booking")
			.send(booking)
			.auth(init.admin_account.email, init.admin_account.password)
			.end((err, res) => {
				res.should.have.status(200);
				res.body.data.should.have.property("title");
				res.body.data.title.should.equal("Test Booking");
				appointment = res.body.data;
				done();
			});
		});

		it("it should update an appointment", (done) => {
			var booking = {
				title: "Test Booking Updated",
			};
			chai.request(server)
			.put("/api/booking/" + appointment._id)
			.send(booking)
			.auth(init.admin_account.email, init.admin_account.password)
			.end((err, res) => {
				res.should.have.status(200);
				res.body.data.should.have.property("title");
				res.body.data.title.should.equal("Test Booking Updated");
				done();
			});
		});
	});
});