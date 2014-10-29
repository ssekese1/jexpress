var express = require('express');
var router = express.Router();
var api_test = require('../test/api_test');

/* GET home page. */
router.get('/', function(req, res) {
	// api_test.test();
	res.render('index', { title: 'Jexpress' });
});

//All of our routes
router.use("/api", require("./api"));

router.use('/bootstrap', require('./bootstrap'));

module.exports = router;
