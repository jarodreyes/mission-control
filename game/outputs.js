var outputs = [
  { 
    pin: 21,
    name: 'Fail Beacon',
    slug: 'lose', // min readings should register a minimum of the voltage, so vRead >= voltage.
    on: 0, off: 1,
  },
  { 
    pin: 22,
    name: 'Fail Light',
    slug: 'fail', // min readings should register a minimum of the voltage, so vRead >= voltage.
    on: 0, off: 1,
  },
  { 
    pin: 23,
    name: 'Success Beacon',
    slug: 'win', // min readings should register a minimum of the voltage, so vRead >= voltage.
    on: 0, off: 1,
  },
  { 
    pin: 24,
    name: 'Success Light',
    slug: 'success', // min readings should register a minimum of the voltage, so vRead >= voltage.
    on: 0, off: 1,
  },
  { 
    pin: 25,
    name: 'Hydrogen Light',
    slug: 'hydrogen', // min readings should register a minimum of the voltage, so vRead >= voltage.
    on: 0, off: 1,
  },
  { 
    pin: 26,
    name: 'Swing Arm Release',
    slug: 'swingarm', // min readings should register a minimum of the voltage, so vRead >= voltage.
    on: 0, off: 1,
  },
  { 
    pin: 27,
    name: 'Gyroscope Light',
    slug: 'gyroscope', // min readings should register a minimum of the voltage, so vRead >= voltage.
    on: 0, off: 1,
  },
  { 
    pin: 28,
    name: 'Launch Button',
    slug: 'launch', // min readings should register a minimum of the voltage, so vRead >= voltage.
    on: 0, off: 1,
  },
  { 
    pin: 29,
    name: 'Booster Indicators',
    slug: 'booster', // min readings should register a minimum of the voltage, so vRead >= voltage.
    on: 1, off: 0,
  },
  { 
    pin: 30,
    name: 'Rollover Sequence Indicators',
    slug: 'rollover', // min readings should register a minimum of the voltage, so vRead >= voltage.
    on: 1, off: 0,
  },
  { 
    pin: 31,
    name: 'Rumble Motor',
    slug: 'launch', // min readings should register a minimum of the voltage, so vRead >= voltage.
    on: 1, off: 0,
  },
  { 
    pin: 32,
    name: 'Fuel Cell Indicators',
    slug: 'fuelcell', // min readings should register a minimum of the voltage, so vRead >= voltage.
    on: 1, off: 0,
  },
  {
    pin:40,
    name: 'Success Sound',
    slug: 'successSound',
    on: 0, off: 1,
  },
  {
    pin:41,
    name: 'Lose Sound',
    slug: 'loseSound',
    on: 0, off: 1,
  },
  {
    pin:43,
    name: 'Win Sound',
    slug: 'winSound',
    on: 0, off: 1,
  },
  {
    pin:44,
    name: 'Fail Sound',
    slug: 'failSound',
    on: 0, off: 1,
  },
  {
    pin:45,
    name: 'Launch Sound',
    slug: 'launchSound',
    on: 0, off: 1,
  },
]

module.exports = outputs;