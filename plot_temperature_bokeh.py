import os,sys,argparse
import json
import time
import random
import yaml

from bokeh.plotting import figure, output_file, show

temperature_key_file = './temperature-keys.yaml'

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

def get_temperature_hacks(deviceID):
	temp_keys = yaml.load(open(temperature_key_file, 'rb'))
	model = deviceID['Build.MODEL']
	device_opts = temp_keys.get(model, None)
	return temp_keys, device_opts

def sanitize_data(data, deviceID=None):
	if deviceID is not None:
		data['deviceID'] = deviceID
	utc_offset = float(data.get('utcOffset', 0.0))	# In minutes

	temp_keys, device_opts = get_temperature_hacks(data['deviceID'])

	timestamps = [x + (utc_offset * 60 * 1000) for x in data['timestamps']]
	temp_data = data['temperatures']

	op = None
	def_key = None
	if device_opts:
		def_key = device_opts.get('sensor', None)
		op = device_opts.get('op', None)
	if def_key is None or temp_data[0].get(def_key, None) is None:
		# Default key is wrong..use hard-coded key
		keys = temp_data[0].keys()
		msg = {
			'message': 'WARNING: No defaultKey found!',
			'keys': keys,
			'deviceID': deviceID,
		}
		key_priority = temp_keys.get('key_priority')
		keys = set(keys)
		for key in key_priority:
			if key in keys:
				def_key = key
				break

		if def_key is None:
			# We did not find any of the keys defined in key_priority
			# Check for any available tsens_tz_sensor key
			for key in keys:
				if key.startswith('tsens_tz_sensor'):
					def_key = key

		msg['message'] += ' Using key={}'.format(def_key)
		print json.dumps(msg)
	# Now do any final conversions
	if op:
		op = op.replace('{{val}}', 'x')
		expr = eval('lambda x: ' + op)
	else:
		# Do nothing
		expr = eval('lambda x: x')
	temperatures = [expr(x[def_key]) for x in temp_data]

	return timestamps, temperatures

def main(argv):
	data = generate_temperature_data()
	x, y = sanitize_data(data)
	p = figure(title='Temperature Plot', x_axis_label='Time', y_axis_label='Temperature')
	p.line(x, y, line_width=1)
	print ''
if __name__ == '__main__':
	main(sys.argv)
