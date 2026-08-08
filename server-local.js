const express = require('express');
const path = require('path');
const localApi = require('./api/local');

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '3mb' }));
app.use('/api', localApi);
app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

const PORT = Number(process.env.PORT || 3000);
app.listen(PORT, '127.0.0.1', () => {
  console.log(`Mercês Garcia local: http://localhost:${PORT}`);
  console.log('Banco: data/merces-garcia.sqlite');
});
