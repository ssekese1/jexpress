process.env.NODE_ENV = 'test';

var chai = require('chai');
var chaiHttp = require('chai-http');
var should = chai.should();

var Booking = require("../models/booking_model");
var Room = require('../models/room_model');

var server = require("../bin/server");

var init = require("./init");

chai.use(chaiHttp);

describe('Permissions', () => {
	before(init.init);

	before(done => {
		Booking.remove({}, err => {
			done();
		});
	});

	var room = null;
	before(done => {
		Room.findOne({}, (err, result) => {
			if (err)
				throw(err);
			room = result;
			done();
		});
	});

	describe("GET Locations without logging in", () => {
		it("Should GET all Locations", done => {
			chai.request(server)
			.get("/api/location")
			.end((err, res) => {
				res.should.have.status(200);
				done();
			});
		});
	});

	describe("GET Events without logging in", () => {
		it("Should NOT GET all Events", done => {
			chai.request(server)
			.get("/api/event")
			.end((err, res) => {
				res.should.have.status(403);
				done();
			});
		});
	});

	describe("GET events with user logging in", () => {
		it("it should GET all the events", (done) => {
			chai.request(server)
			.get("/api/event")
			.auth(init.user_account.email, init.user_account.password)
			.end((err, res) => {
				res.should.have.status(200);
				done();
			});
		});
	});

	describe("POST event without logging in", () => {
		it("it should NOT POST", (done) => {
			var event = {
				name: "Test event",
				start_time: new Date(),
				end_time: new Date(),
			};
			chai.request(server)
			.post("/api/event")
			.send(event)
			// .auth(init.user_account.email, init.user_account.password)
			.end((err, res) => {
				res.should.have.status(403);
				done();
			});
		});
	});

	describe("booking operations with user logging in", () => {
		var booking_id = null;
		it("it should CREATE booking", (done) => {
			var booking = {
				title: "Test booking 1",
				start_time: new Date(),
				end_time: new Date(),
				room: room._id
			};
			chai.request(server)
			.post("/api/booking")
			.send(booking)
			.auth(init.user_account.email, init.user_account.password)
			.end((err, res) => {
				booking_id = res.body.data._id;
				res.should.have.status(200);
				done();
			});
		});
		it("it should EDIT booking", (done) => {
			var booking = {
				name: "Test booking 1 - Edited",
			};
			chai.request(server)
			.put("/api/booking/" + booking_id)
			.send(booking)
			.auth(init.user_account.email, init.user_account.password)
			.end((err, res) => {
				res.should.have.status(200);
				done();
			});
		});
		it("it should DELETE booking", (done) => {
			chai.request(server)
			.delete("/api/booking/" + booking_id)
			.auth(init.user_account.email, init.user_account.password)
			.end((err, res) => {
				res.should.have.status(200);
				done();
			});
		});
	});

	describe("POST location with user logging in", () => {
		it("it should NOT POST", (done) => {
			var location = {
				name: "Test location 1",
			};
			chai.request(server)
			.post("/api/location")
			.send(location)
			.auth(init.user_account.email, init.user_account.password)
			.end((err, res) => {
				res.should.have.status(403);
				done();
			});
		});
	});

	describe("POST location with admin logging in", () => {
		it("it should POST", (done) => {
			var location = {
				name: "Test location 1",
			};
			chai.request(server)
			.post("/api/location")
			.send(location)
			.auth(init.admin_account.email, init.admin_account.password)
			.end((err, res) => {
				res.should.have.status(200);
				done();
			});
		});
	});

	describe("Login with API Key", () => {
		var apikey = null;
		it("it should login", (done) => {
			chai.request(server)
			.post("/login")
			.send(init.user_account)
			.end((err, res) => {
				res.should.have.status(200);
				res.body.should.have.property("apikey");
				res.body.should.have.property("user_id");
				res.body.should.have.property("_id");
				apikey = res.body.apikey;
				done();
			});
		});
		it("it should CREATE booking", (done) => {
			var booking = {
				title: "Test booking 2",
				start_time: new Date(),
				end_time: new Date(),
				room: room._id
			};
			chai.request(server)
			.post("/api/booking?apikey=" + apikey)
			.send(booking)
			.end((err, res) => {
				res.should.have.status(200);
				done();
			});
		});
		it("it should GET bookings", (done) => {
			chai.request(server)
			.get("/api/booking?apikey=" + apikey)
			.end((err, res) => {
				res.should.have.status(200);
				done();
			});
		});
	});
});