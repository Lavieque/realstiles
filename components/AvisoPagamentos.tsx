'use client';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { getConfig } from '@/lib/config-site';

interface Props {
  ativo: boolean;
  texto: string;
}

export default function AvisoPagamentos(props: Props) {
  const pathname = usePathname();
  const [aviso, setAviso] = useState(props);

  // Páginas estáticas trazem a config do build — refresca com o valor actual do Firestore
  useEffect(() => {
    getConfig()
      .then(c => setAviso({ ativo: c.aviso_ativo, texto: c.aviso_texto }))
      .catch(() => {});
  }, []);

  const mensagens = (aviso.texto || '').split('\n').map(m => m.trim()).filter(Boolean);
  if (pathname?.startsWith('/admin') || !aviso.ativo || !mensagens.length) return null;

  // Conteúdo duplicado para o loop contínuo do marquee
  const itens = [...mensagens, ...mensagens];

  return (
    <div className="aviso-pagamentos" role="status" aria-label={mensagens.join('. ')}>
      <div className="aviso-pagamentos-track" aria-hidden="true">
        {[0, 1].map(bloco => (
          <div key={bloco} className="aviso-pagamentos-bloco">
            {itens.map((msg, i) => (
              <span key={i} className="aviso-pagamentos-item">⚠ {msg}</span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
