var Stations = require('./game/stations');
var StationBoard = require('./game/StationBoard');
// var commanders = require('./game/commanders');
var express = require('express');
var app = express();
var bodyParser = require('body-parser');
var http = require('http').Server(app);
var five = require("johnny-five");
var fs = require('fs');
var clientIo = require('socket.io-client');
console.log(clientIo);
// console.log = function() {

// };
var settings = JSON.parse(fs.readFileSync('./settings.json'));
var io = require('socket.io')(http);
var boards = [];

// Constants
PORTS = ["/dev/cu.usbmodem1424431", "/dev/cu.usbmodem14231", "/dev/cu.usbmodem14221", "/dev/cu.usbmodem14211"];
STATION_COUNT = settings.station_count ? settings.station_count : 4;
BOARDS_READY = 0;
STATIONS_READY = 0;
COMMANDERS_READY = 0;
STATIONS_FINISHED = 0;
RUNNING = false;
STATIONS_RESET = 0;
ACTIVE_STATIONS = [];
STATIONS_FAILED = 0;

for (var stationId in settings.stations) {
  if (settings.stations[stationId].active) {
    ACTIVE_STATIONS.push(stationId);
  }
}

function triggerRestart() {
  var time = new Date;
  var msg = "// Restarted again at: "+time.getHours()+":"+time.getMinutes()+". \n";
  console.log(msg);
  fs.appendFileSync("./game/restarts.js", msg);
}

function updateSettings(numArray) {
  if (numArray.indexOf("0") == -1) {
    for (var stationId in settings.stations) {
      console.log("STATION ID ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^"+stationId)
      if (numArray.indexOf(stationId) == -1) {
        settings.stations[stationId].active = false;
      } else {
        settings.stations[stationId].active = true;
      }
    }
  } else {
    for (var stationId in settings.stations) {
      settings.stations[stationId].active = true;
    }
  }
  return settings.stations;
}

for (var i = settings.station_count - 1; i >= 0; i--) {
  var board = new five.Board();
  // var board = new five.Board({port: settings.stations[ACTIVE_STATIONS[i]].port});
  board.on("fail", function(event) {
    console.log("Received a %s message, from %s, reporting: %s", event.type, event.class, event.message);
    triggerRestart();
  });
  var stationBoard = new StationBoard({
    'id': ACTIVE_STATIONS[i],
    'board': board,
  });
  boards.push(stationBoard);
};

// Serve Static Assets
app.use('/jquery', express.static(__dirname + '/node_modules/jquery/dist/'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({     // to support URL-encoded bodies
  extended: true
})); 
app.use(express.static(__dirname + '/public'));

// Use Jade cuz rad.
app.set('view engine', 'jade');

app.get('/commander/:id', function(req, res){
  res.render('commander', {station: req.params.id});
});

app.get('/admin', function(req, res){
  res.render('admin');
});

app.post('/appRestart', function(req, res){
  triggerRestart();
  return res.status(300).end();
});

app.post('/startGame', function(req, res){
  resetGame();
  return res.status(300).end();
});

app.post('/updateSettings', function(req, res){
  var data = req.body;
  req.body.active_stations = req.body.active_stations.split(",");
  var count = req.body.active_stations.length >= 5 ? STATION_COUNT : req.body.active_stations.length;
  var interval = req.body.interval ? req.body.interval * 1000 : DEFAULT_INTERVAL;
  var fails = req.body.failures ? parseInt(req.body.failures) : FAILURES_ALLOWED;
  var active = req.body.active_stations ? req.body.active_stations : [0];
  var noFailMode = req.body.fail_mode ? req.body.fail_mode : false;
  settings.station_count = count;
  settings.wait_time = DEFAULT_WAIT_TIME;
  settings.default_interval = interval;
  if (noFailMode) {
    fails = 15;
  }
  settings.failures_allowed = fails;
  settings.stations = updateSettings(active);

  fs.writeFileSync('./settings.json', JSON.stringify(settings));
  console.log("######################################## DATA: "+data);

  triggerRestart();

  return res.status(300).end();
});

http.listen(3000, function(){
  console.log('listening on *:3000');
});

var arduinos = io.of('/arduinos');
var stations = io.of('/stations');
var commanders = io.of('/commanders');
var admin = io.of('/admin');

admin.on('connection', function(socket) {
  console.log('index: admin connecting');
  socket.on('admin_joined', function(data){
    console.log('SOCKET.IO admin added for socket' + socket.id);
  });
});

commanders.on('connection', function(socket) {
  console.log('index: commanders connecting');
  socket.on('commander_joined', function(data){
    COMMANDERS_READY++;
    console.log('SOCKET.IO commanders added: '+ data.station + 'for socket' + socket.id);
    tryToStartGame();
  });
  socket.on('disconnect', function() {
    console.log('SOCKET.IO commander disconnected at socket: ' + socket.id);
    COMMANDERS_READY--;
  });
});

arduinos.on('connection', function(socket) {
  console.log('index: arduino connecting');
  socket.on('arduino_connected', function(data){
    BOARDS_READY++;
    console.log('SOCKET.IO arduino added: '+ data.board + 'for socket' + socket.id);
    tryToStartGame();
  });

  socket.on('pin_fired', function(data) {
    stations.emit('station_'+data.station+'pin', data.pin);
  });

  socket.on('launch_fired', function(data) {
    stations.emit('station_'+data.station+'launch', data.pin);
  });

  socket.on('station_reset', function(data) {
    STATIONS_RESET++;
    stations.emit('station_ready'+data.station);
    commanders.emit('station_ready'+data.station);
    if (STATION_COUNT == STATIONS_RESET) {
      resetGame();
    }
  });

  socket.on('station_standby', function(data) {
    console.log("STATION STANDBY TRIGGERED BY"+data.station);
    setTimeout(function() {
      commanders.emit('station_standby'+data.station);
    }, 5000)
  });
  socket.on('disconnect', function() {
    console.log('SOCKET.IO arduino disconnected at socket: ' + socket.id);
    BOARDS_READY--;
  });
});

stations.on('connection', function(socket) {
  console.log('index: stations connected');
  // Pass through commands from Stations to Screens
  socket.on('command', function(data){
    console.log("COMMAND ISSUED $$$$$$$$$$$$$$$$$$$$$$$$$$$$ "+data.input);
    arduinos.emit('command_'+data.type+'_'+data.station , data);
    commanders.emit("station"+data.station, {'msg': data.msg, 'type': data.type, 'timeLeft': data.timeLeft, 'cid':data.cid});
  });

  socket.on('end_station_game', function(data) {
    STATIONS_FINISHED++;
    commanders.emit('end_game'+data.station, {'points':data.points, 'misses':data.misses});

    // let's check if we should end the game
    tryToEndGame();

  })

  socket.on('station_removed', function(data) {
    STATIONS_FINISHED++;
    commanders.emit('station_removed'+data.station, {'msg': 'Failure! Station Removed from Cluster with '+data.misses+' Misses.', 'misses':data.misses});
    arduinos.emit('station_removed', {'station': data.station, 'misses':data.misses});

    // let's check if we should end the game
    tryToEndGame();
  });

  socket.on('station_joined', function(data) {
    STATIONS_READY++;
    console.log('SOCKET.IO station added: '+ data.stationId + 'for socket' + socket.id);
    tryToStartGame();
  });

  socket.on('disconnect', function() {
    STATIONS_READY--;
    console.log('SOCKET.IO Station disconnected at socket: ' + socket.id);
  });
});

function tryToStartGame() {
  var stationTotal = Stations.getStationCount();
  if (!RUNNING) {
    console.log("Stations Ready: "+STATIONS_READY+" Commanders Ready: "+COMMANDERS_READY);
    if (stationTotal == STATIONS_READY && stationTotal == COMMANDERS_READY && stationTotal == BOARDS_READY && stationTotal == STATION_COUNT) {
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

function tryToEndGame() {
  if (Stations.getStationCount() == STATIONS_FINISHED) {
    var results = processWinners();
    arduinos.emit('game_finished', {'won':results.winner});
    commanders.emit('game_finished', {'won':results.winner, 'lost':results.loser, 'totalPoints':results.points});
    stations.emit('game_finished', {'won':results.winner, 'lost':results.loser, 'totalPoints':results.points})
  }
}

function processWinners() {
  var data = Stations.getScore();
  return {'winner': data.winner, 'loser':data.loser, 'points':data.points}
}

var resetGame = function() {
  console.log('RESET GAME !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
  RUNNING = false;
  STATIONS_READY = 0;
  STATIONS_FINISHED = 0;
  STATIONS_RESET = 0;
  Stations.init(boards);
  Stations.newGame(STATION_COUNT);
}

