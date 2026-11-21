const express = require('express');
const cors = require('cors');
const path = require('path');
const apiRoutes = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static frontend assets
app.use(express.static(path.join(__dirname, '../public')));

// API Routes
app.use('/api', apiRoutes);

// Fallback for SPA (Catch-all for client-side routing)
app.use((req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Start server
function startServer() {
  return new Promise((resolve, reject) => {
    try {
      const server = app.listen(PORT, () => {
        console.log(`====================================================`);
        console.log(`  Symbol Table Generator & Analyzer`);
        console.log(`  Server running at: http://localhost:${PORT}`);
        console.log(`====================================================`);
        resolve(server);
      });
      server.on('error', reject);
    } catch (err) {
      console.error('[Server] Failed to start server:', err);
      reject(err);
    }
  });
}

if (require.main === module) {
  startServer().catch((err) => {
    console.error('[Server] Startup error:', err);
    process.exit(1);
  });
}

module.exports = { app, startServer };
