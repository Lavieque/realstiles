export async function uploadParaCloudinary(
  file: File,
  onProgress?: (pct: number) => void
): Promise<string> {
  const sigRes = await fetch('/api/cloudinary-sign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });
  if (!sigRes.ok) throw new Error('Erro ao obter assinatura de upload');
  const { signature, timestamp, folder, cloud_name, api_key } = await sigRes.json();

  const resourceType = file.type.startsWith('video/') ? 'video' : 'image';
  const formData = new FormData();
  formData.append('file', file);
  formData.append('api_key', api_key);
  formData.append('timestamp', String(timestamp));
  formData.append('signature', signature);
  formData.append('folder', folder);

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
        resolve(JSON.parse(xhr.responseText).secure_url);
      } else {
        const err = JSON.parse(xhr.responseText || '{}');
        reject(new Error(err.error?.message || 'Erro no upload para Cloudinary'));
      }
    };
    xhr.onerror = () => reject(new Error('Erro de rede no upload'));
    xhr.send(formData);
  });
}
