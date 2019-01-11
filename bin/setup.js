#! /usr/bin/env node
var program = require("commander");
var path = require("path");
var readline = require('readline-sync');
var os = require("os");
var mongoose = require("mongoose");
var bcrypt = require("bcryptjs");
var User = require("../models/user_model");
var Location = require("../models/location_model");
var Organisation = require("../models/organisation_model");
var config = require("config");

var pkg = require('../package.json');

var version = pkg.version;

program
.version(version)
.usage('[options] [dir]')
.option('-v, --version', 'JExpress version')
.option("-c, --config <config.js>", "Use config file")
.option("-e, --email <user>", "Admin user email")
.option("-p, --password <password>", "Admin password")
.option("-u, --username <name>", "Admin user name")
.option("-l, --location <location>", "Location")
.option("-l, --organisation <organisation>", "Organisation")
.option("-f, --force", "Force")
.parse(process.argv);

var saveItem = (model) => {
    return new Promise((resolve, reject) => {
        model.save((err, result) => {
    		if (err) {
    			console.error("Error:", err.message);
    			reject(err);
    		} else {
    			console.log(result);
    			resolve(result);
    		}
    	})
    });
}

var Count = (model) => {
    return new Promise((resolve, reject) => {
        model.count((err, result) => {
    		if (err) {
    			console.error("Error:", err.message);
    			reject(err);
    		} else {
    			console.log(result);
    			resolve(result);
    		}
    	})
    });
}

var encPassword = password => {
	return bcrypt.hash(password, 4);
};

async function main() {
    const pwd = process.cwd();
	config.mongo = config.mongo || { server: "localhost", db: "jexpress" };
    const force = program.force || false;
	//DB connection
	mongoose.connect('mongodb://' + config.mongo.server + '/' + config.mongo.db, function(err) {
		if (err) {
			console.error("Database connection error", err);
            return process.exit(1);
		}
	}); // connect to our database
    try {
        var location = new Location();
        var locationCount = await Location.countDocuments();
        var user = new User();
        var userCount = await User.countDocuments();
        var organisation = new Organisation();
        var organisationCount = await Organisation.countDocuments();
        if (locationCount || userCount || organisationCount) {
            if (force) {
                if (readline.keyInYN("You are about to delete the user, location and organisation collections. Are you sure? " )) {
                    await Location.remove();
                    await User.remove();
                    await Organisation.remove();
                } else {
                    return process.exit(1);
                }
            } else {
                console.log("Cannot execute on an existing database. Use --force to overwrite the database.");
                return process.exit(1);
            }
        }
    	const email = program.email || readline.question("Admin user email: ");
    	const password = program.password || readline.question("Admin user password: ", { hideEchoBack: true });
    	const name = program.username || readline.question("Admin user name (Admin): ", { defaultInput: "Admin" });
        const locationName = program.location || readline.question("First location: ");
        const organisationName = program.organisation || readline.question("First organisation: ");
        location.name = locationName;
        location.active = true;
        var locationItem = await saveItem(location);
        organisation.name = organisationName;
        organisation.location_id = locationItem._id;
        organisation = await saveItem(organisation);
    	user.email = email;
    	user.password = await encPassword(password);
    	user.name = name;
    	user.admin = true;
        user.location_id = locationItem._id;
        user.organisation_id = organisation._id;
        user.status = "active";
    	var userItem = await saveItem(user);
        organisation.user_id = userItem._id;
        var organisation = await saveItem(organisation);
        return process.exit(0);
    } catch(err) {
        console.error(err);
        return process.exit(1);
    }
}

main();
