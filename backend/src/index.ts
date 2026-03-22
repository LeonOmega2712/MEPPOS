import app from './app';

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`
  ╔═════════════════════════════════════════╗
  ║  🚀 MEPPOS API Server v1.0.0            ║
  ║  🍽️  Simplified Menu System              ║
  ║  📡 Port: ${PORT}                          ║
  ║  🌍 Environment: ${process.env.NODE_ENV || 'development'}            ║
  ║  🔗 http://localhost:${PORT}               ║
  ║  📚 API Docs: http://localhost:${PORT}/api ║
  ╚═════════════════════════════════════════╝
  `);
});
