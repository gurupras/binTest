import os,sys,argparse
import json
import time
import random

from bokeh.plotting import figure, output_file, show
from bokeh.resources import CDN
from bokeh.embed import file_html, components
from bokeh.models import Range1d
from plot_temperature_bokeh import sanitize_data

import tornado.ioloop
import tornado.web
from tornado.httpserver import HTTPServer


def setup_parser():
	parser = argparse.ArgumentParser()
	parser.add_argument('--port', '-p', type=int, default=10070, help='Port to listen on')
	return parser

class MainHandler(tornado.web.RequestHandler):
	def post(self):
		data = tornado.escape.json_decode(self.request.body)
		x, y = sanitize_data(data)
		p = figure(title='', x_axis_label='Time', y_axis_label='Temperature', plot_height=400, responsive=True)
		p.line(x, y, line_width=1)
		p.y_range = Range1d(0, 100)
		html = file_html(p, CDN, "test")
		script, div = components(p)

		result = {
			'script': script,
			'div': div,
		}
		self.write(json.dumps(result))


def make_app():
	return tornado.web.Application([
		(r"/", MainHandler),
	])

def main(argv):
	parser = setup_parser()
	args = parser.parse_args(argv[1:])

	app = make_app()
	server = HTTPServer(app, decompress_request=True)
	app.listen(args.port)
	tornado.ioloop.IOLoop.current().start()

if __name__ == '__main__':
	main(sys.argv)

