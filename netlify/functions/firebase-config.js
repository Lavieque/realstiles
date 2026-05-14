// Devolve a configuração Firebase a partir das variáveis de ambiente Netlify
exports.handler = async () => {
  const config = {
    apiKey:            process.env.FIREBASE_API_KEY,
    authDomain:        process.env.FIREBASE_AUTH_DOMAIN,
    projectId:         process.env.FIREBASE_PROJECT_ID,
    storageBucket:     process.env.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
    appId:             process.env.FIREBASE_APP_ID,
  };

  // Verificar que todas as variáveis estão definidas
  const emFalta = Object.entries(config).filter(([, v]) => !v).map(([k]) => k);
  if (emFalta.length) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: `Variáveis em falta: ${emFalta.join(', ')}` })
    };
  }

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600', // cache 1h — a config raramente muda
    },
    body: JSON.stringify(config)
  };
};
