import * as mongoDB from 'mongodb'

function sanitizeDoc (doc) {
  var keys = Object.keys(doc)
  // console.log(`${JSON.stringify(keys)}`)
  for (var idx = 0; idx < keys.length; idx++) {
    var key = keys[idx]
    var value = doc[key]
    if (typeof value === 'object') {
      value = sanitizeDoc(value)
    }
    var _key = key.replace(/[.$]/g, '>')
    if (_key !== key) {
      // console.log(`Replacing key ${key} with ${_key}`)
      delete doc[key]
      doc[_key] = value
    }
  }
  return doc
}

class MongoDB {
  constructor (url, database) {
    if (!url) {
      throw new Error('Must specify MongoDB URL')
    }
    this.url = url
    this.database = database
  }

  async insertDocument (doc, collectionName, { sanitize = true, multi = false }) {
    if (sanitize) {
      doc = sanitizeDoc(doc)
    }
    const collection = await this.getCollection(collectionName)
    var result
    if (multi) {
      result = await collection.insertMany(doc)
    } else {
      result = await collection.insertOne(doc)
    }
    return result
  }

  async query (...args) {
    const collection = await this.getCollection()
    return new Promise((resolve, reject) => {
      resolve(collection.find(...args))
    })
  }

  async getResultAsArray (result) {
    return new Promise((resolve, reject) => {
      result.toArray((err, docs) => {
        if (err) {
          return reject(err)
        }
        resolve(docs)
      })
    })
  }

  async close () {
    await this.db.close()
  }

  async getCollection (collection = 'results') {
    await this.connect()
    return this.db.collection(collection)
  }

  async connect () {
    const self = this
    this.connectPromise = this.connectPromise || new Promise((resolve, reject) => {
      mongoDB.MongoClient.connect(self.url, {useNewUrlParser: true}).then((client) => {
        const db = client.db(self.database)
        self.db = db
        console.log('Connected successfully to server')
        resolve(db)
      }).catch((err) => {
        console.log(err && err.stack)
        reject(err)
      })
    })
    return this.connectPromise
  }
}

export {
  MongoDB,
  sanitizeDoc
}
