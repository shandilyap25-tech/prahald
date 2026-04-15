require('dotenv').config();

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || 'AIzaSyBKHHoyPR5Sh3jNRQfYARKGs9KWRLdcFVA';

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static('public'));
app.use(express.json());

const rooms = {};

function getSpeechLanguageCode(lang) {
  return lang === 'hi' ? 'hi-IN' : 'en-US';
}

async function recognizeSpeech(audioBase64, sourceLang) {
  const url = `https://speech.googleapis.com/v1/speech:recognize?key=${GOOGLE_API_KEY}`;
  const body = {
    config: {
      encoding: 'WEBM_OPUS',
      sampleRateHertz: 48000,
      languageCode: getSpeechLanguageCode(sourceLang),
      enableAutomaticPunctuation: true,
      audioChannelCount: 1
    },
    audio: {
      content: audioBase64
    }
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await response.json();

  if (!data || !data.results || data.results.length === 0) {
    return '';
  }

  return data.results.map(result => result.alternatives[0].transcript).join(' ');
}

async function translateText(text, targetLang) {
  const url = `https://translation.googleapis.com/language/translate/v2?key=${GOOGLE_API_KEY}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ q: text, target: targetLang, format: 'text' })
  });
  const data = await response.json();

  if (!data || !data.data || !data.data.translations || data.data.translations.length === 0) {
    return text;
  }

  return data.data.translations[0].translatedText;
}

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('createRoom', () => {
    const roomCode = Math.random().toString(36).substring(2, 10);
    rooms[roomCode] = rooms[roomCode] || [];
    rooms[roomCode].push(socket);
    socket.join(roomCode);
    socket.emit('roomCreated', roomCode);
  });

  socket.on('joinRoom', (roomCode) => {
    const room = rooms[roomCode];
    if (!room || room.length === 0) {
      socket.emit('errorMessage', 'Room not found. Create a new room or use an existing code.');
      return;
    }
    if (room.length >= 2) {
      socket.emit('errorMessage', 'Room is full. Use a different code.');
      return;
    }
    room.push(socket);
    socket.join(roomCode);
    socket.emit('roomJoined', roomCode);
    io.to(roomCode).emit('ready', roomCode);
  });

  socket.on('signal', (data) => {
    if (data.room) {
      socket.to(data.room).emit('signal', data);
    }
  });

  socket.on('translateAudio', async (payload) => {
    try {
      const transcript = await recognizeSpeech(payload.audio, payload.sourceLang);
      const translated = transcript ? await translateText(transcript, payload.targetLang) : '';

      socket.to(payload.room).emit('translatedSpeech', {
        original: transcript,
        text: translated,
        sourceLang: payload.sourceLang,
        targetLang: payload.targetLang
      });
    } catch (error) {
      console.error('Translation pipeline error:', error);
    }
  });

  socket.on('sendInvite', (email, roomCode) => {
    console.log(`Invite requested for ${email} to room ${roomCode}`);
    socket.emit('inviteSent', true);
  });

  socket.on('disconnect', () => {
    Object.keys(rooms).forEach((roomCode) => {
      rooms[roomCode] = rooms[roomCode].filter(client => client !== socket);
      if (rooms[roomCode].length === 0) {
        delete rooms[roomCode];
      }
    });
    console.log('User disconnected:', socket.id);
  });
});

server.listen(process.env.PORT || 3001, () => {
  console.log('Server running on port', process.env.PORT || 3001);
});