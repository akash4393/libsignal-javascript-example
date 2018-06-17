'use strict';
//console.log(window.libsignal);

const ls = window.libsignal;
const store = new window.SignalProtocolStore();

const KeyHelper = ls.KeyHelper;
const numberOfPreKeys = 1;
const deviceId = 28724;



let idKeyPair = {};
let registrationId;
let preKeyObjects = [];
let signedPreKeyObject = {};

/* Object that stores my details
myIdentifiers = {
    registrationId: <my registration id>,
    deviceId: <my device id>
}
*/
let myIdentifiers = {};

/* Map that stores contact details in memory
myContacts = {
    '<contact's registration Id>+<contact's device Id>': {
        deviceId: <contact's device Id>,
        preKeyObject: {
            registrationId: <contact's registration id>,
            identityKey: <contact's identity key stored as a base64 ArrayBuffer>,
            signedPreKey: {
                keyId: <contact's signed pre key id>,
                publicKey: <contact's signed pre key public key key stored as a base64 ArrayBuffer>,
                signature: <contact's signed pre key signature stored as a base64 ArrayBuffer>
            },
            preKey: {
                keyId: <contact's pre key id>,
                publicKey: <contact's pre key public key stored as a base64 ArrayBuffer>
            }
        }
    }
}
*/
let myContacts = {};

// List element to display saved contacts
let listHTMLOfMyContacts = document.querySelector('#list-of-contacts');

generateResgistrationId();

function generateResgistrationId() {
    registrationId = KeyHelper.generateRegistrationId();
    
    myIdentifiers['registrationId'] = registrationId;
    myIdentifiers['deviceId'] = deviceId;

    //console.log('registrationId');
    //console.log(registrationId);
    store.put('registrationId', registrationId);
    generateIdKey();
}

function generateIdKey() {
    KeyHelper.generateIdentityKeyPair().then(identityKeyPair => {
        idKeyPair = identityKeyPair;
        //console.log('idKeyPair');
        //console.log(idKeyPair);
        store.put('identityKey', idKeyPair);
        generatePreKeys()
    });
}

// Generate multiple PreKeys (as per documentation)
function generatePreKeys() {    
    let listOfPreKeysPromise = [];
    for(let i = 0; i < numberOfPreKeys; i++){
        listOfPreKeysPromise.push(KeyHelper.generatePreKey(registrationId + i + 1));
    }
    Promise.all(listOfPreKeysPromise).then(preKeys => {
        preKeys.forEach(preKey => {
            let preKeyObject = {
                keyId: preKey.keyId,
                keyPair: preKey.keyPair
            };
            preKeyObjects.push(preKeyObject);
        });
        //console.log('preKeyObjects');
        //console.log(preKeyObjects);
        generateSignedPreKey();
    });
}

function generateSignedPreKey() {
    KeyHelper.generateSignedPreKey(idKeyPair, registrationId - 1).then(signedPreKey => {
        signedPreKeyObject = {
            keyId: signedPreKey.keyId,
            keyPair: signedPreKey.keyPair,
            signature: signedPreKey.signature
        }
        //console.log('signedPreKeyObject');
        //console.log(signedPreKeyObject);
        registerWithServer()
    });
}

function registerWithServer() {
    document.querySelector('#registration-id').value = registrationId;
    document.querySelector('#identity-key').value = window.arrBuffToBase64(idKeyPair.pubKey);
    document.querySelector('#signed-prekey-id').value = signedPreKeyObject.keyId;
    document.querySelector('#signed-prekey-key').value = window.arrBuffToBase64(signedPreKeyObject.keyPair.pubKey);
    document.querySelector('#signed-prekey-signature').value = window.arrBuffToBase64(signedPreKeyObject.signature);
    document.querySelector('#prekey-id').value = preKeyObjects[0].keyId;
    document.querySelector('#prekey-key').value = window.arrBuffToBase64(preKeyObjects[0].keyPair.pubKey);
    sendKeysToServer();
    waitForKeys();
    waitForRequestKeys();
}

function sendKeysToServer() {
    let url = 'http://localhost:3000/send';
    let requestObject = {
        type: 'init',
        deviceId: deviceId,
        registrationId: registrationId,
        identityKey: window.arrBuffToBase64(idKeyPair.pubKey),
        signedPreKey: {
            id: signedPreKeyObject.keyId,
            key: window.arrBuffToBase64(signedPreKeyObject.keyPair.pubKey),
            signature: window.arrBuffToBase64(signedPreKeyObject.signature)
        },
        preKey: {
            id: preKeyObjects[0].keyId,
            key: window.arrBuffToBase64(preKeyObjects[0].keyPair.pubKey)
        }
    }

    document.querySelector('#send-keys').addEventListener('click', event => {
        window.sendRequest(url, requestObject).then(obj => {
            //console.log(obj);
        })
    });
}

function waitForRequestKeys() {
    document.querySelector('#request-keys').addEventListener('click', event => {
        let requestObject = {
            registrationId: parseInt(document.querySelector('#request-keys-registration-id').value),
            deviceId: parseInt(document.querySelector('#request-keys-device-id').value)
        };
        let url = 'http://localhost:3000/get';
        window.sendRequest(url, requestObject).then(obj => {
            processReceivedKeys(obj);
        })
    });
}

function processReceivedKeys(resJson) {
    //console.log(resJson);
    if(resJson.err) {
        document.querySelector('#log-dump').innerHTML = resJson.err;
    } else {
        document.querySelector('#receive-registration-id').value = resJson.registrationId;
        document.querySelector('#receive-device-id').value = resJson.deviceId;
        document.querySelector('#receive-identity-key').value = resJson.identityKey;
        document.querySelector('#receive-signed-prekey-id').value = resJson.signedPreKey.id;
        document.querySelector('#receive-signed-prekey-key').value = resJson.signedPreKey.key;
        document.querySelector('#receive-signed-prekey-signature').value = resJson.signedPreKey.signature;
        document.querySelector('#receive-prekey-id').value = resJson.preKey.id;
        document.querySelector('#receive-prekey-key').value = resJson.preKey.key;
    }
}

function waitForKeys() {
    document.querySelector('#parse-keys').addEventListener('click', event => {
        let processPreKeyObject = {
            registrationId: parseInt(document.querySelector('#receive-registration-id').value),
            identityKey: window.base64ToArrBuff(document.querySelector('#receive-identity-key').value),
            signedPreKey: {
                keyId: parseInt(document.querySelector('#receive-signed-prekey-id').value),
                publicKey: window.base64ToArrBuff(document.querySelector('#receive-signed-prekey-key').value),
                signature: window.base64ToArrBuff(document.querySelector('#receive-signed-prekey-signature').value)
            },
            preKey: {
                keyId: parseInt(document.querySelector('#receive-prekey-id').value),
                publicKey: window.base64ToArrBuff(document.querySelector('#receive-prekey-key').value)
            }
        };
        let incomingDeviceId = document.querySelector('#receive-device-id').value;
        setupSession(processPreKeyObject, incomingDeviceId);
    })
}

function setupSession(processPreKeyObject, incomingDeviceId) {
    let recipientAddress = new ls.SignalProtocolAddress(processPreKeyObject.registrationId, incomingDeviceId);
    let sessionBuilder = new ls.SessionBuilder(store, recipientAddress);
    sessionBuilder.processPreKey(processPreKeyObject)
        .then(resp => {
            //console.log(resp);
            console.log('Success! Session Established!');
            // Store incoming key packet to known contacts
            myContacts[processPreKeyObject.registrationId + incomingDeviceId] = {
                deviceId: parseInt(incomingDeviceId),
                preKeyObject: processPreKeyObject
            };
            let newContactItem = document.createElement('li');
            let listInnerString = 'Unique ID: ' + processPreKeyObject.registrationId + incomingDeviceId + ' Device ID: ' + incomingDeviceId + ' Registration ID: ' + processPreKeyObject.registrationId;
            newContactItem.appendChild(document.createTextNode(listInnerString));
            listHTMLOfMyContacts.appendChild(newContactItem);
            waitForMessageSend();
            waitForMessageReceive();
        }).catch(err => {
            console.log('Failed!');
            throw err;
        });
}

function waitForMessageSend() {
    document.querySelector('#send-message').addEventListener('click', event => {
        let message = new TextEncoder("utf-8").encode('Hello from Signal!');//document.querySelector('#send-plaintext').value;
        let messageTo = myContacts[parseInt(document.querySelector('#message-to-field').value)];
        if(message && messageTo) {
            sendMessageToServer(message, messageTo)
        } else {
            console.log('Invalid message object. Please check the fields');
        }
    });
}

function sendMessageToServer(message, messageToObject) {
    let url = 'http://localhost:3000/send/message';

    let requestObject = {
        messageTo: {
            registrationId: messageToObject.preKeyObject.registrationId,
            deviceId: messageToObject.deviceId
        },
        messageFrom: {
            registrationId: myIdentifiers.registrationId,
            deviceId: myIdentifiers.deviceId
        },
        ciphertextMessage: 'Invalid ciphertext',
    };
    let signalMessageToAddress = new ls.SignalProtocolAddress(requestObject.messageTo.registrationId, requestObject.messageTo.deviceId)
    //console.log(signalMessageToAddress);
    let sessionCipher = new ls.SessionCipher(store, signalMessageToAddress);
    sessionCipher.encrypt(message).then(ciphertext => {
        //console.log(ciphertext);
        requestObject.ciphertextMessage = ciphertext;
        window.sendRequest(url, requestObject).then(res => {
            console.log('Message succesfully sent to server');
            //console.log(res);
        });
    });
}

function waitForMessageReceive() {
    document.querySelector('#receive-message').addEventListener('click', event => {
        let messageFrom = myContacts[document.querySelector('#message-from-field').value];
        //console.log('messageFrom');
        //console.log(messageFrom);
        if(messageFrom) {
           getMessagesFromServer(messageFrom); 
        } else {
            console.log('Invalid message object. Please check the fields');
        }
    });
}

function getMessagesFromServer(messageFrom) {
    let url = 'http://localhost:3000/get/message';

    let requestObject = {
        messageTo: myIdentifiers,
        messageFrom: {
            registrationId: messageFrom.preKeyObject.registrationId,
            deviceId: messageFrom.deviceId
        }
    };

    window.sendRequest(url, requestObject).then(res => {
        //console.log('Received response:');
        //console.log(res);
        if(res.err) {
            document.querySelector('#log-dump').innerHTML = res.err;
            document.querySelector('#receive-plaintext').value = res.err;
        } else {
            processIncomingMessage(res);
        }
    })
}

function processIncomingMessage(incomingMessageObj) {
    let signalMessageFromAddress = new ls.SignalProtocolAddress(incomingMessageObj.messageFrom.registrationId, incomingMessageObj.messageFrom.deviceId);
    let sessionCipher = new ls.SessionCipher(store, signalMessageFromAddress); 
    //incomingMessage.body = window.lsUtil.toArrayBuffer(incomingMessage.body)
    //console.log(incomingMessage);
    sessionCipher.decryptPreKeyWhisperMessage(incomingMessageObj.ciphertextMessage.body, 'binary').then(plaintext => {
        console.log(plaintext);
    });
}