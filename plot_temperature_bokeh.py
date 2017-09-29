import os,sys,argparse
import json
import time
import random

from bokeh.plotting import figure, output_file, show

def generate_temperature_data():
	now = int(time.time() * 1000)
	hours = random.randint(1, 3)
	start_time = now - (hours * 60 * 60 * 1000)
	end_time = now
	now = start_time

	data = []
	while now < end_time:
		now += random.randint(100, 250)
		temp = random.randint(30, 40)

		data.append({
			'timestamp': now,
			'temperature': temp,
		})
	return data

def sanitize_data(data):
	x = []
	y = []
	[(x.append(X['timestamp']), y.append(X['temperature'])) for X in data]
	return x, y

def main(argv):
	data = generate_temperature_data()
	x, y = sanitize_data(data)
	p = figure(title='Temperature Plot', x_axis_label='Time', y_axis_label='Temperature')
	p.line(x, y, line_width=1)
	print ''
if __name__ == '__main__':
	main(sys.argv)
