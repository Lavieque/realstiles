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
          <h2>Catálogo</h2>
          <div className="form-group"><label>Título da secção (quando nenhuma categoria está seleccionada)</label><input value={config.catalogo_titulo} onChange={f('catalogo_titulo')} /></div>
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
          <h2>Dados de Fatura / Recibo</h2>
          <div className="form-group"><label>Nome da empresa</label><input value={config.empresa_nome} onChange={f('empresa_nome')} /></div>
          <div className="form-grid-2">
            <div className="form-group"><label>NUIT</label><input value={config.empresa_nif} onChange={f('empresa_nif')} placeholder="Ex: 400123456" /></div>
            <div className="form-group"><label>Email de faturação</label><input value={config.empresa_email} onChange={f('empresa_email')} placeholder="faturacao@..." /></div>
          </div>
          <div className="form-group"><label>Morada</label><input value={config.empresa_morada} onChange={f('empresa_morada')} /></div>
          <div className="form-group"><label>Cidade / País</label><input value={config.empresa_cidade} onChange={f('empresa_cidade')} /></div>
          <div className="form-group"><label>Condições de entrega (aparece no recibo)</label><input value={config.fatura_condicoes} onChange={f('fatura_condicoes')} /></div>
          <div className="form-group"><label>Observações (aparece no recibo)</label><textarea value={config.fatura_obs} onChange={f('fatura_obs')} /></div>
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

        <div className="form-card">
          <h2>Página de Políticas</h2>
          <div className="form-group"><label>Título</label><input value={config.pol_titulo} onChange={f('pol_titulo')} /></div>
          <div className="form-group"><label>Data de actualização</label><input value={config.pol_data} onChange={f('pol_data')} /></div>
          <div className="form-group">
            <label>Conteúdo (opcional — parágrafos separados por linha em branco; se vazio, usa o texto padrão)</label>
            <textarea value={config.pol_conteudo} onChange={f('pol_conteudo')} style={{ minHeight: 160 }} />
          </div>
        </div>

        <div className="form-card">
          <h2>Livro de Reclamações</h2>
          <div className="form-group"><label>Título</label><input value={config.rec_titulo} onChange={f('rec_titulo')} /></div>
          <div className="form-group"><label>Introdução</label><textarea value={config.rec_intro} onChange={f('rec_intro')} /></div>
        </div>

        <div style={{ textAlign: 'right' }}>
          <button className="btn btn-primary btn-lg" onClick={salvar} disabled={salvando}>{salvando ? 'A guardar...' : 'Guardar alterações'}</button>
        </div>
      </div>
    </>
  );
}
