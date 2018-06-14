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

generateResgistrationId();

function generateResgistrationId() {
    registrationId = KeyHelper.generateRegistrationId();
    console.log('registrationId');
    console.log(registrationId);
    store.put('registrationId', registrationId);
    generateIdKey();
}

function generateIdKey() {
    KeyHelper.generateIdentityKeyPair().then(identityKeyPair => {
        idKeyPair = identityKeyPair;
        console.log('idKeyPair');
        console.log(idKeyPair);
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
        console.log('preKeyObjects');
        console.log(preKeyObjects);
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
        console.log('signedPreKeyObject');
        console.log(signedPreKeyObject);
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
        sendRequest(url, requestObject).then(obj => {
            console.log(obj);
        })
    });
}

function sendRequest(url, reqObj) {
    return fetch(url, {
        method: 'POST',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(reqObj)
    })
    .then(res => {
        return res.json();
    })
    .catch(err => {
        console.log(err);
    })
}

function waitForRequestKeys() {
    document.querySelector('#request-keys').addEventListener('click', event => {
        let requestObject = {
            registrationId: document.querySelector('#request-keys-registration-id').value,
            deviceId: document.querySelector('#request-keys-device-id').value
        };
        let url = 'http://localhost:3000/get';
        sendRequest(url, requestObject).then(obj => {
            processReceivedKeys(obj);
        })
    });
}

function processReceivedKeys(resJson) {
    document.querySelector('#receive-registration-id').value = resJson.registrationId;
    document.querySelector('#receive-device-id').value = resJson.deviceId;
    document.querySelector('#receive-identity-key').value = resJson.identityKey;
    document.querySelector('#receive-signed-prekey-id').value = resJson.signedPreKey.id;
    document.querySelector('#receive-signed-prekey-key').value = resJson.signedPreKey.key;
    document.querySelector('#receive-signed-prekey-signature').value = resJson.signedPreKey.signature;
    document.querySelector('#receive-prekey-id').value = resJson.preKey.id;
    document.querySelector('#receive-prekey-key').value = resJson.preKey.key;
}

function waitForKeys() {
    document.querySelector('#parse-keys').addEventListener('click', event => {
        let processPreKeyObject = {
            registrationId: document.querySelector('#receive-registration-id').value,
            deviceId: document.querySelector('#receive-device-id').value,
            identityKey: window.base64ToArrBuff(document.querySelector('#receive-identity-key').value),
            signedPreKey: {
                keyId: document.querySelector('#receive-signed-prekey-id').value,
                publicKey: window.base64ToArrBuff(document.querySelector('#receive-signed-prekey-key').value),
                signature: window.base64ToArrBuff(document.querySelector('#receive-signed-prekey-signature').value)
            },
            preKey: {
                keyId: document.querySelector('#receive-prekey-id').value,
                publicKey: window.base64ToArrBuff(document.querySelector('#receive-prekey-key').value)
            }
        };
        setupSession(processPreKeyObject);
    })
}

function setupSession(processPreKeyObject) {
    let recipientAddress = new ls.SignalProtocolAddress(processPreKeyObject.recipientId, processPreKeyObject.deviceId);
    console.log(recipientAddress);
    let sessionBuilder = new ls.SessionBuilder(store, recipientAddress);
    sessionBuilder.processPreKey(processPreKeyObject)
        .then(resp => {
            console.log('Success! Session Established!');
        }).catch(err => {
            console.log('Failed!');
        });
}
