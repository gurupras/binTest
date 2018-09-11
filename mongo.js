import * as mongoDB from 'mongodb'

function sanitizeDoc(doc) {
  var keys = Object.keys(doc)
  //console.log(`${JSON.stringify(keys)}`)
  for(var idx = 0; idx < keys.length; idx++) {
    var key = keys[idx]
    var value = doc[key]
    if(typeof value === 'object') {
      value = sanitizeDoc(value)
    }
    var _key = key.replace(/[\.\$]/g, '>')
    if(_key !== key) {
      //console.log(`Replacing key ${key} with ${_key}`)
      delete doc[key]
      doc[_key] = value
    }
  }
  return doc
}

class MongoDB {
  constructor (url, database) {
    if(!url) {
      throw new Error('Must specify MongoDB URL')
    }
    this.url = url
    this.database = database
  }

  async insertDocument (doc, callback) {
    //console.log('Sanitizing document ...')
    var doc = sanitizeDoc(doc)
    const collection = await this.getCollection()
    return new Promise((resolve, reject) => {
      collection.insert(doc).then((result) => {
        //console.log(`Insert result: ${JSON.stringify(result)}`)
        resolve(result)
      }).catch((err) => {
        console.log(err && err.stack)
        reject(err)
      })
    })
  }

  async query (query, opts) {
    const collection = await this.getCollection()
    return new Promise((resolve, reject) => {
      resolve(collection.find(query, opts))
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

  async getCollection () {
    await this.connect()
    return this.db.collection('results')
  }

  async connect () {
    const self = this
    this.connectPromise = this.connectPromise || new Promise((resolve, reject) => {
      mongoDB.MongoClient.connect(self.url).then((client) =>  {
        const db = client.db(self.database)
        self.db = db
        console.log("Connected successfully to server")
        resolve(db)
      }).catch((err) => {
        console.log(err && err.stack)
        reject(err)
      })
    })
    return this.connectPromise
  }
}

export default MongoDB
