const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const os = require('os');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Helper to get local network IP address
const getLocalIp = () => {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // Check for IPv4 and make sure it's not a loopback interface
      if ((iface.family === 'IPv4' || iface.family === 4) && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
};

// Serve static files from Vite's production build
app.use(express.static(path.join(__dirname, 'dist')));

// Fallback all routes to index.html for React router
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// WebSocket Server
wss.on('connection', (ws) => {
  console.log('נוצר חיבור חדש למערכת הסינכרון!');

  ws.on('message', (message) => {
    // Broadcast received message to all other connected clients
    const dataStr = message.toString();
    wss.clients.forEach((client) => {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(dataStr);
      }
    });
  });

  ws.on('close', () => {
    console.log('חיבור נסגר במערכת הסינכרון');
  });
});

const PORT = process.env.PORT || 5175;
const localIp = getLocalIp();

server.listen(PORT, '0.0.0.0', () => {
  console.log('==================================================');
  console.log(`🚀 שרת הסינכרון פועל בהצלחה בפורט ${PORT}!`);
  console.log(`💻 למסך ההקרנה (במחשב): http://localhost:${PORT}/?mode=game`);
  console.log(`📱 לשלט הבקרה (בטלפון - חובה להיות באותו ה-Wi-Fi):`);
  console.log(`   http://${localIp}:${PORT}/?mode=admin`);
  console.log('==================================================');
});
