import http from 'http';
import app from './app';
import { env } from './config/env';
import { initializeSocket } from './socket';

const server = http.createServer(app);

// Initialize Socket.IO
initializeSocket(server);

server.listen(env.PORT, () => {
  console.log('');
  console.log('  ╔═══════════════════════════════════════╗');
  console.log('  ║   🖨️  SmartPrint Backend Server        ║');
  console.log(`  ║   Running on port ${env.PORT}               ║`);
  console.log('  ║   Socket.IO: ✓ Ready                  ║');
  console.log('  ║   Queue:     ✓ Active                  ║');
  console.log('  ╚═══════════════════════════════════════╝');
  console.log('');
  console.log(`  API:    http://localhost:${env.PORT}/api`);
  console.log(`  Health: http://localhost:${env.PORT}/api/health`);
  console.log('');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n[Server] Shutting down gracefully...');
  server.close(() => {
    console.log('[Server] Closed.');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  server.close(() => process.exit(0));
});
