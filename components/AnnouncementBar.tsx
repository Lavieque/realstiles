'use client';
import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface ItemAnuncio {
  id: string;
  texto: string;
  icone?: string;
}

export default function AnnouncementBar() {
  const [itens, setItens] = useState<ItemAnuncio[]>([]);

  useEffect(() => {
    getDoc(doc(db, 'config', 'anuncios'))
      .then(snap => {
        if (snap.exists()) setItens(snap.data().itens || []);
      })
      .catch(() => {});
  }, []);

  if (!itens.length) return null;

  return (
    <div className="announcement-bar">
      <div className="announcement-track">
        {[...itens, ...itens].map((item, i) => (
          <span key={i} className="announcement-item">
            {item.icone && <span>{item.icone}</span>}
            {item.texto}
          </span>
        ))}
      </div>
    </div>
  );
}
