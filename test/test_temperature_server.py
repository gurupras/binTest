import json
import requests
from plot_temperature_bokeh import generate_temperature_data

data = generate_temperature_data()

r = requests.post('http://localhost:10070/', data=json.dumps(data))
import ipdb; ipdb.set_trace()
