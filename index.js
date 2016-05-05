var Stations = require('./game/stations');
// var commanders = require('./game/commanders');
var express = require('express');
var app = express();
var http = require('http').Server(app);
var five = require("johnny-five");
var clientIo = require('socket.io-client');
console.log(clientIo);

var io = require('socket.io')(http);
var boards = [];

// Constants
PORTS = ["/dev/cu.usbmodem1421", "/dev/cu.usbmodem1411", "/dev/cu.usbmodem1411"];
STATION_COUNT = 1;
STATIONS_READY = 0;
COMMANDERS_READY = 0;
STATIONS_FINISHED = 0;
RUNNING = false;

for (var i = STATION_COUNT - 1; i >= 0; i--) {
  var board = new five.Board(PORTS[i]);
  boards.push(board);
};

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

Stations.init(boards);



io.on('connection', function(socket) {
  // Pass through commands from Stations to Screens
  socket.on('command', function(data){
    io.emit("station"+data.station, {'msg': data.msg, 'type': data.type, 'timeLeft': data.timeLeft, 'cid':data.cid});
  });

  socket.on('success', function(data){
    io.emit('next_question', {'station': data.station});
  });

  socket.on('end_game', function(data) {
    STATIONS_FINISHED++;
    io.emit('end_game', {'points':data.points, 'misses':data.misses});
    if (Stations.getStationCount() == STATIONS_FINISHED) {
      var stations = processWinners();
      io.emit('game_finished', {'won':stations.winner, 'lost':stations.loser, 'totalPoints':stations.points});
    }
  })

  socket.on('commanderJoined', function(data){
    COMMANDERS_READY++;
    console.log('SOCKET.IO commanders added: '+ data.station + 'for socket' + socket.id);
    tryToStartGame();
  });

  socket.on('station_removed', function(data) {
    STATIONS_FINISHED++;
    io.emit('station_removed'+data.station, 'Failure! Station Removed from Cluster');
    if (Stations.getStationCount() == STATIONS_FINISHED) {
      var stations = processWinners();
      io.emit('game_finished', {'won':stations.winner, 'lost':stations.loser, 'totalPoints':stations.points});
    }
  });

  socket.on('stationJoined', function(data) {
    STATIONS_READY++;
    console.log('SOCKET.IO station added: '+ data.stationId + 'for socket' + socket.id);
    tryToStartGame();
  });

  socket.on('game_reset', function() {
    resetGame();
  });

  function tryToStartGame() {
    if (!RUNNING) {
      console.log(Stations.getStationCount()+"Station REady: "+STATIONS_READY+" Commanders Ready: "+COMMANDERS_READY);
      if (Stations.getStationCount() == STATIONS_READY && Stations.getStationCount() == COMMANDERS_READY) {
        // start game!
        RUNNING = true;
        console.log('startGame $$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$ ONLY ONCE!');

        // reset the clients
        io.emit('game_start');
        io.emit('message', 'Technicians Ready');

        // start the command units
        setTimeout(function() {
          Stations.startGame();
        }, 100);
        
      }
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

var resetGame = function() {
  RUNNING = false;
  STATIONS_READY = 0;
  STATIONS_FINISHED = 0;
  Stations.init(boards);
  Stations.newGame();
}

var s = Stations.newGame();

