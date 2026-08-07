export interface ResourceEmbedInfo {
  previewUrl: string;
  downloadUrl: string;
  embedType: 'drive-preview' | 'office-viewer' | 'direct-pdf' | 'direct-image' | 'external';
  filename: string;
}

export function parseResourceEmbed(rawUrl: string, driveFileId?: string, title?: string): ResourceEmbedInfo {
  const url = (rawUrl || '').trim();
  const name = title || 'Resource File';

  // 1. Google Drive Links: match /file/d/<ID>/ or id=<ID>
  const driveIdMatch = url.match(/\/d\/([a-zA-Z0-9_-]+)/) || url.match(/id=([a-zA-Z0-9_-]+)/);
  const fileId = driveFileId || (driveIdMatch ? driveIdMatch[1] : null);

  if (fileId) {
    return {
      previewUrl: `https://drive.google.com/file/d/${fileId}/preview`,
      downloadUrl: `https://drive.google.com/uc?export=download&id=${fileId}`,
      embedType: 'drive-preview',
      filename: name
    };
  }

  const lower = url.toLowerCase();

  // 2. Microsoft Office Viewer (PPT, PPTX, DOC, DOCX)
  if (lower.endsWith('.pptx') || lower.endsWith('.ppt') || lower.endsWith('.docx') || lower.endsWith('.doc')) {
    return {
      previewUrl: `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`,
      downloadUrl: url,
      embedType: 'office-viewer',
      filename: name
    };
  }

  // 3. Direct Images (PNG, JPG, JPEG, WEBP, SVG)
  if (lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.webp') || lower.endsWith('.svg')) {
    return {
      previewUrl: url,
      downloadUrl: url,
      embedType: 'direct-image',
      filename: name
    };
  }

  // 4. Direct PDF
  if (lower.endsWith('.pdf')) {
    return {
      previewUrl: url,
      downloadUrl: url,
      embedType: 'direct-pdf',
      filename: name
    };
  }

  // Fallback
  return {
    previewUrl: url,
    downloadUrl: url,
    embedType: 'external',
    filename: name
  };
}
