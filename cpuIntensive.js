var ARRINIT = 2000;
var SCALE = 10000;

var ramp_digits = 1000;
var test_digits = 100000;

function CalculatePi(digits)
{
	var Pi;

    var carry = 0;
	var arr = [];
	var i, j, sum;

	for (i = 0; i <= digits; i++) {
		arr[i] = ARRINIT;
	}
	
	for (i = digits; i > 0; i-= 14) {
		sum = 0;
		for (j = i; j > 0; --j) {
			sum = sum * j + SCALE * arr[j];
			arr[j] = sum % (j * 2 - 1);
			sum /= j * 2 - 1;
		}
		carry = sum % SCALE;
	}
	
	Pi = carry + sum / SCALE;
	
    self.postMessage({'PiValue': Pi});
}

//wait for the start 'CalculatePi' message
//e is the event and e.data contains the JSON object
self.onmessage = function(e) {
  CalculatePi(e.data.value);
}
