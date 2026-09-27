'use client';
import { useState } from 'react';
import { X } from 'lucide-react';
import { uploadParaCloudinary } from '@/lib/cloudinary';
import { mostrarToast } from '@/components/Toast';

// Limite do plano gratuito do Cloudinary para vídeos
const MAX_MB = 100;

// Campo de vídeo do produto (admin): upload para o Cloudinary, pré-visualização e remoção
export default function CampoVideo({ valor, onChange }: { valor?: string | null; onChange: (url: string | null) => void }) {
  const [pct, setPct] = useState<number | null>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('video/')) { mostrarToast('Escolhe um ficheiro de vídeo', 'error'); return; }
    if (file.size > MAX_MB * 1024 * 1024) { mostrarToast(`Vídeo demasiado grande (máx. ${MAX_MB} MB)`, 'error'); return; }
    setPct(0);
    try {
      onChange(await uploadParaCloudinary(file, setPct));
    } catch {
      mostrarToast('Erro no upload do vídeo', 'error');
    } finally {
      setPct(null);
    }
  };

  return (
    <div>
      {valor ? (
        <div style={{ position: 'relative', maxWidth: 320 }}>
          <video src={valor} controls playsInline preload="metadata" style={{ width: '100%', borderRadius: 10, background: '#000', display: 'block' }} />
          <button type="button" className="img-preview-remove" onClick={() => onChange(null)} title="Remover vídeo">
            <X size={12} strokeWidth={1.5} />
          </button>
        </div>
      ) : (
        <input type="file" accept="video/*" onChange={handleUpload} disabled={pct !== null} />
      )}
      {pct !== null && (
        <div style={{ background: 'var(--gray-200)', borderRadius: 4, marginTop: 12, height: 4 }}>
          <div style={{ background: 'var(--black)', height: 4, borderRadius: 4, width: `${pct}%`, transition: 'width 0.3s' }} />
        </div>
      )}
      <p style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 6 }}>Opcional · 1 vídeo · máx. {MAX_MB} MB · aparece na galeria depois das imagens</p>
    </div>
  );
}
