const socket = io();

let localStream = null;
let peerConnection = null;
let roomCode = '';
let isInitiator = false;
let readyToCall = false;
let translatorRecorder = null;

const urlParams = new URLSearchParams(window.location.search);
const roomFromUrl = urlParams.get('room');
if (roomFromUrl) {
  document.getElementById('roomCode').value = roomFromUrl;
}

document.getElementById('joinCall').addEventListener('click', () => {
  const inputCode = document.getElementById('roomCode').value.trim();
  if (inputCode) {
    roomCode = inputCode;
    socket.emit('joinRoom', roomCode);
  } else {
    isInitiator = true;
    socket.emit('createRoom');
  }
});

document.getElementById('copyLink').addEventListener('click', () => {
  const link = `${window.location.origin}?room=${roomCode}`;
  navigator.clipboard.writeText(link).then(() => {
    document.getElementById('inviteStatus').innerText = 'Call link copied to clipboard.';
  });
});

socket.on('roomCreated', (code) => {
  roomCode = code;
  document.getElementById('myCode').innerText = 'Your call code: ' + code;
  document.getElementById('inviteStatus').innerText = 'Share this code or link with another user.';
  startLocalMedia();
});

socket.on('roomJoined', (code) => {
  roomCode = code;
  document.getElementById('myCode').innerText = 'Joined call: ' + code;
  document.getElementById('inviteStatus').innerText = 'Connected to room. Waiting for media...';
  startLocalMedia();
});

socket.on('ready', () => {
  readyToCall = true;
  if (isInitiator && peerConnection) {
    createAndSendOffer();
  }
});

socket.on('signal', async (data) => {
  if (!peerConnection) {
    await startLocalMedia();
  }

  if (data.offer) {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    socket.emit('signal', { room: roomCode, answer });
  }

  if (data.answer) {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
  }

  if (data.candidate) {
    try {
      await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
    } catch (error) {
      console.error('Error adding ICE candidate:', error);
    }
  }
});

socket.on('translatedSpeech', (payload) => {
  if (payload && payload.text) {
    document.getElementById('subtitle').innerText = payload.text;
    speakText(payload.text, payload.targetLang);
  }
});

socket.on('errorMessage', (message) => {
  document.getElementById('inviteStatus').innerText = message;
});

function getSelectedLanguage() {
  return document.getElementById('myLanguage').value;
}

async function startLocalMedia() {
  if (localStream) {
    return;
  }

  try {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    document.getElementById('localVideo').srcObject = localStream;
    setupPeerConnection();
    startSpeechTranslation();
    if (readyToCall && isInitiator) {
      createAndSendOffer();
    }
  } catch (error) {
    console.error('Failed to get local media:', error);
    document.getElementById('inviteStatus').innerText = 'Camera and microphone access required.';
  }
}

function setupPeerConnection() {
  if (peerConnection) {
    return;
  }

  peerConnection = new RTCPeerConnection({
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  });

  const remoteStream = new MediaStream();
  document.getElementById('remoteVideo').srcObject = remoteStream;

  if (localStream) {
    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));
  }

  peerConnection.ontrack = (event) => {
    event.streams[0].getTracks().forEach(track => remoteStream.addTrack(track));
  };

  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit('signal', { room: roomCode, candidate: event.candidate });
    }
  };

  peerConnection.onconnectionstatechange = () => {
    if (peerConnection.connectionState === 'connected') {
      document.getElementById('inviteStatus').innerText = 'Connected to remote participant.';
    }
  };
}

async function createAndSendOffer() {
  if (!peerConnection) {
    return;
  }
  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);
  socket.emit('signal', { room: roomCode, offer });
}

function startSpeechTranslation() {
  if (!localStream || translatorRecorder) {
    return;
  }

  try {
    translatorRecorder = new MediaRecorder(localStream, { mimeType: 'audio/webm;codecs=opus' });
  } catch (error) {
    console.error('MediaRecorder not supported:', error);
    return;
  }

  translatorRecorder.ondataavailable = async (event) => {
    if (!event.data || event.data.size === 0) {
      return;
    }

    const audioBase64 = await blobToBase64(event.data);
    const sourceLang = getSelectedLanguage();
    const targetLang = sourceLang === 'hi' ? 'en' : 'hi';

    socket.emit('translateAudio', {
      room: roomCode,
      sourceLang,
      targetLang,
      audio: audioBase64
    });
  };

  translatorRecorder.start(1500);
}

function blobToBase64(blob) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result;
      resolve(dataUrl.split(',')[1]);
    };
    reader.readAsDataURL(blob);
  });
}

function speakText(text, lang) {
  if (!text) {
    return;
  }
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang === 'hi' ? 'hi-IN' : 'en-US';
  window.speechSynthesis.speak(utterance);
}

document.getElementById('camera').addEventListener('click', () => {
  if (localStream) {
    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      const icon = document.querySelector('#camera i');
      icon.className = videoTrack.enabled ? 'fas fa-video' : 'fas fa-video-slash';
    }
  }
});

document.getElementById('mute').addEventListener('click', () => {
  if (localStream) {
    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      const icon = document.querySelector('#mute i');
      icon.className = audioTrack.enabled ? 'fas fa-microphone' : 'fas fa-microphone-slash';
    }
  }
});

document.getElementById('endCall').addEventListener('click', () => {
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }
  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
    localStream = null;
  }
  if (translatorRecorder && translatorRecorder.state !== 'inactive') {
    translatorRecorder.stop();
    translatorRecorder = null;
  }
  document.getElementById('localVideo').srcObject = null;
  document.getElementById('remoteVideo').srcObject = null;
  if (socket.connected) {
    socket.disconnect();
  }
  document.getElementById('inviteStatus').innerText = 'Call ended.';
});

document.getElementById('sendInvite').addEventListener('click', () => {
  const email = document.getElementById('email').value.trim();
  const code = roomCode;
  if (email && code) {
    socket.emit('sendInvite', email, code);
  }
});

socket.on('inviteSent', (success) => {
  document.getElementById('inviteStatus').innerText = success ? 'Invite sent!' : 'Failed to send invite';
});