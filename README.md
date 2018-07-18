# Simple Browser-Based Server-Client Implementation of libsignal-protocol-javascript

To build an open source signal protocol example application for developing a better understanding of the library and signal protocol itself.

Currently hosted at [AWS](http://ec2-54-219-170-163.us-west-1.compute.amazonaws.com:3000/)

## Getting Started

### How to Run

* Clone repository
* Install dependencies
	```
	npm install
	```
* Get libsignal-protocol-javascript from github page
* Extract contents of zip in root (./) folder
* Root folder should not also have ./libsignal-protocol-javascript-master folder
* Navigate to root folder
* Install emscripten
	```
	git clone https://github.com/juj/emsdk.git
	cd emsdk
	./emsdk install latest
	./emsdk activate latest
	source ./emsdk_env.sh
	```
* Navigate to folder cd ./libsignal-protocol-javascript-master
* Run the following commands
	```
	npm install -g grunt-cli
	npm install
	grunt compile
	```
* Run app
	```
	node server.js
	```

### How to Use

#### Receiver
* Navigate to localhost:3000
* Set a device ID manually (numeric)
* Wait for registration ID and initial key packet generation
* Send initial key packet to server
* Wait for Sender to send a message
* Enter Senders address (concat registration ID + device ID)
* Get Message

#### Sender
* Navigate to localhost:3000
* Set a device ID manually (numeric)
* Wait for registration ID and initial key packet generation
* Send initial key packet to server
* Enter Receiver's device ID and registration ID to retrieve key packet
* Process keys
* Copy Receiver's address from the contact list and paste in To field
* Enter a message
* Send