$(function() {
	console.log("Jexpress Javascript Test Suite");
	var url = window.location.href ;
	$("#users_exist > .test").on("click", function() {
		$.get(url + "bootstrap/test", function(data) {
			if (data.user_exists) {
				$("#users_exist > .result").html("Passed").addClass("pass");
			} else {
				$("#users_exist > .result").html("Failed").addClass("fail");
				$("#users_exist > .tip").html("You can create a user table by going to <a href='" + url + "bootstrap'>" + url + "bootstrap</a>");
			}
		})
	});

	$("#models > .test").on("click", function() {
		$.get(url + "api/_models", function(data) {
			if (data) {
				data.forEach(function(model) {
					$("#models > .result").append("<strong>Model</strong> <a href='/api/" + model.model + "'>" + model.model + "</a><br><strong>Permissions</strong><br><ul><li><strong>Admin</strong> " + model.perms.admin + "</li><li><strong>Owner</strong> " + model.perms.owner + "</li><li><strong>User</strong> " + model.perms.user + "</li><li><strong>All</strong> " + model.perms.all + "</li>")
				});
			}
		});
	});
});