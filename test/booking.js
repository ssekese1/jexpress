process.env.NODE_ENV = 'test';

var Booking = require("../models/booking_model");

var chai = require('chai');
var chaiHttp = require('chai-http');
var should = chai.should();

var server = require("../bin/server");

var init = require("./init");

chai.use(chaiHttp);

describe('Booking', () => {
	before(init.init);

	beforeEach(done => {
		Booking.remove({}, err => {
			done();
		});
	});

	describe("/GET booking", () => {
		it("it should GET all the bookings", (done) => {
			chai.request(server)
			.get("/api/booking")
			.auth(init.email, init.password)
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
				start_time: new Date(),
				end_time: new Date(),
			};
			chai.request(server)
			.post("/api/booking")
			.send(booking)
			.auth(init.email, init.password)
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


});