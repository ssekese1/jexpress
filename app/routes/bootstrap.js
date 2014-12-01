var express = require('express');
var router = express.Router();
var User = require("../models/user_model");
var bcrypt = require("bcrypt");

router.get("/", function(req, res) {
    User.count(function(err, data) {
        if (err) {
            res.status(500).send(err);
        }
        if (!data) {
            var user = new User();
            user.name = "Admin";
            user.email = "admin";
            user.admin = true;
            user.password = bcrypt.hashSync("admin", 4);
            user.save(function(err) {
                if (err) {
                    res.send(err);
                } else {
                    res.json({ message: "users table created " });
                }
            });
        } else {
            res.status(500).send("users table already exists");
        }
    });
});

router.get("/test", function(req, res) {
    User.count(function(err, data) {
        if (err) {
            res.status(500).send(err);
        }
        res.json({ user_exists: !!(data) });
    });
});

module.exports = router;