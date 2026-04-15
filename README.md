# Real-Time AI Language Translator for Voice/Video Calls

This is a real-time AI-powered communication system that allows two users to speak in different languages (Hindi and English) while understanding each other instantly during a live call.

## Features

- Real-time speech-to-text conversion
- Language translation (Hindi to English)
- Text-to-speech synthesis
- Subtitles display
- Audio capture and playback

## Tech Stack

- Frontend: HTML, CSS, JavaScript
- Backend: Node.js with Express and Socket.io
- AI Services: Google Cloud Speech-to-Text, Translate, Text-to-Speech

## Setup

1. Install dependencies: `npm install`
2. Start the server: `npm start`
3. Open `http://localhost:3001` in your browser

## Usage

1. Click "Join/Create Call" to create a new call or join with a code
2. Share the generated call code with others
3. Enter email to send invite link
4. Speak in Hindi, and the system will translate to English for the other participant
5. Use "Mute" to toggle audio
6. "End Call" to stop

Note: For email invites, configure Gmail credentials in server.js. For phone numbers, SMS integration can be added later.
