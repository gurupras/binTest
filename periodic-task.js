import Emittery from 'emittery'

async function delay (ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

class PeriodicTask {
  constructor (fn, delayMs) {
    this.emitter = new Emittery()
    this.fn = fn
    this.delayMs = delayMs
  }

  start () {
    const self = this
    const periodicFunction = async () => {
      await delay(self.delayMs)
      try {
        await self.fn()
      } catch (e) {
      }
      await self.emitter.emit('repeat')
    }
    this.emitter.on('repeat', periodicFunction)
    periodicFunction()
  }

  stop () {
    this.emitter.clearListeners('repeat')
  }
}

export default PeriodicTask
