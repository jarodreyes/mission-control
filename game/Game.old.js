var five = require("johnny-five");

var gameSteps = [
  {'id':1, 'location':'Fuel Control', 'command':'Fuel Cell Error!', 'on':32, 'off':[29, 30], 'input':1, 'hint':'Must Clear Fuel Cells 1, 4, and 5 Only', 'buffer':1, 'time':11, 'success': 'Fuel Cells Clear'},

  {'id':2, 'location':'Fuel Control', 'command':'Hydrogen Pressure Low', 'on':25, 'input':2, 'hint':'Increase Hydrogen Pressure', 'buffer':10, 'time':20, 'success': 'Hydrogen Pressure at Maximum'},

  {'id':3, 'location':'Fuel Control', 'command':'Booster Shutdown Did Not Complete', 'on':27, 'input':3, 'hint':'Manually Release Booster L3 Only', 'buffer':5, 'time':15, 'success': 'Primary Gyroscope Responsive'},

  {'id':4, 'location':'Launch Engineer', 'command':'Internal Power Has Not Transferred From Buss B', 'on':null, 'input':3, 'hint':'Manually Transfer Power From Buss B Only', 'buffer':2, 'time':12, 'success': 'Internal Power Transfer Complete'},

  {'id':5, 'location':'Launch Engineer', 'command':'Release Swing Arm', 'on':26, 'input':5, 'hint':'Swing Arm must be released', 'buffer':5, 'time':15, 'success': 'Swing Arm Released'},

  {'id':6, 'location':'Launch Engineer', 'command': 'Stand By For Booster Ignition Sequence', 'on':29, 'input':6, 'buffer': 5, 'time':15, 'hint':['Booster Ignition One GO!','Two GO!', 'Three GO!', 'Four GO!', 'Five GO!', 'Six GO!'], 'success': 'Ignition Sequence Successful' },

  {'id':7, 'location':'Guidance', 'command':'Guidance Control #2 Did Not Release', 'on':26, 'input':7, 'hint':'Manually Release Guidance Control #2', 'buffer':5, 'time':15, 'success': 'Guidance Control Released'},

  {'id':8, 'location':'Guidance', 'command':'Primary Gyroscope Not Responding', 'on':27, 'input':8, 'hint':'Increase Gyroscope Speed', 'buffer':5, 'time':20, 'success': 'Primary Gyroscope Responsive'},

  {'id':9, 'location':'Guidance', 'command':'Stand By for Rollover Sequence', 'on':30, 'input':9, 'hint':['Rollover Sequence "A" GO!','"B" GO!', '"C" GO!', '"D" GO!', 'E" GO!', '"F" GO!'], 'buffer':5, 'time':13, 'success': 'Rollover Successful'}, // after we need to fire 31 off

  {'id':10, 'location':'Commander', 'command':'Stand By To Launch', 'on':29, 'input':10, 'hint':'Launch Now!', 'buffer':4, 'time':6, 'success': 'Launch Successful'}, // before we need to fire 31 and after we need to fire 28

  {'command': 'Shuttle Approaching Apogee', 'off':[25, 26, 27, 28, 29, 30, 32], 'hint':'Space Shuttle Is Now In Orbit. Congratulations!', 'buffer':5, 'time':6, 'success': 'Launch Successful'},
  
]

function MyBoard(opts) {
  var id = this.id = opts.id;
  var socket = this.socket = opts.socket;

  // create a new connection to an Arduino
  var board = new five.Board();

  board.on("ready", function() {
    // Create an Led on pin 13
    var led = new five.Led(13);

    // Once the board is connected, notify the commander that we're ready.
    socket.emit('station'+id, 'Players Ready');

    // For Testing, passes the led & socket objects to the REPL
    this.repl.inject({
      led: led,
      socket: socket,
    });
  });

  // Send Message to the Commander of this Station on Success/Failure
  this.sendMessage = function(msg) {
    socket.emit('station'+id, msg);
  }
}

function Game(opts){
  var socket = this.socket = opts.socket;
  // Game stations
  this.stations = [
  {
    'station1': new MyBoard({'id':'1','socket':socket}),
  }
  ]
  
  // var station2 = new MyBoard(id:'2',socket:socket);
  // var station3 = new MyBoard(id:'3',socket:socket);
  // var station4 = new MyBoard(id:'4',socket:socket);
  this.sendMessage = function(msg) {
    console.log(msg);
    console.log(socket);
    socket.emit("message", msg);
  }

  this.failure = function() {
    this.sendMessage('failure');
  }
}

Game.prototype.launch = function() {
  // reset the boards
  this.sendMessage('reset');
  this.sendMessage('Welcome to Mission Control.');
  // when boards are ready, start game
  
  this.runGame();
}

Game.prototype.runGame = function() {
  var stations = this.stations;
  var currentStep = 0;
  var _this = this;
  console.log('running game: ' + stations.length);

  execute(gameSteps[currentStep]);

  function execute(step) {
    // setTimer
    var timeLeft = 1000 * step.time;
    var timer = setTimeout(_this.failure(), timeLeft);
    // print the command to the commanders screens
    _this.sendMessage(step.command);

  }
}

module.exports = Game;