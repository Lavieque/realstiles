'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

const CHAVE = 'cs_cookies_aceites';

export default function CookieConsent({ texto }: { texto: string }) {
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(CHAVE)) setVisivel(true);
    } catch { /* localStorage indisponível — não mostra o banner */ }
  }, []);

  const aceitar = () => {
    try { localStorage.setItem(CHAVE, '1'); } catch { /* ignora */ }
    setVisivel(false);
  };

  if (!visivel) return null;

  return (
    <div className="cookie-consent">
      <p>
        {texto} <Link href="/politicas">Saber mais</Link>
      </p>
      <button className="btn btn-primary btn-sm" onClick={aceitar}>Aceitar</button>
    </div>
  );
}
