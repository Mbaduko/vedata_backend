import config from './config';
import app from './app';

const server = app.listen(config.port, () => {
  console.log(`\n🚀 Vedata API running in ${config.env} mode on port ${config.port}`);
  console.log(`   Health check: http://localhost:${config.port}/health`);
  console.log(`   API base:     http://localhost:${config.port}/api/v1\n`);
});

// Handle unhandled rejections
process.on('unhandledRejection', (err: Error) => {
  console.error('💥 UNHANDLED REJECTION:', err);
  server.close(() => process.exit(1));
});

// Handle uncaught exceptions
process.on('uncaughtException', (err: Error) => {
  console.error('💥 UNCAUGHT EXCEPTION:', err);
  server.close(() => process.exit(1));
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    console.log('Process terminated.');
  });
});

export default server;
