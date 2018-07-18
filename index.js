'use strict';

/*
@author Akash Singh
@email contact@akashsingh.io
@web akashsingh.io
*/

const ls = window.libsignal;
const store = new window.SignalProtocolStore();

const KeyHelper = ls.KeyHelper;
const numberOfPreKeys = 2;
const serverBaseUrl = window.location.href;



let idKeyPair = {};
let registrationId;
let deviceId;
let preKeyObjects = [];
let preKeyObjectsToSend = [];
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
let listHTMLOfMyContacts, initErrorElement, initSuccessElement, sendErrorElement, sendSuccessElement, 
    requestKeysErrorElement, requestKeysSuccessElement, processKeysErrorElement, processKeysSuccessElement,
    messagingErrorElement, messagingSuccessElement;

document.addEventListener('DOMContentLoaded', e => {
    // Initializing HTML element variables
    listHTMLOfMyContacts = document.querySelector('#list-of-contacts');
    initErrorElement = document.querySelector('#error-init-container');
    initSuccessElement = document.querySelector('#success-init-container');
    sendErrorElement = document.querySelector('#error-send-container');
    sendSuccessElement = document.querySelector('#success-send-container');
    requestKeysErrorElement = document.querySelector('#error-request-keys-form');
    requestKeysSuccessElement = document.querySelector('#success-request-keys-form');
    processKeysErrorElement = document.querySelector('#error-process-keys-form');
    processKeysSuccessElement = document.querySelector('#success-process-keys-form');
    messagingErrorElement = document.querySelector('#error-messaging-form');
    messagingSuccessElement = document.querySelector('#success-messaging-form');

    document.querySelector('#init-my-identity').addEventListener('click', e => {
        let myDeviceId = parseInt(document.querySelector('#init-device-id').value);
        if(isNaN(myDeviceId)) {
            console.log('Please enter a valid numeric device ID');
            initErrorElement.innerHTML = 'Please enter a valid numeric device ID';
        } else {
            initErrorElement.innerHTML = '';
            deviceId = myDeviceId;
            generateResgistrationId(myDeviceId);
        }
    });
});

function generateResgistrationId(myDeviceId) {
    registrationId = KeyHelper.generateRegistrationId();
    myIdentifiers['registrationId'] = registrationId;
    myIdentifiers['deviceId'] = myDeviceId;
    store.put('registrationId', registrationId);
    document.querySelector('#init-registration-id').value = registrationId;
    waitForMessageSend();
    waitForMessageReceive();
    generateIdKey();
}

function generateIdKey() {
    KeyHelper.generateIdentityKeyPair().then(identityKeyPair => {
        idKeyPair = identityKeyPair;
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
            store.storePreKey(preKeyObject.keyId, preKeyObject.keyPair);
            let preKeyObjectToSend = {
                id: preKeyObject.keyId,
                key: window.arrBuffToBase64(preKeyObject.keyPair.pubKey)
            };
            preKeyObjectsToSend.push(preKeyObjectToSend); 
        });
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
        store.storeSignedPreKey(signedPreKey.keyId, signedPreKeyObject.keyPair);
        registerWithServer()
    });
}

function registerWithServer() {
    initSuccessElement.innerHTML = 'Initialization Complete. Please send your initial packet to server.'
    document.querySelector('#registration-id').value = registrationId;
    document.querySelector('#identity-key').value = window.arrBuffToBase64(idKeyPair.pubKey);
    document.querySelector('#signed-prekey-id').value = signedPreKeyObject.keyId;
    document.querySelector('#signed-prekey-key').value = window.arrBuffToBase64(signedPreKeyObject.keyPair.pubKey);
    document.querySelector('#signed-prekey-signature').value = window.arrBuffToBase64(signedPreKeyObject.signature);
    document.querySelector('#prekey-id').value = preKeyObjects[0].keyId;
    document.querySelector('#prekey-key').value = window.arrBuffToBase64(preKeyObjects[0].keyPair.pubKey);
    
    document.querySelector('#send-keys').addEventListener('click', e => {
        sendKeysToServer(); // Send inital key packet
        waitForKeys(); // Enable manually adding recipient's details to create a session
        waitForRequestKeys(); // Enable retrieve key functionality from server
    });
}

function sendKeysToServer() {
    let url = serverBaseUrl + 'send';
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
        /*preKey: {
            id: preKeyObjects[0].keyId,
            key: window.arrBuffToBase64(preKeyObjects[0].keyPair.pubKey)
        }*/
        preKeys: preKeyObjectsToSend
    }

    window.sendRequest(url, requestObject).then(res => {
        if(res.err) {
            sendSuccessElement.innerHTML = '';
            sendErrorElement.innerHTML = (typeof res.err === 'string') ? res.err : res.err.toString();
        } else {
            sendErrorElement.innerHTML = '';
            sendSuccessElement.innerHTML = 'Initial packet delivered successfully.';
        }
    });
}

function waitForRequestKeys() {
    document.querySelector('#request-keys').addEventListener('click', event => {
        let requestObject = {
            registrationId: parseInt(document.querySelector('#request-keys-registration-id').value),
            deviceId: parseInt(document.querySelector('#request-keys-device-id').value)
        };
        let url = serverBaseUrl + 'get';
        window.sendRequest(url, requestObject).then(obj => {
            processReceivedKeys(obj);
        })
    });
}

function processReceivedKeys(resJson) {
    if(resJson.err) {
        requestKeysSuccessElement.innerHTML = '';
        requestKeysErrorElement.innerHTML = (typeof resJson.err === 'string') ? resJson.err : resJson.err.toString();
    } else {
        document.querySelector('#receive-registration-id').value = resJson.registrationId;
        document.querySelector('#receive-device-id').value = resJson.deviceId;
        document.querySelector('#receive-identity-key').value = resJson.identityKey;
        document.querySelector('#receive-signed-prekey-id').value = resJson.signedPreKey.id;
        document.querySelector('#receive-signed-prekey-key').value = resJson.signedPreKey.key;
        document.querySelector('#receive-signed-prekey-signature').value = resJson.signedPreKey.signature;
        document.querySelector('#receive-prekey-id').value = resJson.preKey.id;
        document.querySelector('#receive-prekey-key').value = resJson.preKey.key;

        requestKeysErrorElement.innerHTML = '';
        requestKeysSuccessElement.innerHTML = 'Keys for ' + resJson.registrationId + resJson.deviceId + ' retrieved successfully.'
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
        let incomingDeviceIdStr = document.querySelector('#receive-device-id').value;
        setupSession(processPreKeyObject, incomingDeviceIdStr);
    })
}

function setupSession(processPreKeyObject, incomingDeviceIdStr) {
    let recipientAddress = new ls.SignalProtocolAddress(processPreKeyObject.registrationId, incomingDeviceIdStr);
    let sessionBuilder = new ls.SessionBuilder(store, recipientAddress);
    sessionBuilder.processPreKey(processPreKeyObject)
        .then(resp => {
            console.log('Success! Session Established!');
            // Store incoming key packet to known contacts
            myContacts[processPreKeyObject.registrationId + incomingDeviceIdStr] = {
                deviceId: parseInt(incomingDeviceIdStr),
                preKeyObject: processPreKeyObject
            };

            saveContact(processPreKeyObject.registrationId, incomingDeviceIdStr);

            processKeysErrorElement.innerHTML = '';
            processKeysSuccessElement.innerHTML = 'Contact added successfully.'

        }).catch(err => {
            console.log('Failed!');
            processKeysErrorElement.innerHTML = (typeof err === 'string') ? err : err.toString();
        });
}

function waitForMessageSend() {
    document.querySelector('#send-message').addEventListener('click', event => {
        let rawMessageStr = document.querySelector('#send-plaintext').value;
        let message = new TextEncoder("utf-8").encode(rawMessageStr);
        let messageTo = myContacts[parseInt(document.querySelector('#message-to-field').value)];
        if(message && messageTo) {
            sendMessageToServer(message, messageTo)
        } else {
          console.log('Invalid To or Message entry. Please check the fields');
          messagingSuccessElement.innerHTML = '';
          messagingErrorElement.innerHTML = 'Invalid To or Message entry. Please check the fields';
        }
    });
}

function sendMessageToServer(message, messageToObject) {
    let url = serverBaseUrl + 'send/message';

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

    let signalMessageToAddress = new ls.SignalProtocolAddress(requestObject.messageTo.registrationId, 
        requestObject.messageTo.deviceId);
    let sessionCipher = new ls.SessionCipher(store, signalMessageToAddress);

    sessionCipher.encrypt(message).then(ciphertext => {
        requestObject.ciphertextMessage = ciphertext;
        window.sendRequest(url, requestObject).then(res => {
            if(res.err) {
                console.log(res.err);
                messagingSuccessElement.innerHTML = '';
                messagingErrorElement.innerHTML = (typeof res.err === 'string') ? res.err : res.err.toString();    
            } else {
                console.log('Message succesfully sent to server');
                messagingErrorElement.innerHTML = '';
                messagingSuccessElement.innerHTML = 'Message succesfully sent to server.';
            }
        });
    }).catch(err => {
        messagingSuccessElement.innerHTML = '';
        messagingErrorElement.innerHTML = (typeof err === 'string') ? err : err.toString();
    });
}

function waitForMessageReceive() {
    document.querySelector('#receive-message').addEventListener('click', event => {
        let messageFrom = myContacts[document.querySelector('#message-from-field').value];

        if(messageFrom) {
            getMessagesFromServer(messageFrom);
        } else {
            getMessagesFromServer();
        }
    });
}

function getMessagesFromServer(messageFrom) {
    let url = serverBaseUrl + 'get/message';
    let messageFromUniqueId;

    if(messageFrom) {
        messageFromUniqueId = messageFrom.preKeyObject.registrationId.toString() + messageFrom.deviceId.toString(); 
    } else {
        messageFromUniqueId = document.querySelector('#message-from-field').value;
    }

    let requestObject = {
        messageTo: myIdentifiers,
        messageFromUniqueId: messageFromUniqueId
    };

    window.sendRequest(url, requestObject).then(res => {
        if(res.err) {
            console.log(res.err);
            messagingSuccessElement.innerHTML = '';
            messagingErrorElement.innerHTML = (typeof res.err === 'string') ? res.err : res.err.toString();
        } else {
            processIncomingMessage(res);
        }
    })
}

function processIncomingMessage(incomingMessageObj) {
    console.log(incomingMessageObj);
    let signalMessageFromAddress = new ls.SignalProtocolAddress(incomingMessageObj.messageFrom.registrationId, 
        incomingMessageObj.messageFrom.deviceId);
    let sessionCipher = new ls.SessionCipher(store, signalMessageFromAddress); 
    sessionCipher.decryptPreKeyWhisperMessage(incomingMessageObj.ciphertextMessage.body, 'binary').then(plaintext => {
        let decryptedMessage = window.util.toString(plaintext);
        console.log(decryptedMessage);
        document.querySelector('#receive-plaintext').value = decryptedMessage;

        saveContact(incomingMessageObj.messageFrom.registrationId.toString(), incomingMessageObj.messageFrom.deviceId.toString());

        messagingErrorElement.innerHTML = '';
        messagingSuccessElement.innerHTML = 'Message decrypted succesfully.';
    }).catch(err => {
        messagingSuccessElement.innerHTML = '';
        messagingErrorElement.innerHTML = (typeof err === 'string') ? err : err.toString();
    });
}

function saveContact(contactRegId, contactDevId) {
    let newContactItem = document.createElement('li');
    let listInnerString = 'Unique ID: ' + contactRegId + contactDevId + ' Registration ID: ' + contactRegId 
        + ' Device ID: ' + contactDevId;

    newContactItem.appendChild(document.createTextNode(listInnerString));
    listHTMLOfMyContacts.appendChild(newContactItem);
}
