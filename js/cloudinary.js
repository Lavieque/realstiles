// Upload de ficheiros para Cloudinary via assinatura segura do backend
// Suporta imagens (JPG, PNG, WebP, GIF) e vídeos (MP4, MOV, etc.)

export async function uploadParaCloudinary(file, onProgress = null) {
  // 1. Pedir assinatura ao backend (API secret fica no servidor)
  const sigRes = await fetch('/.netlify/functions/cloudinary-sign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });
  if (!sigRes.ok) throw new Error('Erro ao obter assinatura de upload');
  const { signature, timestamp, folder, cloud_name, api_key } = await sigRes.json();

  // 2. Upload direto para Cloudinary com a assinatura
  const resourceType = file.type.startsWith('video/') ? 'video' : 'image';
  const formData = new FormData();
  formData.append('file', file);
  formData.append('api_key', api_key);
  formData.append('timestamp', String(timestamp));
  formData.append('signature', signature);
  formData.append('folder', folder);

  // Usar XMLHttpRequest para suportar progresso
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${cloud_name}/${resourceType}/upload`);

    if (onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const data = JSON.parse(xhr.responseText);
        resolve(data.secure_url);
      } else {
        const err = JSON.parse(xhr.responseText || '{}');
        reject(new Error(err.error?.message || 'Erro no upload para Cloudinary'));
      }
    };

    xhr.onerror = () => reject(new Error('Erro de rede no upload'));
    xhr.send(formData);
  });
}
