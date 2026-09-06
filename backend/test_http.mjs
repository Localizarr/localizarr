import http from 'http'
const server = http.createServer((req, res) => {
  res.end('OK')
})
server.listen(5006, () => {
  console.log('Server running on 5006')
  server.close()
})
