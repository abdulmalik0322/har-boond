import { MongoMemoryServer } from 'mongodb-memory-server'
const m = await MongoMemoryServer.create()
console.log('MONGO_URI=' + m.getUri('harboond'))
setInterval(() => {}, 60000)
