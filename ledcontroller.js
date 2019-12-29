const bleno = require("bleno");
var ws281x = require('rpi-ws281x-native/lib/ws281x-native');

var NUM_LEDS = parseInt(process.argv[2], 10) || 83,
    pixelData = new Uint32Array(NUM_LEDS);

    var LED_COLOR = rgb2Int(255,255,255);
    ws281x.init(NUM_LEDS);
    ws281x.setBrightness(255);

process.on('SIGINT', function () {
    ws281x.reset();
    process.nextTick(function () { process.exit(0); });
  });

const LEDCONTROLLER_SERVICE_UUID = "00010000-89BD-43C8-9231-40F6E305F96D";
const LED_PATTERN_UUID = "00010001-89BD-43C8-9231-40F6E305F96D";
const LED_BRIGHTNESS_UUID = "00010002-89BD-43C8-9231-40F6E305F96D";

class LEDPatternCharacteristic extends bleno.Characteristic {
    constructor(uuid, name) {
        super({
            uuid: uuid,
            properties: ["write"],
            value: null,
            descriptors: [
                new bleno.Descriptor({
                    uuid: "2901",
                    value: name
                  })
            ]
        });

        this.argument = 0;
        this.name = name;
    }

    onWriteRequest(data, offset, withoutResponse, callback) {
        try {
            if(data.length == 0) {
                callback(this.RESULT_INVALID_ATTRIBUTE_LENGTH);
                return;
            }
            console.log(`onWriteRequest data ${data.readUInt8()}`);
            this.argument = data.readUInt8();
            console.log(`Argument ${this.name} is now ${this.argument}`);
            var ledcolor = hexToRgb(data);
	    console.dir(ledcolor);
            LED_COLOR = rgb2Int(ledcolor.r,ledcolor.g,ledcolor.b);
            console.log(LED_COLOR);
            callback(this.RESULT_SUCCESS);

        } catch (err) {
            console.error(err);
            callback(this.RESULT_UNLIKELY_ERROR);
        }
    }

    onReadRequest(offset, callback) {
        try {
            const result = LED_COLOR;
            console.log(`Returning LED COLOR: ${result}`);

            let data = new Buffer(S);
            data.writeUInt8(result, 0);
            callback(this.RESULT_SUCCESS, data);
        } catch (err) {
            console.error(err);
            callback(this.RESULT_UNLIKELY_ERROR);
        }
    }
}

class LEDBrightnessCharacteristic extends bleno.Characteristic {
    constructor(uuid, name) {
        super({
            uuid: uuid,
            properties: ["write"],
            value: null,
            descriptors: [
                new bleno.Descriptor({
                    uuid: "2902",
                    value: name
                  })
            ]
        });

        this.argument = 0;
        this.name = name;
    }

    onWriteRequest(data, offset, withoutResponse, callback) {
        try {
            if(data.length == 0) {
                callback(this.RESULT_INVALID_ATTRIBUTE_LENGTH);
                return;
            }
            console.log(`raw data ${data}`);
            this.argument = data;
            ws281x.setBrightness(parseInt(data));
            console.log(`LED Brightness ${this.name} is now ${this.argument}`);
            
            callback(this.RESULT_SUCCESS);

        } catch (err) {
            console.error(err);
            callback(this.RESULT_UNLIKELY_ERROR);
        }
    }

    onReadRequest(offset, callback) {
        try {
            const result = 255;
            console.log(`LEDBrightnessCharacteristic result: ${result}`);

            let data = new Buffer(1);
            data.writeUInt8(result, 0);
            callback(this.RESULT_SUCCESS, data);
        } catch (err) {
            console.error(err);
            callback(this.RESULT_UNLIKELY_ERROR);
        }
    }
}

console.log("Starting bleno...");

bleno.on("stateChange", state => {

    if (state === "poweredOn") {
        
        bleno.startAdvertising("LED Controller", [LEDCONTROLLER_SERVICE_UUID], err => {
            if (err) console.log(err);
        });

    } else {
        console.log("Stopping...");
        bleno.stopAdvertising();
    }        
});

bleno.on("advertisingStart", err => {

    console.log("Configuring services...");
    
    if(err) {
        console.error(err);
        return;
    }

    let LEDpattern = new LEDPatternCharacteristic(LED_PATTERN_UUID, "LED Pattern");
    let LEDBrightness = new LEDBrightnessCharacteristic(LED_BRIGHTNESS_UUID, "LED Brightness");

    let LEDController = new bleno.PrimaryService({
        uuid: LEDCONTROLLER_SERVICE_UUID,
        characteristics: [
            LEDpattern,
            LEDBrightness
        ]
    });

    bleno.setServices([LEDController], err => {
        if(err)
            console.log(err);
        else
            console.log("Services configured");
    });
});


// some diagnostics 
bleno.on("stateChange", state => console.log(`Bleno: Adapter changed state to ${state}`));

bleno.on("advertisingStart", err => console.log("Bleno: advertisingStart"));
bleno.on("advertisingStartError", err => console.log("Bleno: advertisingStartError"));
bleno.on("advertisingStop", err => console.log("Bleno: advertisingStop"));

bleno.on("servicesSet", err => console.log("Bleno: servicesSet"));
bleno.on("servicesSetError", err => console.log("Bleno: servicesSetError"));

bleno.on("accept", clientAddress => console.log(`Bleno: accept ${clientAddress}`));
bleno.on("disconnect", clientAddress => console.log(`Bleno: disconnect ${clientAddress}`));

// ---- animation-loop
var offset = 0;


setInterval(function () {
//console.log(NUM_LEDS);
  for (var i = 0; i < NUM_LEDS; i++) {
    //pixelData[i] = colorwheel((offset + i) % 256);
    pixelData[i] = solidcolor(i);
  }

  offset = (offset + 1) % 256;
  ws281x.render(pixelData);
}, 1000 / 30);

console.log('Press <ctrl>+C to exit.');


function solidcolor(pos){
    return LED_COLOR;
}

// rainbow-colors, taken from http://goo.gl/Cs3H0v
function colorwheel(pos) {
  pos = 255 - pos;
  if (pos < 85) { return rgb2Int(255 - pos * 3, 0, pos * 3); }
  else if (pos < 170) { pos -= 85; return rgb2Int(0, pos * 3, 255 - pos * 3); }
  else { pos -= 170; return rgb2Int(pos * 3, 255 - pos * 3, 0); }
}


function rgb2Int(r, g, b) {
  return ((r & 0xff) << 16) + ((g & 0xff) << 8) + (b & 0xff);
}

function hexToRgb(hex) {
    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}
