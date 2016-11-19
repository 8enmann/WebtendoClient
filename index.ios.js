/**
 * React Native Webtendo controller.
 * https://github.com/8enmann/WebtendoClient
 * @flow
 */

import React, { Component } from 'react';
import {
  AppRegistry,
  AsyncStorage,
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';

import {
  RTCPeerConnection,
  RTCIceCandidate,
  RTCSessionDescription,
  RTCView,
} from 'react-native-webrtc';

import WebViewBridge from 'react-native-webview-bridge';
  
import Config from 'react-native-config'


window.navigator.userAgent = "react-native";
var io = require('socket.io-client/socket.io');
var socket = io.connect(`ws://${Config.SIGNALING_SERVER_URL}`, {
  jsonp: false,
  transports: ['websocket']
});
var {height, width} = Dimensions.get('window');

export default class WebtendoClient extends Component {
  constructor(props) {
    super(props);
    this.state = {
      joined: false,
      ip: 'Connecting...',
      stickX: height/2,
      stickY: width/4,
    };
  }
  componentDidMount() {
    onMessageReceived = this.onMessageReceived.bind(this);
  }
  onMessageReceived(x) {
    console.log(x);
    this.setState({ip: 'Connected'});
    const { webviewbridge } = this.refs;
    webviewbridge.sendToBridge(JSON.stringify(x));
  }
  handlePress(evt, region) {
    let x = evt.nativeEvent.pageX;
    let y = evt.nativeEvent.pageY;
    if (region === 'stick') {
      this.setState({stickX: x, stickY: y});
    }
    console.log(evt.nativeEvent);
  }
  onBridgeMessage(stringifiedMessage){
    const { webviewbridge } = this.refs;
    sendToClient(clientId, stringifiedMessage);
  }
  render() {
    return (
      <WebViewBridge
      ref="webviewbridge"
      onBridgeMessage={this.onBridgeMessage.bind(this)}
      source={{uri: `http://${Config.SIGNALING_SERVER_URL}/client-no-transport.html#rn`}}/>
    );
  }
}

const styles = StyleSheet.create({
});

AppRegistry.registerComponent('WebtendoClient', () => WebtendoClient);


/****************************************************************************
 * Public interface
 ****************************************************************************/

// Called when a message is received. Host can check message.clientId for sender.
var onMessageReceived;
// Called when a data channel opens, passing clientId as argument.
var onConnected;
// Am I the host?
var isHost;
// My ID.
var clientId;
// Send a message to a particular client.
function sendToClient(recipientId, stringifiedMessage) {
  if (dataChannels[recipientId]) {
    return dataChannels[recipientId].send(stringifiedMessage);
  } else {
    console.log('no dataChannels');
  };
}
// Send a message to all clients.
function broadcast(obj) {
  return getClients().map(client => sendToClient(client, obj));
}
// Get a list of all the clients connected.
function getClients() {
  return Object.keys(dataChannels);
}
// Measure latency at 1Hz.
const AUTO_PING = false;
const VERBOSE = true;

/****************************************************************************
 * Initial setup
 ****************************************************************************/

var configuration = {
  'iceServers': [
    {'url': 'stun:stun.l.google.com:19302'},
    {'url':'stun:stun.services.mozilla.com'},
  ]
};

// Create a random room if not already present in the URL.
isHost = false;
// TODO: allow room override.
var room = '';
// Use session storage to maintain connections across refresh but allow
// multiple tabs in the same browser for testing purposes.
// Not to be confused with socket ID.
AsyncStorage.getItem('clientId').then(result => {
  if (!result) {
    clientId = Math.random().toString(36).substr(2, 10);
    AsyncStorage.setItem('clientId', clientId);
  } else {
    clientId = result;
  }
  socket.emit('create or join', 'foo', clientId, isHost);
  maybeLog()('Session clientId ' + clientId);  
});
    
/****************************************************************************
 * Signaling server
 ****************************************************************************/

socket.on('created', function(room, hostClientId) {
  maybeLog()('Created room', room, '- my client ID is', clientId);
  if (!isHost) {
    // Get dangling clients to reconnect if a host stutters.
    peerConns = {};
    dataChannels = {};
    socket.emit('create or join', room, clientId, isHost);
  }
});

socket.on('full', function(room) {
  //alert('Room ' + room + ' is full. We will create a new room for you.');
  //window.location.hash = '';
  //window.location.reload();
  maybeLog()('server thinks room is full');
  // TODO: remove this
});

socket.on('joined', function(room, clientId) {
  maybeLog()(clientId, 'joined', room);
  createPeerConnection(isHost, configuration, clientId);
});

socket.on('log', function(array) {
  console.log.apply(console, array);
});

socket.on('message', signalingMessageCallback);

socket.on('nohost', room => console.error('No host for', room));

/**
 * Send message to signaling server
 */
function sendMessage(message, recipient) {
  var payload = {
    recipient: recipient,
    sender: clientId,
    rtcSessionDescription: message,
  };
  maybeLog()('Client sending message: ', payload);
  socket.emit('message', payload);
}

/****************************************************************************
 * WebRTC peer connection and data channel
 ****************************************************************************/

// Map from clientId to RTCPeerConnection. 
// For clients this will have only the host.
var peerConns = {};
// dataChannel.label is the clientId of the recipient. useful in onmessage.
var dataChannels = {};

function signalingMessageCallback(message) {
  maybeLog()('Client received message:', message);
  var peerConn = peerConns[isHost ? message.sender : clientId];
  // TODO: if got an offer and isHost, ignore?
  if (message.rtcSessionDescription.type === 'offer') {
    maybeLog()('Got offer. Sending answer to peer', message.sender);
    peerConn.setRemoteDescription(new RTCSessionDescription(message.rtcSessionDescription), function() {},
                                  logError);
    peerConn.createAnswer(onLocalSessionCreated(message.sender), logError);

  } else if (message.rtcSessionDescription.type === 'answer') {
    maybeLog()('Got answer.');
    peerConn.setRemoteDescription(new RTCSessionDescription(message.rtcSessionDescription), function() {},
                                  logError);

  } else if (message.rtcSessionDescription.type === 'candidate') {
    
    peerConn.addIceCandidate(new RTCIceCandidate({
      candidate: message.rtcSessionDescription.candidate
    }));

  } else if (message === 'bye') {
    // TODO: cleanup RTC connection?
  }
}

// clientId: who to connect to?
// isHost: Am I the initiator?
// config: for RTCPeerConnection, contains STUN/TURN servers.
function createPeerConnection(isHost, config, recipientClientId) {
  maybeLog()('Creating Peer connection. isHost?', isHost, 'recipient', recipientClientId, 'config:',
             config);
  peerConns[recipientClientId] = new RTCPeerConnection(config);

  // send any ice candidates to the other peer
  peerConns[recipientClientId].onicecandidate = function(event) {
    maybeLog()('icecandidate event:', event);
    if (event.candidate) {
      sendMessage({
        type: 'candidate',
        label: event.candidate.sdpMLineIndex,
        id: event.candidate.sdpMid,
        candidate: event.candidate.candidate
      }, recipientClientId);
    } else {
      maybeLog()('End of candidates.');
    }
  };

  if (isHost) {
    maybeLog()('Creating Data Channel');
    dataChannels[recipientClientId] = peerConns[recipientClientId].createDataChannel(recipientClientId);
    onDataChannelCreated(dataChannels[recipientClientId]);

    maybeLog()('Creating an offer');
    peerConns[recipientClientId].createOffer(onLocalSessionCreated(recipientClientId), logError);
  } else {
    peerConns[recipientClientId].ondatachannel = (event) => {
      maybeLog()('ondatachannel:', event.channel);
      dataChannels[recipientClientId] = event.channel;
      onDataChannelCreated(dataChannels[recipientClientId]);
    };
  }
}

function onLocalSessionCreated(recipientClientId) {
  return (desc) => {
    var peerConn = peerConns[isHost ? recipientClientId : clientId];
    maybeLog()('local session created:', desc);
    peerConn.setLocalDescription(desc, () => {
      maybeLog()('sending local desc:', peerConn.localDescription);
      sendMessage(peerConn.localDescription, recipientClientId);
    }, logError);
  };
}

function onDataChannelCreated(channel) {
  maybeLog()('onDataChannelCreated:', channel);

  channel.onopen = () => {
    if (onConnected) {
      onConnected(channel.label);
    }
    if (AUTO_PING) {
      // As long as the channel is open, send a message 1/sec to
      // measure latency and verify everything works
      var cancel = window.setInterval(() => {
        try {
          channel.send(JSON.stringify({
            action: 'echo',
            time: performance.now(),
          }));
        } catch (e) {
          console.error(e);
          
          window.clearInterval(cancel);
        }
      }, 1000);
    } else {
      // document.getElementById('latency').innerText = 'Connected';
    }
  };

  channel.onmessage = (event) => {
    // maybeLog()(event);
    var x = JSON.parse(event.data);
    if (x.action === 'echo') {
      x.action = 'lag';
      channel.send(JSON.stringify(x));
    } else if (x.action == 'text') {
      maybeLog()(x.data);
    } else if (x.action == 'lag') {
      var str = 'round trip latency ' + (performance.now() - x.time).toFixed(2) + ' ms';
      maybeLog()(str);
      // document.getElementById('latency').innerText = str;
    } else if (onMessageReceived) {
      x.clientId = channel.label;
      onMessageReceived(x);
    } else {
      maybeLog()('unknown action');
    }
  };
}


/****************************************************************************
 * Aux functions
 ****************************************************************************/


function randomToken() {
  return Math.floor((1 + Math.random()) * 1e16).toString(16).substring(1);
}

function logError(err) {
  console.log(err.toString(), err);
}

function maybeLog() {
  if (VERBOSE) {
    return console.log;
  }
  return function(){};
}
