#!/usr/bin/env python
# -*- coding: utf-8 -*-

import os,sys,argparse
import json
import time
import random

from bokeh.plotting import figure, output_file, show
from bokeh.layouts import column, gridplot
from bokeh.resources import CDN
from bokeh.embed import file_html, components
from bokeh.models import Range1d
from bokeh.models.formatters import DatetimeTickFormatter
from plot_temperature_bokeh import sanitize_data, get_temperature_hacks

import tornado.ioloop
import tornado.web
from tornado.httpserver import HTTPServer

from processing import pymongo_helper, ranking_algorithm

def setup_parser():
	parser = argparse.ArgumentParser()
	parser.add_argument('--port', '-p', type=int, default=10070, help='Port to listen on')
	return parser

class TemperaturePlotHandler(tornado.web.RequestHandler):
	def post(self):
		data = tornado.escape.json_decode(self.request.body)
		try:
			x, y = sanitize_data(data)

			p = figure(title='', x_axis_label='Time', y_axis_label=r'Temperature (°C)', plot_height=400, responsive=True)
			p.line(x, y, line_width=1)
			p.y_range = Range1d(0, 100)
			p.xaxis.formatter = DatetimeTickFormatter(hours='%H:%M')

			p.xaxis.axis_label_text_font_style='bold'
			p.yaxis.axis_label_text_font_style='bold'

			html = file_html(p, CDN, "test")
			script, div = components(p)

			result = {
				'script': script,
				'div': div,
			}
			self.write(json.dumps(result))
		except Exception, e:
			self.set_status(500)
			self.write(str(e))

class ExperimentPlotHandler(tornado.web.RequestHandler):
	def post(self):
		data = tornado.escape.json_decode(self.request.body)

		iterations = data['iterations']
		perf_x = []
		perf_y = []
		[(perf_x.append(x['ft']), perf_y.append(x['tt'] * 1000)) for x in iterations]

		p1 = figure(title='', x_axis_label='Time (s)', y_axis_label='Time/Iteration (ms)', plot_height=270, responsive=True)
		p1.line(perf_x, perf_y, line_width=1)
		p1.y_range = Range1d(0, max(perf_y)+1000.0)

		p1.xaxis.axis_label_text_font_style='bold'
		p1.yaxis.axis_label_text_font_style='bold'

		p2 = figure(title='', x_axis_label='Time (s)', y_axis_label=r'Temperature (°C)', x_range=p1.x_range, plot_height=270, responsive=True)

		timestamps, temperatures = sanitize_data(data['temperatureData'], data['deviceID'])
		# These are time since epoch..whereas the other plot is time since
		# start of benchmark. Convert this
		#timestamps = [(x - data['startTime'])/1000.0 for x in timestamps if x >= data['startTime']]

		p2.line(timestamps, temperatures, line_width=1)
		p2.y_range = Range1d(0, 100)

		p2.xaxis.axis_label_text_font_style='bold'
		p2.yaxis.axis_label_text_font_style='bold'

		combined = gridplot(children=[[p1], [p2]], responsive=True, merge_tools=True)
		html = file_html(combined, CDN, "test")
		script, div = components(combined)

		result = {
			'testInfo': {
				'experimentID': data['experimentID'],
				'digits': data['digits'],
				'startTime': data['startTime'],
				'testTimeMs': data['testTimeMs'],
				'iterationsCompleted': len(data['iterations']),
				'startTemperature': data['startTemperature'],
			},
			'testPlot': {
				'script': script,
				'div': div,
			},
		}
		self.write(json.dumps(result))

class ExperimentRankingHandler(tornado.web.RequestHandler):
	def post(self):
		data = tornado.escape.json_decode(self.request.body)
		expt_id = data['experimentID']

		try:
			rank, values = ranking_algorithm.rank(expt_id, 2, 2, use_aggregate_score=False, aggregate_by_device=False)
			self.write('Your device ranks %.2f percentile compared to other devices of the same model' % (rank))
		except Exception, e:
			self.write('Failed to rank devices: {}'.format(e))




def make_app():
	return tornado.web.Application([
		(r"/temperature-plot", TemperaturePlotHandler),
		(r"/experiment-plot", ExperimentPlotHandler),
		(r"/experiment-ranking", ExperimentRankingHandler),
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
