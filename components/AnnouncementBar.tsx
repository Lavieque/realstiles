'use client';
import { useEffect, useState } from 'react';
import { ICONES } from '@/lib/announcement-icons';

interface ItemAnuncio {
  id: string;
  texto: string;
  icone?: string;
}

export default function AnnouncementBar() {
  const [itens, setItens] = useState<ItemAnuncio[]>([]);

  useEffect(() => {
    fetch('/api/config/anuncios')
      .then(r => r.json())
      .then(d => setItens(d.itens || []))
      .catch(() => {});
  }, []);

  if (!itens.length) return null;

  const duplicated = [...itens, ...itens];

  return (
    <div className="announcement-bar">
      <div className="announcement-track">
        {duplicated.map((item, i) => (
          <span key={i} className="announcement-item">
            {item.icone && ICONES[item.icone] && (
              <span
                className="announcement-icon"
                dangerouslySetInnerHTML={{ __html: ICONES[item.icone].svg }}
              />
            )}
            {item.texto}
          </span>
        ))}
      </div>
    </div>
  );
}
