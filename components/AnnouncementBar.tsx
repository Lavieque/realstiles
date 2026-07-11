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

  return (
    <div className="announcement-bar">
      <div className="announcement-track">
        {itens.map((item) => (
          <div key={item.id} className="announcement-item">
            {item.icone && ICONES[item.icone] && (
              <span
                className="announcement-icon"
                dangerouslySetInnerHTML={{ __html: ICONES[item.icone].svg }}
              />
            )}
            <div className="announcement-item-text">
              <span className="announcement-item-title">{item.texto}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
