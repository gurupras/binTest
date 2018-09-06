import fs from 'fs'
import path from 'path'
import yaml from 'js-yaml'

var config
try {
  config = yaml.safeLoad(fs.readFileSync(path.join(__dirname, 'config.yaml'), 'utf8'))
} catch (e) {
  console.log('Failed to read config.yaml: ' + e)
  process.exit(-1)
}

if (config.https) {
  config.https.key = fs.readFileSync(config.https.key),
  config.https.cert = fs.readFileSync(config.https.cert)
}

export default config
