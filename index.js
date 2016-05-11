var Stations = require('./game/stations');
var StationBoard = require('./game/StationBoard');
// var commanders = require('./game/commanders');
var express = require('express');
var app = express();
var http = require('http').Server(app);
var five = require("johnny-five");
var clientIo = require('socket.io-client');
console.log(clientIo);
// console.log = function() {

// };

var io = require('socket.io')(http);
var boards = [];

// Constants
PORTS = ["/dev/cu.usbmodem1421", "/dev/cu.usbmodem1411", "/dev/cu.usbmodem1411"];
STATION_COUNT = 1;
BOARDS_READY = 0;
STATIONS_READY = 0;
COMMANDERS_READY = 0;
STATIONS_FINISHED = 0;
RUNNING = false;

for (var i = STATION_COUNT - 1; i >= 0; i--) {
  var board = new five.Board(PORTS[i]);
  var stationBoard = new StationBoard({
    'id': i+1,
    'board': board,
  });
  boards.push(stationBoard);
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

var arduinos = io.of('/arduinos');
var stations = io.of('/stations');
var commanders = io.of('/commanders');

commanders.on('connection', function(socket) {
  console.log('index: commanders connecting');
  socket.on('commander_joined', function(data){
    COMMANDERS_READY++;
    console.log('SOCKET.IO commanders added: '+ data.station + 'for socket' + socket.id);
    tryToStartGame();
  });
});

arduinos.on('connection', function(socket) {
  console.log('index: arduino connecting');
  socket.on('arduino_connected', function(data){
    BOARDS_READY++;
    console.log('SOCKET.IO arduino added: '+ data.board + 'for socket' + socket.id);
    tryToStartGame();
  });
  socket.on('game_reset', function() {
    stations.emit('game_reset');
    resetGame();
  });

  socket.on('pin_fired', function(data) {
    stations.emit('station_'+data.station+'pin', data.pin);
  });

  socket.on('launch_fired', function(data) {
    stations.emit('station_'+data.station+'launch', data.pin);
  });
});

stations.on('connection', function(socket) {
  console.log('index: stations connected');
  // Pass through commands from Stations to Screens
  socket.on('command', function(data){
    console.log("COMMAND ISSUED *$*$*$*$*$*$*$*$*$*$*$*$* "+data.input);
    arduinos.emit('command_'+data.type+'_'+data.station , data);
    commanders.emit("station"+data.station, {'msg': data.msg, 'type': data.type, 'timeLeft': data.timeLeft, 'cid':data.cid});
  });

  socket.on('end_game', function(data) {
    STATIONS_FINISHED++;

    commanders.emit('end_game'+data.station, {'points':data.points, 'misses':data.misses});

    if (Stations.getStationCount() == STATIONS_FINISHED) {
      var stations = processWinners();
      arduinos.emit('game_finished', {'won':stations.winner});
      commanders.emit('game_finished', {'won':stations.winner, 'lost':stations.loser, 'totalPoints':stations.points});
      socket.emit('game_finished', {'won':stations.winner, 'lost':stations.loser, 'totalPoints':stations.points})
    }

  })

  socket.on('station_removed', function(data) {
    STATIONS_FINISHED++;
    commanders.emit('station_removed'+data.station, 'Failure! Station Removed from Cluster');
    if (Stations.getStationCount() == STATIONS_FINISHED) {
      var stations = processWinners();
      arduinos.emit('game_finished', {'won':stations.winner});
      commanders.emit('game_finished', {'won':stations.winner, 'lost':stations.loser, 'totalPoints':stations.points});
      socket.emit('game_finished', {'won':stations.winner, 'lost':stations.loser, 'totalPoints':stations.points})
    }
  });

  socket.on('station_joined', function(data) {
    STATIONS_READY++;
    console.log('SOCKET.IO station added: '+ data.stationId + 'for socket' + socket.id);
    tryToStartGame();
  });
});

function tryToStartGame() {
  if (!RUNNING) {
    console.log(Stations.getStationCount()+"Station Ready: "+STATIONS_READY+" Commanders Ready: "+COMMANDERS_READY);
    if (Stations.getStationCount() == STATIONS_READY && Stations.getStationCount() == COMMANDERS_READY && Stations.getStationCount() == BOARDS_READY) {
      // start game!
      RUNNING = true;
      console.log('startGame $$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$ ONLY ONCE!');

      // reset the clients
      commanders.emit('game_start');
      arduinos.emit('game_start');
      commanders.emit('message', 'Technicians Ready');

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

var resetGame = function() {
  console.log('RESET GAME !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
  RUNNING = false;
  STATIONS_READY = 0;
  STATIONS_FINISHED = 0;
  Stations.init(boards);
  Stations.newGame(STATION_COUNT);
}

// First pass
resetGame();

