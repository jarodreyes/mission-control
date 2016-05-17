var five = require("johnny-five");
var clientIo = require('socket.io-client');
var CommandFactory = require('./CommandFactory');
var Player = require('player');
var fs = require('fs');

var settings = JSON.parse(fs.readFileSync('./settings.json'));

function makeId() {
    var text = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

    for( var i=0; i < 5; i++ )
        text += possible.charAt(Math.floor(Math.random() * possible.length));

    return text;
}

DEFAULT_WAIT_TIME = settings.wait_time ? settings.wait_time : 5000;
DEFAULT_INTERVAL = settings.default_interval ? settings.default_interval : 7500;
TIMED = false;
FAILURES_ALLOWED = settings.failures_allowed ? settings.failures_allowed - 1 : 3;
// console.log = function(){}

// ----------------------------------------- STATION ---------------------- //
// **************************************************************************//

// Station needs to own some things itself
function Station(id) {
  if ( !(this instanceof Station) ) {
    return new Station();
  }
  this.init(id);
}

Station.prototype.init = function(data) {
  this.id = data.id; // * REQUIRED *

  this.commands = [];
  this.currentStep = 0;
  this.currentCommand = {};
  this.socket = clientIo.connect('http://localhost:3000/stations');

  this.createdTime = new Date().getTime();
  this.lastActiveTime = new Date().getTime();
  this.lastWinTime = 0;
  this.points = 0;
  this.failures = 0;
  this.completed = 0;
  this.misses = 0;
  this.name = makeId() + data.id;
  
  this.timer = {};
  this.ready = false;
  this.player = {};
  this.failing = false;
  this.standby = false;
  this.setupListeners();
}

Station.prototype.checkInput = function(pin) {
  var station = this;
  var activeCommands = this.getActiveCommands();
  var acNum = activeCommands.length;
  var completed = station.getCompleted();
  // if any Active commands are listening for this pin, do something
  for (var i = activeCommands.length - 1; i >= 0; i--) {
    console.log("Active Pin "+activeCommands[i].input);
    if (activeCommands[i].input == pin) {
      console.log("Pin Firing: "+pin);
      station.processSuccess(activeCommands[i]);
    } else {
      // If not active, it's a misfire!
      station.processMisfire();
    }
  };
}

Station.prototype.beginCommandSequence = function(command) {
  var station = this;

  // If this command object doesn't have a command, then let's send the success notification.
  if(command.command != undefined) {
    this.emitCommand(command);
  } else {
    this.emitMessage(command);
  }

  // If there isn't an input we're waiting for we can skip ahead.
  while (command.input == null) {
    setTimeout(function() {
      station.completed++;
      station.nextCommand();
    }, DEFAULT_WAIT_TIME);
    return;
  }

  // Issue a new command every few seconds
  setTimeout(function() {
    station.nextCommand();
  }, DEFAULT_INTERVAL);

  // Set this command as active
  command.setActive();
  
  // Check for Failure
  command.setFailTimer(function() {
    station.processFailure(command);
  });

  // Command should send a hint
  command.setHintTimer(function() {
    station.emitHint(command);
  });
}

Station.prototype.nextCommand = function() {
  // Setting the current command object
  var command = this.currentCommand = this.commands[this.currentStep];

  // Need to remove this station if we have too many failures
  if (this.failures > FAILURES_ALLOWED) {
    this.removeStation();
    return;
  }

  // Last step ? End Game : Next step
  if (this.currentStep == this.commands.length) {
    this.endGame();
  } else {
    this.currentStep++;
    this.beginCommandSequence(command);
  }
}

Station.prototype.processFailure = function(command) {
  var station = this;

  // Failure can be triggered by non-command related issues, like misfires
  // If a command object is passed let's make sure we fail it
  if (command != undefined) {
    this.emitFailure(command);
    command.deactivate();
  }

  this.completed++;
  this.failures++;
  this.misses++;

}

Station.prototype.processMisfire = function(command) {
  console.log("MISFIRE!");
  this.misses++;
}

Station.prototype.processSuccess = function(command) {
  // Stop further command actions
  command.clearHintTimer();
  command.clearFailTimer();
  command.deactivate();

  // Update the station progress
  this.completed++;
  this.points += 100;

  this.emitSuccess(command);
}

Station.prototype.awaitingInput = function(actionStep) {
  return this.completed <= actionStep;
}

Station.prototype.emitSuccess = function(command) {
  this.emitStationMsg('success', command)
}

Station.prototype.emitMessage = function(command) {
  this.emitStationMsg('message', command)
}

Station.prototype.emitFailure = function(command) {
  this.emitStationMsg('failure', command);
}

Station.prototype.emitHint = function(command) {
  this.emitStationMsg('hint', command);
}

Station.prototype.emitCommand = function(command) {
  var cId = command ? command.id : 0;
  
  this.emitStationMsg('command', command);
}

Station.prototype.emitStationMsg = function(type, command) {
  var timeLeft = command.time ? command.time : DEFAULT_WAIT_TIME/1000;
  data = {
    'station':this.id, 
    'msg':type == 'message' ? command['success'] : command[type],
    'type':type,
    'cid': command ? command.id : 0,
    'off':command.off,
    'flashOn':command.flashOn,
    'toggle':command.toggle,
    'on':command.on,
    'timeLeft':timeLeft,
    'flash':command.flash,
    'input':command.input
  }
  this.socket.emit("command", data);
  console.log("Station Stats - Completed:"+this.completed+" Current:"+this.currentStep+" Points:"+this.points+" Misse:"+this.misses);
}

Station.prototype.getActiveCommands = function() {
  var result = [];
  for (var i = this.commands.length - 1; i >= 0; i--) {
    if (this.commands[i].active) {
      result.push(this.commands[i])
    }
  };
  return result;
}

Station.prototype.getCommand = function(id) {
  for (var i = this.commands.length - 1; i >= 0; i--) {
    if (this.commands[i].id == id) {
      console.log('Getting Command: '+this.commands[i].id)
      return this.commands[i];
    }
  };
}

Station.prototype.getCurrentCommand = function() {
  return this.currentCommand;
}

Station.prototype.deactivateAllCommands = function() {
  for (var i = this.commands.length - 1; i >= 0; i--) {
    this.commands[i].deactivate();
    this.commands[i].clearFailTimer();
    this.commands[i].clearHintTimer();
  };
  return;
}

Station.prototype.getCompleted = function() {
  return this.completed;
}

Station.prototype.getStandby = function() {
  return this.standby;
}

Station.prototype.startGame = function() {
  var CF = new CommandFactory();
  var station = this;

  this.commands = CF.getCommands();
  this.startAudio();
  // Emit the next command in the list
  this.nextCommand();
}

Station.prototype.setupListeners = function() {
  var station = this;

  this.socket.on('connect', function(socket) {
    console.log('$$$$$$$$$$ FROM STATION - STATION joined');
  });


  this.socket.on('game_finished', function(data) {

    station.stopAllAudio();
    station.standby = true;
    
    console.log('GAME FINISHED FROM STATION');
  });
  
  this.socket.on('station_ready'+station.id, function(data) {
    station.stopAllAudio();
    console.log('GAME RESET FROM STATION');
  });

  this.socket.on('station_'+station.id+'pin', function(pin) {
    station.checkInput(pin);
  });

  this.socket.on('station_'+station.id+'launch', function(pin) {
    station.checkInput(pin);
  });

  this.socket.emit('station_joined', {'stationId':station.id});
}

Station.prototype.stopAllAudio = function() {
  this.player.stop();
}

Station.prototype.startAudio = function() {
  var station = this;
  this.player = new Player(__dirname + '/launch.mp3');

  // play now and callback when playend
  this.player.play();

  this.player.on('playing',function(item){
    console.log('im playing... src:' + item);
  });
  this.player.on('error', function(err) {
    console.log('Player Error');
    console.log(err);
  });
}

Station.prototype.removeStation = function() {
  var station = this;
  this.endSequences(function() {
    station.socket.emit('station_removed', {'station': station.id, 'failures':station.failures, 'misses':station.misses});
  });
}

Station.prototype.endGame = function() {
  var station = this;
  this.socket.emit('end_game', {'station': this.id, 'points':this.points, 'misses':this.misses});
}

Station.prototype.endSequences = function(callback) {
  this.deactivateAllCommands();
  return callback();
}

// ----------------------------------------- STATIONS ---------------------- //
// **************************************************************************//

function Stations() {
  if ( !(this instanceof Stations) ) {
    return new Stations();
  }
  this.init();
}

Stations.prototype.init = function(boards) {
  this.boards = boards;
  this.stations = {};
  this.stationCount = 0; // count of total stations joined, not active stations
  this.activeStationCount = 0; // count of stations currently connected
  this.winningSocket = null;
}

Stations.prototype.createStations = function(numStations) {
  for (var i = 0; i < numStations; i++) {
    // Need to make sure the station and the board have identical ids for socket.io
    var p = this.addStation({'id':this.boards[i].id});
  };
}

Stations.prototype.deleteStations = function(numStations) {
  for (var i = 0; i < numStations; i++) {
    this.removeStation(i);
  };
}

Stations.prototype.addStation = function(data) {
  this.stationCount++;
  console.log('Station Count: '+this.stationCount);
  var station = new Station(data);
  this.stations[data.id] = station;

  return this.stations[station.id];
}

Stations.prototype.emitStationCommand = function(msg) {
  // add arduino board to station
  return this.stations[stationId].emitCommand(msg);
}

Stations.prototype.emitCommands = function(msg) {
  // add arduino board to station
  for (var stationId in this.stations) {
    var station = this.stations[stationId];
    station.emitStationMsg(msg);
  }
  return this.stations;
}

Stations.prototype.inStandby = function(msg) {
  // add arduino board to station
  var inSb = 0;
  for (var stationId in this.stations) {
    var station = this.stations[stationId];
    if (station.standby)inSb++;
  }
  return inSb == this.getStationCount();
}

Stations.prototype.newGame = function(numStations) {
  this.deleteStations(numStations);
  this.createStations(numStations);
  return this.stations;
}

Stations.prototype.startGame = function() {
  // start the game for all Stations
  for (var stationId in this.stations) {
    var station = this.stations[stationId];
    station.startGame();
  }
  return this.stations;
}

Stations.prototype.getScore = function() {
  // start the game for all Stations
  var pointStache = 0;
  var missed = 0;
  var winner = 1;
  var loser = 1;
  for (var stationId in this.stations) {
    var stationPoints = this.getStationPoints(stationId);
    var stationMissed = this.getStationMisses(stationId) + stationPoints;
    winner = stationPoints > pointStache ? this.stations[stationId].id : winner;
    loser = (stationId > winner) && (stationPoints < pointStache) ? this.stations[stationId].id : loser;
    pointStache = stationPoints > pointStache ? stationPoints : pointStache;
    missed = stationMissed < missed ? stationMissed : missed;
  }
  return {'winner':winner, 'loser':loser, 'points':pointStache};
}

Stations.prototype.removeStation = function(stationId) {
  delete this.stations[stationId];
}

Stations.prototype.getStation = function(stationId) {
  return this.stations[stationId];
}

Stations.prototype.getStationMisses = function(stationId) {
  return this.stations[stationId] ? this.stations[stationId].misses : '';
}

Stations.prototype.getStationPoints = function(stationId) {
  return this.stations[stationId] ? this.stations[stationId].points : -1;
}

Stations.prototype.addStationPoints = function(stationId, points) {
  if (!this.stations[stationId]) {
    return -1;
  }
  this.stations[stationId].points += points;
  this.stations[stationId].lastWinTime = new Date().getTime();
  return this.getStationPoints(stationId);
}

Stations.prototype.lastActive = function(stationId) {
  if (!this.stations[stationId]) {
    return false;
  }
  this.stations[stationId].lastActiveTime = new Date().getTime();
  return this.stations[stationId];
}

Stations.prototype.getStationCount = function() {
  return this.stationCount;
}

module.exports = Stations();