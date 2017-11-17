var gulp = require('gulp');
var sourcemaps = require('gulp-sourcemaps');
var babel = require('gulp-babel');
var concat = require('gulp-concat');
var pump = require('pump');
var minify = require('gulp-minify');

gulp.task('babel-js', () => {
	return pump([
    gulp.src([
      'static/js/index.js',
      'static/js/debug.js',
			'static/js/pi.js',
			'static/js/smartphones-exposed-pi-test.js',
			'static/js/smartphones-exposed-android-api.js',
      'static/js/test-my-device.js',
      'static/js/test-results.js',
      'static/js/sweep-test.js',
      'static/js/thermabox.js',
    ]),
    sourcemaps.init(),
    babel(),
    sourcemaps.write('.'),
		gulp.dest('static/dist')
  ]);
});

gulp.task('__watch', () => {
	jsWatcher = gulp.watch('static/js/*.js', ['babel-js']);
});

gulp.task('watch', ['babel-js'], () => {
	gulp.start('__watch');
});

gulp.task('default', ['watch']);
