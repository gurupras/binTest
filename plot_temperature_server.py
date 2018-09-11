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

class SanitizeTemperaturesHandler(tornado.web.RequestHandler):
	def post(self):
		data = tornado.escape.json_decode(self.request.body)
		# import ipdb; ipdb.set_trace()
		try:
			x, y = sanitize_data(data)
			self.write(json.dumps({
				'timestamps': x,
				'temperatures': y
			}))
		except Exception, e:
			print 'Encountered error: {}'.format(e)
			self.set_status(500)
			self.write(str(e))

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

		figures = []

		p1 = figure(title='', x_axis_label='Time (s)', y_axis_label='Time/Iteration (ms)', plot_height=270, responsive=True)
		p1.line(perf_x, perf_y, line_width=1)
		p1.y_range = Range1d(0, max(perf_y)+1000.0)

		p1.xaxis.axis_label_text_font_style='bold'
		p1.yaxis.axis_label_text_font_style='bold'
		figures.append([p1])

		p2 = figure(title='', x_axis_label='Time (s)', y_axis_label=r'Temperature (°C)', x_range=p1.x_range, plot_height=270, responsive=True)

		timestamps, temperatures = sanitize_data(data['temperatureData'], data['deviceID'])
		# These are time since epoch..whereas the other plot is time since
		# start of benchmark. Convert this
		#timestamps = [(x - data['startTime'])/1000.0 for x in timestamps if x >= data['startTime']]

		p2.line(timestamps, temperatures, line_width=1)
		p2.y_range = Range1d(0, 100)

		p2.xaxis.axis_label_text_font_style='bold'
		p2.yaxis.axis_label_text_font_style='bold'
		figures.append([p2])

		if results.get('thermaboxData', None):
			# We have thermabox data. Plot that as well
			tbox = results['thermaboxData']
			limits = tbox['limits']
			temperature = limits['temperature']
			threshold = limits['threshold']
			tbox_data = tbox['data']
			p3 = figure(title='', x_axis_label='Time (s)', y_axis_label=r'Thermabox Temperature (°C)', x_range=p1.x_range, plot_height=270, responsive=True)

			try:
				workload_phase = [x for x in result['phases'] if x['name'] == 'workload'][0]
				entries = [x for x in tbox_data if x['timestamp'] >= workload_phase['start'] and x['timestamp'] <= workload_phase['end']]
				timestamps = [x['timestamp'] for x in entries]
				temperatures = [x['temperature'] for x in entries]
				p3.line(timestamps, temperatures, line_width=1)
				p3.y_range = Range1d(temperature - (threshold * 2), temperature + (threshold * 2))
				p3.xaxis.axis_label_text_font_style='bold'
				p3.yaxis.axis_label_text_font_style='bold'
				figures.append([p3])
				print 'Added thermabox temperature plot'
			except Exception, e:
				print e
				pass

		combined = gridplot(children=figures, responsive=True, merge_tools=True)
		html = file_html(combined, CDN, "test")
		script, div = components(combined)

		result = {
			'testInfo': {
				'experimentID': data['experimentID'],
				'digits': data['digits'],
				'startTime': data['startTime'],
				'workloadDurationMS': ranking_algorithm.get_expt_workload_duration(data),
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
		device_id = data['deviceID']
		expt_id = data['experimentID']
		try:
			filters = {
				'$or': []
			}
			if device_id.get('ICCID', None):
				filters['$or'].append({
					'deviceID.ICCID': {
						'$ne': str(device_id['ICCID']),
					}
				})
			if device_id.get('IMEI', None):
				filters['$or'].append({
					'deviceID.IMEI': {
						'$ne': str(device_id['IMEI']),
					}
				})
			filters['$or'].append({
				'deviceID.Build>SERIAL': {
					'$ne': str(device_id['Build.SERIAL'])
				}
			})

			rank, values, experiment_ids, num_devices = ranking_algorithm.rank(expt_id, 1, filters, True, False, False, False)
			print 'Experiment={} rank={}'.format(expt_id, rank)
			self.write(json.dumps({
        'rank': rank,
        'numDevices': num_devices,
        'numExperiments': len(experiment_ids),
      }))
		except Exception, e:
			print e
			self.set_status(500)
			self.write(json.dumps({
        'error': json.loads(str(e))
      }))




def make_app():
	return tornado.web.Application([
		(r"/temperature-plot", TemperaturePlotHandler),
		(r"/experiment-plot", ExperimentPlotHandler),
		(r"/experiment-ranking", ExperimentRankingHandler),
		(r"/sanitize-temperatures", SanitizeTemperaturesHandler),
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
