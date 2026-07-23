const http = require('http')
const express = require('express');
const serveStatic = require('serve-static');

const app = express();
const server = http.createServer(app);

// Settings
app.set('port', process.env.PORT || 3000);
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(serveStatic(__dirname + '/public'));

function homepage(req, res) {
  res.render('index', {});
}

app.get('/', homepage);

server.listen(app.get('port'), function () {
  console.log('HexEmpireAI is listening on port ' + app.get('port'));
});
