import udp from "@SignalRGB/udp";
export function Name() { return "Cololight"; }
export function Version() { return "1.2.0"; }
export function Type() { return "network"; }
export function Publisher() { return "SignalRGB"; }
export function Size() { return [10, 10]; }
export function DefaultPosition() {return [75, 70]; }
export function DefaultScale(){return 1.0;}
/* global
LightingMode:readonly
deviceBrightness:readonly
forcedColor:readonly
shutdownColor:readonly
controller:readonly
*/
export function ControllableParameters(){
	return [
		{"property":"LightingMode", "label":"Lighting Mode", "type":"combobox", "values":["Canvas", "Canvas Multi", "Forced", "Savasana", "Sunrise", "Unicorns", "Pensieve", "The Circus", "Instashare", "Eighties", "Cherry Blossoms", "Rainbow", "Christmas"], "default":"Canvas"},
		{"property":"deviceBrightness", "label":"Hardware Brightness", "step":"1", "type":"number", "min":"1", "max":"100", "default":"50"},
		{"property":"shutdownColor", "group":"lighting", "label":"Shutdown Color", "min":"0", "max":"360", "type":"color", "default":"#009bde"},
		{"property":"forcedColor", "group":"lighting", "label":"Forced Color", "min":"0", "max":"360", "type":"color", "default":"#009bde"},
	];
}

let streamingAddress = "";
let streamingPort = 0;
let UDPServer;

//Current iteration of this code technically supports both Components and Single Zone control.
//There is a quirk of the box being movable in component mode, as I can't make something a subdeviceController live.
//In the future, I'd like to do perled mode by default on the strips. No idea how the mix reacts or how many leds it has.
//For the hex, I'll either disable component mode or just leave a default strip on there?

export function DefaultComponentBrand() { return "Cololight";}

const DeviceMaxLedLimit = 128 * 19; //These can handle 128 per hub. ONE HUNDRED AND TWENTY EIGHT.

//Channel Name, Led Limit
const ChannelArray = [
	["Channel 1", DeviceMaxLedLimit],
];

function SetupChannels() {
	device.SetLedLimit(DeviceMaxLedLimit);

	for(let i = 0; i < ChannelArray.length; i++) {
		device.addChannel(ChannelArray[i][0], ChannelArray[i][1], 200);
	}
}

function removeChannels() {
	for(let i = 0; i < ChannelArray.length; i++) {
		device.removeChannel(ChannelArray[i]);
	}
}

export function Initialize() {
	device.setName(controller.name);

	if(UDPServer !== undefined) {
		UDPServer.stop();
		UDPServer = undefined;
	}
	//Make sure we don't have a server floating around still.

	UDPServer = new UdpSocketServer(controller.ip);
	//Establish a new udp server. This is now required for using udp.write.

	streamingAddress = controller.ip;
	streamingPort = 8900;

	// Set image.
	device.setImageFromUrl(controller.image);

	if(LightingMode === "Canvas") {
		device.setControllableLeds([ "Single Color Zone" ], [ [0, 0] ]);
	} else {
		device.setControllableLeds([], []);
		//Make paintbrush disappear.
	}

	if(LightingMode === "Canvas Multi") {
		SetupChannels();
	}

	Cololight.SetBrightness(deviceBrightness);
	setMode(LightingMode);
}

export function Render() {
	sendColors();
}

export function Shutdown() {
	sendColors(true);
}

export function ondeviceBrightnessChanged() {
	Cololight.SetBrightness(deviceBrightness);
}

export function onLightingModeChanged() {
	setMode(LightingMode);
	removeChannels();

	if(LightingMode === "Canvas") {
		device.setControllableLeds([ "Single Color Zone" ], [ [0, 0] ]);
	} else {
		device.setControllableLeds([], []);
		//Make paintbrush disappear.
	}

	if(LightingMode === "Canvas Multi") {
		SetupChannels();
	}
}

function setMode(mode) {
	if (mode === "Canvas" || mode === "Canvas Multi" || mode === "Forced"){
		Cololight.setDeviceMode("Dynamic");
	} else {
		Cololight.setDeviceMode(mode);
	}
}

function sendColors(shutdown = false) {
	if (LightingMode === "Canvas" || LightingMode === "Forced" || shutdown) {
		sendSingleColor(shutdown);
	} else if (LightingMode === "Canvas Multi") {
		sendPerLEDColors();
	}
}

function sendSingleColor(shutdown) {
	let color;

	if(shutdown) {
		color = hexToRgb(shutdownColor);
	} else if (LightingMode === "Forced") {
		color = hexToRgb(forcedColor);
	}else{
		color = device.color(0, 0);
	}

	Cololight.sendSingleColorDynPacket(color);
}

function sendPerLEDColors() {
	let RGBData;

	if(device.getLedCount() === 0) {
		const pulseColor = device.getChannelPulseColor(ChannelArray[0][0], 200);
		RGBData = device.createColorArray(pulseColor, 120, "Inline", "RGB");
	} else {
		RGBData = device.channel(ChannelArray[0][0]).getColors("Inline", "RGB");
	}

	Cololight.sendPerLEDPacket(RGBData);
}

function hexToRgb(hex) {
	const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
	const colors = [];
	colors[0] = parseInt(result[1], 16);
	colors[1] = parseInt(result[2], 16);
	colors[2] = parseInt(result[3], 16);

	return colors;
}

class CololightProtocol {
	constructor() {
		this.modes = {
			"Off" : [0x00, 0x00, 0x00, 0x00],
			"Dynamic" : [0x81, 0x00, 0x00, 0x00],
			"Savasana" : [0x04, 0x97, 0x04, 0x00],
			"Sunrise" : [0x01, 0xc1, 0x0a, 0x00],
			"Unicorns" : [0x04, 0x97, 0x04, 0x00],
			"Pensieve" : [0x01, 0xc1, 0x0a, 0x00],
			"The Circus" : [0x04, 0x81, 0x01, 0x30],
			"Instashare": [0x03, 0xbc, 0x01, 0x90],
			"Eighties" : [0x04, 0x9a, 0x00, 0x00],
			"Cherry Blossoms" : [0x04, 0x94, 0x08, 0x00],
			"Rainbow" : [0x05, 0xbd, 0x06, 0x90],
			"Christmas" : [0x06, 0x8B, 0x09, 0x00]
		};
	}
	/** Update each individual LED.*/
	sendPerLEDPacket(RGBData) {
		let packet = [0x53, 0x5A, 0x30, 0x30, 0x00, 0x01, 0x00, 0x00, 0x00, 0x20];
		packet[26] = 0x00;//g_iPacketSeq;
		packet[27] = 0x02; //2 is used for multiple packets and 1 is used for single packet

		const pixels = 120;

		for(let iPacketIdx = 0; iPacketIdx < pixels; iPacketIdx++){
			//Protocol is interesting on these. It sends the last idx, then the current idx and then rgb data. Rinse and repeat.
			const iStartIdx = iPacketIdx + 1; //We're going to have to do abusive amounts of splicing.
			const iEndIdx = iStartIdx + 1;
			packet = packet.concat([iStartIdx, iEndIdx]);
			packet = packet.concat(RGBData.splice(0, 3));
		}

		this.sendPacketWithLength(packet);
	}

	sendSingleColorDynPacket(color) {

		const packet = [0x53, 0x5A, 0x30, 0x30, 0x00, 0x01, 0x00, 0x00, 0x00, 0x20];
		packet[26] = 0x00;//g_iPacketSeq;
		packet[27] = 0x01;

		this.sendPacketWithLength(packet.concat(color));
	}

	sendSingleColorPacket(color) {
		//Not sure what the difference between this and the above are.
		//This one is not using the multipacket streaming thing.
		const packet = [0x53, 0x5A, 0x30, 0x30, 0x00, 0x00, 0x00, 0x00, 0x00, 0x23];
		packet[26] = 0x22;
		packet[36] = 0x04;
		packet[37] = 0x24;
		packet[38] = 0x06;
		packet[39] = 0x02;
		packet[40] = 0xFF;

		this.sendPacketWithLength(packet.concat(color));
	}
	/** Set the Mode of the device.
	 * This is used for Hardware Modes and then switching to streaming.
	 */
	setDeviceMode(mode) {
		const packet = [0x53, 0x5A, 0x30, 0x30, 0x00, 0x00, 0x00, 0x00, 0x00, 0x20];
		packet[26] = 0x21;
		packet[36] = 0x04;
		packet[37] = 0x21;
		packet[38] = 0x06;
		packet[39] = 0x02;
		packet[40] = 0xFF;

		device.log(`Setting Mode to ${mode}`);
		this.sendPacketWithLength(packet.concat(this.modes[mode]));
	}
	/** Set the hardware brightness of the device.
	 * This is separate from Signal's own brightness.
	 */
	SetBrightness(brightness) {
		device.log(`Setting Brightness to ${brightness}%`);

		const packet = [0x53, 0x5A, 0x30, 0x30, 0x00, 0x00, 0x00, 0x00, 0x00, 0x20];
		packet[26] = 0x21;
		packet[36] = 0x04;
		packet[37] = 0x21;
		packet[38] = 0x03;
		packet[39] = 0x01;
		packet[40] = 0xCF;
		packet[41] = brightness;

		this.sendPacketWithLength(packet);
	}

	/** Wrapper function to calculate the length of the packet and send it.
	 * Helps ensure we always attach the length.
	 */
	sendPacketWithLength(packet) {
		const len = packet.length - 10;
		packet[8] = (len & 0x0000ff00) >> 8;
		packet[9] = (len & 0x000000ff);

		UDPServer.write(packet, streamingAddress, streamingPort);
	}
}

const Cololight = new CololightProtocol();

// -------------------------------------------<( Discovery Service )>--------------------------------------------------


export function DiscoveryService() {
	this.IconUrl = "https://assets.signalrgb.com/brands/custom/cololight/light_icon.png";

	// Listen to local broadcast address, on port 12345
	this.UdpBroadcastPort = 12345;
	this.UdpListenPort = 12343;
	this.UdpBroadcastAddress = "255.255.255.255";

	this.timeSinceLastReq = 0;
	this.cacheTimer = 0;
	this.cacheProgress = 0;

	this.cache = new IPCache();
	this.activeSockets = new Map();
	this.activeSocketTimer = Date.now();

	this.Initialize = function() {
		this.LoadCachedDevices();
	};

	this.LoadCachedDevices = function(){
		service.log("Loading Cached Devices...");

		for(const [key, value] of this.cache.Entries()){
			service.log(`Found Cached Device: [${key}: ${JSON.stringify(value)}]`);
			this.checkCachedDevice(value.ip);
		}
	};

	this.checkCachedDevice = function(ip) {
		service.log(`Checking IP: ${ip}`);

		if(UDPServer !== undefined) {
			UDPServer.stop();
			UDPServer = undefined;
		}

		const socketServer = new UdpSocketServer(ip);
		this.activeSockets.set(ip, socketServer);
		socketServer.start();
	};

	this.clearSockets = function() {
		if(Date.now() - this.activeSocketTimer > 5000 && this.activeSockets.size > 0) {
			service.log("Nuking Active Cache Sockets.");

			for(const [key, value] of this.activeSockets.entries()){
				service.log(`Nuking Socket for IP: [${key}]`);
				value.stop();
				this.activeSockets.delete(key);
				//Clear would be more efficient here, however it doesn't kill the socket instantly.
				//We instead would be at the mercy of the GC.
			}
		}
	};

	this.purgeIPCache = function() {
		this.cache.PurgeCache();
	};

	this.Update = function() {
		if (this.timeSinceLastReq <= 0) {
			service.log("Requesting...");
			service.broadcast("Z-SEARCH * \r\n");

			this.timeSinceLastReq = 10;
			this.clearSockets();
		}

		this.timeSinceLastReq--;
	};

	this.ResponseStringToObj = function(sResponse) {
		const response = {};
		const sResp = sResponse.toString().split("\r\n");

		for(const sLine of sResp){
			const vPair = sLine.split("=");

			if (vPair.length === 2) {
				response[vPair[0].toString().toLowerCase()] = vPair[1].toString();
			}
		}

		return response;
	};

	this.forcedDiscovery = function(value) {
		// Convert response to object.
		const response = this.ResponseStringToObj(value.data);

		service.log("DISC: "+JSON.stringify(response));

		const bIsCololight = response.subkey && (response.subkey === "C32" || response.subkey === "HC32" || response.subkey === "HKC32");

		if (bIsCololight) {
			value.response = response;
			value.id = response.sn;

			const controller = service.getController(value.id);

			if (controller === undefined) {
				// Create and add new controller.
				const cont = new CololightSet(value);
				service.addController(cont);

				// Instantiate device in SignalRGB, and pass 'this' object to device.
				service.announceController(cont);

			} else {
				controller.updateWithValue(value);
			}
		}
	};

	this.Discovered = function(value) {
		// Convert response to object.
		const response = this.ResponseStringToObj(value.response);

		service.log("DISC: "+JSON.stringify(response));

		const bIsCololight = response.subkey && (response.subkey === "C32" || response.subkey === "HC32" || response.subkey === "HKC32");

		if (bIsCololight) {
			value.response = response;

			const controller = service.getController(value.id);

			if (controller === undefined) {
				// Create and add new controller.
				const cont = new CololightSet(value);
				service.addController(cont);

				// Instantiate device in SignalRGB, and pass 'this' object to device.
				service.announceController(cont);

			} else {
				controller.updateWithValue(value);
			}
		}
	};

}


class UdpSocketServer{
	constructor (ip) {
		this.count = 0;
		/** @type {udpSocket | null} */
		this.server = null;
		this.listenPort = 0;
		this.broadcastPort = 12345;
		this.ipToConnectTo = ip;
	}

	write(packet, address, port) {
		if(!this.server) {
			this.server = udp.createSocket();

			this.server.on('error', this.onError.bind(this));
			this.server.on('message', this.onMessage.bind(this));
			this.server.on('listening', this.onListening.bind(this));
			this.server.on('connection', this.onConnection.bind(this));
		}

		this.server.write(packet, address, port);
	}

	start(){
		this.server = udp.createSocket();

		if(this.server){

			// Given we're passing class methods to the server, we need to bind the context (this instance) to the function pointer
			this.server.on('error', this.onError.bind(this));
			this.server.on('message', this.onMessage.bind(this));
			this.server.on('listening', this.onListening.bind(this));
			this.server.on('connection', this.onConnection.bind(this));
			this.server.bind(this.listenPort);
			this.server.connect(this.ipToConnectTo, this.broadcastPort);

			service.log(this.listenPort);
			service.log(this.ipToConnectTo);
		}
	};

	stop(){
		if(this.server) {
			this.server.disconnect();
			this.server.close();
		}
	}

	onConnection(){
		service.log('Connected to remote socket!');
		service.log("Remote Address:");
		service.log(this.server.remoteAddress(), {pretty: true});
		service.log("Sending Check to socket");

		const bytesWritten = this.server.send("Z-SEARCH * \r\n");

		if(bytesWritten === -1){
			service.log('Error sending data to remote socket');
		}
	};

	onListenerResponse(msg) {
		service.log('Data received from client');
		service.log(msg, {pretty: true});
	}

	onListening(){
		const address = this.server.address();
		service.log(`Server is listening at port ${address.port}`);

		// Check if the socket is bound (no error means it's bound but we'll check anyway)
		service.log(`Socket Bound: ${this.server.state === this.server.BoundState}`);
	};
	onMessage(msg){
		service.log('Data received from client');
		service.log(msg, {pretty: true});
		msg.ip = this.ipToConnectTo;
		msg.port = this.broadcastPort;

		discovery.forcedDiscovery(msg);
	};
	onError(code, message){
		service.log(`Error: ${code} - ${message}`);
		this.server.close();
		this.server.disconnect();
		//Yeet the socket if we're having issues.
	};
}

class CololightSet {
	constructor(value) {
		this.updateWithValue(value, false);

		service.log("Constructed: "+this.name);
		service.log("Model is "+this.model);
		service.log("Image is "+this.image);

		this.cacheControllerInfo(this);
	}

	modelToName(model) {
		if (model === "C32"){
			return "Hexa";
		} else if (model === "HC32"){
			return "Hexa";
		} else if (model === "HKC32"){
			return "Strip";
		}

		return "Cololight";

	}

	modelToImage(model) {
		if (model === "C32"){
			return "https://assets.signalrgb.com/devices/brands/cololight/misc/wifi-device.png";
		} else if (model === "HC32"){
			return "https://assets.signalrgb.com/devices/brands/cololight/misc/wifi-device.png";
		} else if (model === "HKC32"){
			return "https://assets.signalrgb.com/devices/brands/cololight/misc/strips.png";
		}

		return "https://assets.signalrgb.com/devices/brands/cololight/misc/wifi-device.png";

	}

	updateWithValue(value, notify=true) {
		this.ip = value.ip;
		this.port = value.port;
		this.id = value.id;
		this.response = value.response;
		this.model = value.response.subkey;
		this.modelname = this.modelToName(this.model);
		this.image = this.modelToImage(this.model);
		this.name = this.modelname+" "+value.id.slice(-8);

		if (notify) { service.updateController(this); }
	}

	update() {

	}

	cacheControllerInfo(value){
		discovery.cache.Add(value.id, {
			name: value.name,
			port: value.port,
			ip: value.ip,
			id: value.id
		});
	}
}

class IPCache{
	constructor(){
		this.cacheMap = new Map();
		this.persistanceId = "ipCache";
		this.persistanceKey = "cache";

		this.PopulateCacheFromStorage();
	}
	Add(key, value){
		if(!this.cacheMap.has(key)) {
			service.log(`Adding ${key} to IP Cache...`);

			this.cacheMap.set(key, value);
			this.Persist();
		}
	}

	Remove(key){
		this.cacheMap.delete(key);
		this.Persist();
	}
	Has(key){
		return this.cacheMap.has(key);
	}
	Get(key){
		return this.cacheMap.get(key);
	}
	Entries(){
		return this.cacheMap.entries();
	}

	PurgeCache() {
		service.removeSetting(this.persistanceId, this.persistanceKey);
		service.log("Purging IP Cache from storage!");
	}

	PopulateCacheFromStorage(){
		service.log("Populating IP Cache from storage...");

		const storage = service.getSetting(this.persistanceId, this.persistanceKey);

		if(storage === undefined){
			service.log(`IP Cache is empty...`);

			return;
		}

		let mapValues;

		try{
			mapValues = JSON.parse(storage);
		}catch(e){
			service.log(e);
		}

		if(mapValues === undefined){
			service.log("Failed to load cache from storage! Cache is invalid!");

			return;
		}

		if(mapValues.length === 0){
			service.log(`IP Cache is empty...`);
		}

		this.cacheMap = new Map(mapValues);
	}

	Persist(){
		service.log("Saving IP Cache...");
		service.saveSetting(this.persistanceId, this.persistanceKey, JSON.stringify(Array.from(this.cacheMap.entries())));
	}

	DumpCache(){
		for(const [key, value] of this.cacheMap.entries()){
			service.log([key, value]);
		}
	}
}

export function ImageUrl() {
	return "https://assets.signalrgb.com/devices/brands/cololight/misc/wifi-device.png";
}