$(function() {
	console.log("Jexpress Javascript Test Suite");
	var url = window.location.href ;
	$("#users_exist").on("click", function() {
		$.get(url + "bootstrap/test", function(data) {
			if (data.user_exists) {
				$("#users_exist > .result").html("Passed").addClass("pass");
			} else {
				$("#users_exist > .result").html("Failed").addClass("fail");
				$("#users_exist > .tip").html("You can create a user table by going to <a href='" + url + "bootstrap'>" + url + "bootstrap</a>");
			}
		})
	});
});