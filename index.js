var Stations = require('./game/stations');
// var commanders = require('./game/commanders');
var app = require('express')();
var http = require('http').Server(app);
var five = require("johnny-five");
var clientIo = require('socket.io-client');
console.log(clientIo);

var io = require('socket.io')(http);

// Constants
STATION_COUNT = 2;
CURRENT_STEP = 0;
STATIONS_READY = 0;

app.set('view engine', 'jade');

app.get('/commander/:id', function(req, res){
  res.render('commander', {station: req.params.id});
});

http.listen(3000, function(){
  console.log('listening on *:3000');
});

Stations.init();

io.on('connection', function(socket) {
  // Pass through commands from Stations to Screens
  socket.on('command', function(data){
    io.emit("station"+data.station, data.cmd);
  });

  socket.on('success', function(data){
    io.emit('next_question', {'station': data.station});
  });

  socket.on('stationJoined', function(data) {
    STATIONS_READY++;
    console.log('SOCKET.IO station added: '+ data.stationId + 'for socket' + socket.id);
    if (Stations.getStationCount() == STATIONS_READY) {
      // start game!
      console.log('startGame');

      // reset the clients
      io.emit('command', 'reset');
      io.emit('command', 'Technicians Ready');

      // start the command units
      Stations.startGame();
    }
  });

  // // launch a new game
  // var game = new Game({"socket": io});
  // game.launch();
});
var s = Stations.createStations();

