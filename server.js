const http = require('http')
const express = require('express');

const app = express();
const server = http.createServer(app);

// Settings
app.set('port', process.env.PORT || 3000);
app.use('/engine', express.static(__dirname + '/engine'));
app.use(express.static(__dirname + '/public'));

server.listen(app.get('port'), '127.0.0.1', function () {
  console.log('HexEmpireAI is listening on port ' + app.get('port'));
});
