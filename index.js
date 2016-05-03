var Stations = require('./game/stations');
// var commanders = require('./game/commanders');
var express = require('express');
var app = express();
var http = require('http').Server(app);
var five = require("johnny-five");
var clientIo = require('socket.io-client');
console.log(clientIo);

var io = require('socket.io')(http);

// Constants
STATION_COUNT = 1;
CURRENT_STEP = 0;
STATIONS_READY = 1;
COMMANDERS_READY = 0;

// Serve Static Assets
app.use('/jquery', express.static(__dirname + '/node_modules/jquery/dist/'));
app.use(express.static(__dirname + '/public'));

// Use Jade cuz rad.
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
    io.emit("station"+data.station, {'msg': data.msg, 'type': data.type, 'timeLeft': data.timeLeft, 'cid':data.cid});
  });

  socket.on('success', function(data){
    io.emit('next_question', {'station': data.station});
  });

  socket.on('end_game', function(data) {
    var stations = processWinners();
    io.emit('end_game', {'won':stations.winner, 'lost':stations.loser, 'totalPoints':stations.points, 'points':data.points, 'misses':data.misses});
  })

  socket.on('commanderJoined', function(data){
    COMMANDERS_READY++;
    console.log('SOCKET.IO commanders added: '+ data.station + 'for socket' + socket.id);
    tryToStartGame();
  });

  socket.on('station_removed', function(data) {
    io.emit('station_removed'+data.station, 'Failure! Station Removed from Cluster');
  });

  socket.on('stationJoined', function(data) {
    STATIONS_READY++;
    console.log('SOCKET.IO station added: '+ data.stationId + 'for socket' + socket.id);
    tryToStartGame();
  });

  socket.on('game_reset', function() {
    Stations.resetGame();
  })

  function tryToStartGame() {
    if (Stations.getStationCount() == STATIONS_READY && Stations.getStationCount() == COMMANDERS_READY) {
      // start game!
      console.log('startGame');

      // reset the clients
      io.emit('game_start');
      io.emit('message', 'Technicians Ready');

      // start the command units
      setTimeout(function() {
        Stations.startGame();
      }, 2000);
      
    }
  }

  function processWinners() {
    var data = Stations.getScore();
    return {'winner': data.winner, 'loser':data.loser}
  }

  // // launch a new game
  // var game = new Game({"socket": io});
  // game.launch();
});
var s = Stations.resetGame();

