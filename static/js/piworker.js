function createPiWebWorker() {
		var worker = new Worker('/static/js/pi.js');
		worker.timeTaken = [];
		worker.getTimes = function() {
			return JSON.stringify(worker.timeTaken);
		}
		return worker;
}
