'use strict';

// @author Akash Singh

/*
* Sample Node server for signal
*/

/*
receiveKeys - get keys (initial key packet and preKeys) from client. 
Initial/Registration Packet:
req.body = {
	type: 'init'
	deviceId: <int>,
	registrationId: <int>,
	identityKey: <str>,
	signedPreKey: {
		id: <int>,
		key: <str>,
		signature: <str>
	},
	preKeys: [
		{
			id: <int>,
			key: <str>
		},
		{
			id: <int>,
			key: <str>
		},
		...
	]
}
Pre Keys Packet:
req.body = {
	type: 'pre-keys'
	deviceId: <int>,
	registrationId: <int>,
	preKeys: [
		{
			id: <int>,
			key: <str>
		},
		{
			id: <int>,
			key: <str>
		},
		...
	]
}
*/

/*
sendKeys - send keys packet to a client that requests for it
Get initial request:
req.body = {
	type: 'init'
	deviceId: <int>,
	registrationId: <int>
}
Get preKeys request:
req.body = {
	type: 'pre-keys'
	deviceId: <int>,
	registrationId: <int>	
}
*/

/*
messageStoreMap = {
	'recipients regId + recipients devId' + sender's regId + sender's devId: {
		to: {
			registrationId: <recipient's regId>,
			deviceId: <recipient's devId>
		},
		from: {
			registrationId: <sender's regId>,
			deviceId: <sender's devId>	
		},
		ciphertextMessage: {
			type: <int>,
			body: <signal enc text>,
			registrationId: <int>
		}
	}
}
*/

const express = require('express');

const app = express();

const constants = {
	INIT: 'init',
	PRE_KEYS: 'pre-keys'
}

app.use(express.json({strict: true}));

app.use(express.static(__dirname));
app.get('*', (req, res) => {
	res.sendfile(__dirname + '/index.html')
});

app.listen(3000, () => console.log('listening on 3000'));

app.post('/send', receiveKeys);
app.post('/get', sendKeys);
app.post('/send/message', storeIncomingMessage);
app.post('/get/message', forwardMessageToClient);

var storageMap = {};
var messageStorageMap = {};

function receiveKeys(req, res){
	let reqObj = req.body;
	//console.log(req.body);
	let storageKey = reqObj.registrationId.toString() + reqObj.deviceId.toString();
	if(storageMap[storageKey]){
		res.json({err: 'Init packet for this user already exists'});
	} else {
		storageMap[storageKey] = reqObj;
		res.json({msg: 'Initial packet successfully saved'});
	}
	console.log('\n');
	console.log('storageMap~~~~~~~');
	console.log(storageMap);
}

function sendKeys(req, res){
	let reqObj = req.body;
	let storageKey = reqObj.registrationId.toString() + reqObj.deviceId.toString();
	let responseObject;
	if(storageMap[storageKey]){ 
		if(storageMap[storageKey].preKeys.length !== 0){
			responseObject = JSON.parse(JSON.stringify(storageMap[storageKey]));
			responseObject.preKey = responseObject.preKeys[responseObject.preKeys.length - 1];
			storageMap[storageKey].preKeys.pop();
		} else {
			responseObject = {err: 'Out of preKeys for this user'}
		}
	} else {
		responseObject = {
			err: 'Keys for ' + storageKey + ' user does not exist'
		}
	}
	console.log(responseObject);
	res.json(responseObject);
}

function storeIncomingMessage(req, res) {
	let reqObj = req.body;
	let messageStorageKey = reqObj.messageTo.registrationId.toString() + reqObj.messageTo.deviceId.toString() + reqObj.messageFrom.registrationId.toString() + reqObj.messageFrom.deviceId.toString();
	if(messageStorageMap[messageStorageKey]) {
		res.json({err: 'Can only deal with one message'});
	} else {
		messageStorageMap[messageStorageKey] = reqObj;
		res.json({msg: 'Message successfully saved'});
	}
	console.log('\n');
	console.log('~~~~~~~messageStorageMap~~~~~~~');
	console.log(messageStorageMap);
}

function forwardMessageToClient(req, res) {
	let reqObj = req.body;
	let messageStorageKey = reqObj.messageTo.registrationId.toString() + reqObj.messageTo.deviceId.toString() + reqObj.messageFromUniqueId;
	let responseObject;
	if(messageStorageMap[messageStorageKey]){
		if(storageMap[reqObj.messageFromUniqueId]){
			responseObject = messageStorageMap[messageStorageKey];
			responseObject.messageFrom = {
				registrationId: storageMap[reqObj.messageFromUniqueId].registrationId,
				deviceId: storageMap[reqObj.messageFromUniqueId].deviceId
			};
		} else {
			{ err: 'Client: ' + reqObj.messageFromUniqueId + ' is not registered on this server.' }
		}
	} else {
		responseObject = { err: 'Message from: ' + reqObj.messageFromUniqueId + ' to: ' + reqObj.messageTo.registrationId.toString() + reqObj.messageTo.deviceId.toString() + ' does not exist' };
	}
	res.json(responseObject);
}
