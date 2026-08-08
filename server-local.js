const express = require('express');
const path = require('path');
const os = require('os');
const localApi = require('./api/local');

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '3mb' }));
app.use('/api', localApi);
app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';

function networkUrls() {
  const urls = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const item of list || []) {
      if (item.family === 'IPv4' && !item.internal) urls.push(`http://${item.address}:${PORT}`);
    }
  }
  return urls;
}

app.listen(PORT, HOST, () => {
  console.log(`Mercês Garcia local: http://localhost:${PORT}`);
  if (HOST === '0.0.0.0') {
    console.log('Acesso pela rede local:');
    for (const url of networkUrls()) console.log(`  ${url}`);
    if (!networkUrls().length) console.log('  Nenhum endereço IPv4 de rede foi encontrado.');
  }
  console.log('Banco: data/merces-garcia.sqlite');
});
