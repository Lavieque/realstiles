'use client';
import { useEffect, useState } from 'react';
import Image from '@/components/CloudImage';
import { getConfig, saveConfig, DEFAULTS } from '@/lib/config-site';
import { uploadParaCloudinary } from '@/lib/cloudinary';
import { mostrarToast } from '@/components/Toast';
import type { SiteConfig } from '@/lib/config-site';

export default function AdminConteudoPage() {
  const [config, setConfig] = useState<SiteConfig>({ ...DEFAULTS });
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [uploadPct, setUploadPct] = useState<{ [k: string]: number }>({});

  const handleFotoUpload = (campo: 'qs_membro1_foto' | 'qs_membro2_foto') => async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadPct(p => ({ ...p, [campo]: 0 }));
    try {
      const url = await uploadParaCloudinary(file, pct => setUploadPct(p => ({ ...p, [campo]: pct })));
      setConfig(c => ({ ...c, [campo]: url }));
    } catch {
      mostrarToast('Erro no upload', 'error');
    } finally {
      setUploadPct(p => { const resto = { ...p }; delete resto[campo]; return resto; });
    }
  };

  useEffect(() => {
    getConfig().then(c => { setConfig(c); setLoading(false); });
  }, []);

  const f = (k: keyof SiteConfig) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setConfig(c => ({ ...c, [k]: e.target.value }));

  const removerMembro = (n: '1' | '2') => {
    if (!confirm(`Remover o Membro ${n}?`)) return;
    setConfig(c => ({
      ...c,
      [`qs_membro${n}_nome`]: '',
      [`qs_membro${n}_cargo`]: '',
      [`qs_membro${n}_foto`]: '',
      [`qs_membro${n}_bio`]: '',
    }));
  };

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
          <h2>Quem Somos — Equipa</h2>
          <p style={{ fontSize: 13, color: 'var(--gray-500)', marginBottom: 16 }}>
            O bloco só aparece na página se pelo menos um membro tiver nome preenchido.
          </p>
          <div className="form-group"><label>Título da secção</label><input value={config.qs_equipa_titulo} onChange={f('qs_equipa_titulo')} /></div>
          <div className="form-grid-2">
            {(['1', '2'] as const).map(n => {
              const campoFoto = `qs_membro${n}_foto` as 'qs_membro1_foto' | 'qs_membro2_foto';
              const temDados = !!(config[`qs_membro${n}_nome` as const] || config[`qs_membro${n}_cargo` as const] || config[campoFoto] || config[`qs_membro${n}_bio` as const]);
              return (
                <div key={n} style={{ border: '1px solid var(--gray-200)', borderRadius: 12, padding: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                    <p style={{ fontWeight: 600, fontSize: 13 }}>Membro {n}</p>
                    {temDados && (
                      <button type="button" className="btn btn-outline btn-sm" style={{ color: 'var(--red)', borderColor: 'var(--red)', padding: '3px 10px', fontSize: 12 }} onClick={() => removerMembro(n)}>
                        Remover
                      </button>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
                    <div style={{ width: 64, height: 64, borderRadius: '50%', overflow: 'hidden', background: 'var(--gray-100)', position: 'relative', flexShrink: 0, border: '1px solid var(--gray-200)' }}>
                      {config[campoFoto] && <Image src={config[campoFoto]} alt="" fill style={{ objectFit: 'cover' }} sizes="64px" />}
                    </div>
                    <div>
                      <label className="btn btn-outline btn-sm" style={{ cursor: 'pointer', display: 'inline-block' }}>
                        {config[campoFoto] ? 'Trocar foto' : 'Escolher foto'}
                        <input type="file" accept="image/*" onChange={handleFotoUpload(campoFoto)} style={{ display: 'none' }} />
                      </label>
                      {uploadPct[campoFoto] !== undefined && <p style={{ fontSize: 11, color: 'var(--gray-500)', marginTop: 6 }}>A enviar... {uploadPct[campoFoto]}%</p>}
                    </div>
                  </div>
                  <div className="form-grid-2">
                    <div className="form-group"><label>Nome</label><input value={config[`qs_membro${n}_nome` as const]} onChange={f(`qs_membro${n}_nome` as const)} /></div>
                    <div className="form-group"><label>Cargo</label><input value={config[`qs_membro${n}_cargo` as const]} onChange={f(`qs_membro${n}_cargo` as const)} /></div>
                  </div>
                  <div className="form-group"><label>Bio (opcional)</label><textarea value={config[`qs_membro${n}_bio` as const]} onChange={f(`qs_membro${n}_bio` as const)} /></div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="form-card">
          <h2>Dados de Fatura / Recibo</h2>
          <div className="form-group"><label>Nome da empresa</label><input value={config.empresa_nome} onChange={f('empresa_nome')} /></div>
          <div className="form-grid-2">
            <div className="form-group"><label>NUIT</label><input value={config.empresa_nif} onChange={f('empresa_nif')} placeholder="Ex: 400123456" /></div>
            <div className="form-group"><label>Email de faturação</label><input value={config.empresa_email} onChange={f('empresa_email')} placeholder="faturacao@..." /></div>
          </div>
          <div className="form-group">
            <label>Morada</label>
            <input value={config.empresa_morada} onChange={f('empresa_morada')} />
            <p style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 4 }}>Esta morada (+ cidade) também define o mapa da secção "Onde Estamos" em Quem Somos.</p>
          </div>
          <div className="form-group"><label>Cidade / País</label><input value={config.empresa_cidade} onChange={f('empresa_cidade')} /></div>
          <div className="form-group"><label>Condições de entrega (aparece no recibo)</label><input value={config.fatura_condicoes} onChange={f('fatura_condicoes')} /></div>
          <div className="form-group"><label>Observações (aparece no recibo)</label><textarea value={config.fatura_obs} onChange={f('fatura_obs')} /></div>
        </div>

        <div className="form-card">
          <h2>Quem Somos — Localização</h2>
          <div className="form-group"><label>Título da secção</label><input value={config.qs_localizacao_titulo} onChange={f('qs_localizacao_titulo')} /></div>
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
