window.onload = function() {
	$('#run-test').on('click', function() {
		Android.toast('Running test');
		$('#run-test').prop('disabled', true);
		var test = PiTest();
		test.run();
	});
	setTimeout(function() {
		$('#run-test').trigger('click');
	}, 3000);
};

