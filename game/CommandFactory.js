var gameSteps = [
  {'id':1, 'location':'Fuel Control', 'command':'Fuel Cell Error!', 'on':32, 'off':[29, 30], 'input':1, 'hint':'Must Clear Fuel Cells 1, 4, and 5 Only', 'buffer':1, 'time':11, 'success': 'Fuel Cells Clear'},

  {'id':2, 'location':'Fuel Control', 'command':'Hydrogen Pressure Low', 'on':25, 'input':2, 'hint':'Increase Hydrogen Pressure', 'buffer':10, 'time':20, 'success': 'Hydrogen Pressure at Maximum'},

  {'id':3, 'location':'Fuel Control', 'command':'Booster Shutdown Did Not Complete', 'on':27, 'input':3, 'hint':'Manually Release Booster L3 Only', 'buffer':5, 'time':15, 'success': 'Primary Gyroscope Responsive'},

  {'id':4, 'location':'Launch Engineer', 'command':'Internal Power Has Not Transferred From Buss B', 'on':null, 'input':3, 'hint':'Manually Transfer Power From Buss B Only', 'buffer':2, 'time':12, 'success': 'Internal Power Transfer Complete'},

  {'id':6, 'location':'Launch Engineer', 'command':'Release Swing Arm', 'on':26, 'input':5, 'hint':'Swing Arm must be released', 'buffer':5, 'time':15, 'success': 'Swing Arm Released'},

  {'id':7, 'location':'Guidance', 'command':'Guidance Control #2 Did Not Release', 'on':26, 'input':7, 'hint':'Manually Release Guidance Control #2', 'buffer':5, 'time':15, 'success': 'Guidance Control Released'},

  {'id':8, 'location':'Guidance', 'command':'Primary Gyroscope Not Responding', 'on':27, 'input':8, 'hint':'Increase Gyroscope Speed', 'buffer':5, 'time':20, 'success': 'Primary Gyroscope Responsive'},

  {'id':9, 'location':'Guidance', 'command':'Stand By for Rollover Sequence', 'on':30, 'input':9, 'hint':['Rollover Sequence "A" GO!','"B" GO!', '"C" GO!', '"D" GO!', 'E" GO!', '"F" GO!'], 'buffer':5, 'time':13, 'success': 'Rollover Successful'}, // after we need to fire 31 of
  
]

var constants = [
  {'id':0, 'command':'Shuttle Launch in T-40 Seconds!', 'on':[25, 26, 27, 29, 30, 32], 'input':null},

  {'id':5, 'location':'Launch Engineer', 'command': 'Stand By For Booster Ignition Sequence', 'on':29, 'input':6, 'buffer': 5, 'time':15, 'hint':['Booster Ignition One GO!','Two GO!', 'Three GO!', 'Four GO!', 'Five GO!', 'Six GO!'], 'success': 'Ignition Sequence Successful' },

  {'id':6, 'location':'Commander', 'command':'Stand By To Launch', 'on':29, 'input':10, 'hint':'Launch Now!', 'buffer':4, 'time':6, 'success': 'Launch Successful'}, // before we need to fire 31 and after we need to fire 28
  {'id':10, 'command': 'Shuttle Approaching Apogee', 'off':[25, 26, 27, 28, 29, 30, 32], 'hint':'Space Shuttle Is Now In Orbit. Congratulations!', 'buffer':5, 'time':6, 'success': 'Launch Successful'},
]
var gameOrder = [1, 4, 5, 2, 6, 3, 0, 7];
var RANDOM = true;

function CommandFactory() {
  if ( !(this instanceof CommandFactory) ) {
    return new CommandFactory();
  }
  this.init();
}

CommandFactory.prototype.init = function() {
  this.commands = [];
}

CommandFactory.prototype.getCommands = function() {
  _this = this;
  for (var i = 0; i < gameOrder.length; i++) {
    if (!RANDOM) {
      _this.commands.push(gameSteps[gameOrder[i]]);
    } else {
      // Get a random index
      var indx = Math.floor(Math.random() * gameSteps.length);
      // Add a random index to the commands array
      _this.commands.push(gameSteps[indx]);
    }
  };
  // After we have a random array, lets make sure our constants are in the right spot.
  for (var g = 0; g < constants.length; g++) {
    console.log("Constant step Id:"+constants[g].id);
    _this.commands.splice(constants[g].id, 0, constants[g]);
  };
  return this.commands;
}

module.exports = CommandFactory;