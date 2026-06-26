'use client';
import { useEffect, useState } from 'react';
import { getConfig, saveConfig, DEFAULTS } from '@/lib/config-site';
import { mostrarToast } from '@/components/Toast';
import type { SiteConfig } from '@/lib/config-site';

export default function AdminConteudoPage() {
  const [config, setConfig] = useState<SiteConfig>({ ...DEFAULTS });
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    getConfig().then(c => { setConfig(c); setLoading(false); });
  }, []);

  const f = (k: keyof SiteConfig) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setConfig(c => ({ ...c, [k]: e.target.value }));

  const salvar = async () => {
    setSalvando(true);
    try {
      await saveConfig(config);
      mostrarToast('Conteúdo guardado!', 'success');
    } catch {
      mostrarToast('Erro ao guardar', 'error');
    } finally {
      setSalvando(false);
    }
  };

  if (loading) return <div className="loading"><div className="spinner" /></div>;

  return (
    <>
      <div className="admin-topbar">
        <h1>Conteúdo do site</h1>
        <button className="btn btn-primary btn-sm" onClick={salvar} disabled={salvando}>{salvando ? 'A guardar...' : 'Guardar tudo'}</button>
      </div>
      <div className="admin-content" style={{ maxWidth: 760 }}>
        <div className="form-card">
          <h2>Página inicial — Hero</h2>
          <div className="form-group"><label>Título</label><input value={config.hero_titulo} onChange={f('hero_titulo')} /></div>
          <div className="form-group"><label>Subtítulo</label><textarea value={config.hero_subtitulo} onChange={f('hero_subtitulo')} /></div>
          <div className="form-group"><label>Texto do botão</label><input value={config.hero_btn} onChange={f('hero_btn')} /></div>
        </div>

        <div className="form-card">
          <h2>Quem Somos</h2>
          <div className="form-group"><label>Título</label><input value={config.qs_sobre_titulo} onChange={f('qs_sobre_titulo')} /></div>
          <div className="form-group"><label>Parágrafo 1</label><textarea value={config.qs_sobre_texto1} onChange={f('qs_sobre_texto1')} /></div>
          <div className="form-group"><label>Parágrafo 2</label><textarea value={config.qs_sobre_texto2} onChange={f('qs_sobre_texto2')} /></div>
          <div className="form-group"><label>CTA Título</label><input value={config.qs_cta_titulo} onChange={f('qs_cta_titulo')} /></div>
          <div className="form-group"><label>CTA Subtítulo</label><input value={config.qs_cta_subtitulo} onChange={f('qs_cta_subtitulo')} /></div>
        </div>

        <div className="form-card">
          <h2>Contactos e Rodapé</h2>
          <div className="form-grid-2">
            <div className="form-group"><label>Telefone 1</label><input value={config.tel1} onChange={f('tel1')} /></div>
            <div className="form-group"><label>Telefone 2</label><input value={config.tel2} onChange={f('tel2')} /></div>
          </div>
          <div className="form-group"><label>Descrição no rodapé</label><input value={config.footer_descricao} onChange={f('footer_descricao')} /></div>
          <div className="form-group"><label>Copyright</label><input value={config.copyright} onChange={f('copyright')} /></div>
          <div className="form-group"><label>Slogan</label><input value={config.slogan} onChange={f('slogan')} /></div>
        </div>

        <div style={{ textAlign: 'right' }}>
          <button className="btn btn-primary btn-lg" onClick={salvar} disabled={salvando}>{salvando ? 'A guardar...' : 'Guardar alterações'}</button>
        </div>
      </div>
    </>
  );
}
