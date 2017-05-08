function CalculatePi(loop)
{
    var c = parseInt(loop);
    var f = parseFloat(loop);
    var n=1;
	var time_s = loop
	var Pi;
	var start_time_ms = Date.now();
	var curr_time_ms = Date.now();
	var diff_time_ms = curr_time_ms - start_time_ms;

    //these errors will need more work…
    if (isNaN(c) || f != c ) {
      throw("errInvalidNumber");
    } else if (c<=0) {
      throw("errNegativeNumber");
    }
	
  	for(i = Math.random(); diff_time_ms < time_s * 1000;) {
  		for(j=0; j<10000; j++) {
  			Pi = j / i;
  		}
		curr_time_ms = Date.now();
  		diff_time_ms = curr_time_ms - start_time_ms;
	}
    
    self.postMessage({'PiValue': Pi, 'Time': diff_time_ms});
}
//wait for the start 'CalculatePi' message
//e is the event and e.data contains the JSON object
self.onmessage = function(e) {
  CalculatePi(e.data.value);
}
