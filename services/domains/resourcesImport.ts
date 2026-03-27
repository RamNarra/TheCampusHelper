import { authedJsonPost } from '../platform/apiClient';

export type ImportFromDriveFolderInput = {
  folderId: string;
  branch: 'CSE' | 'IT' | 'DS' | 'AIML' | 'CYS' | 'ECE' | 'EEE' | 'MECH' | 'CIVIL';
  semester: string;
  subject: string;
  type: 'PPT' | 'MidPaper' | 'PYQ' | 'ImpQ';
  maxFiles?: number;
};

export type ImportFromDriveFolderResult = {
  ok: true;
  imported: number;
  skipped: number;
  totalListed: number;
  results: Array<{
    driveFileId: string;
    title: string;
    ok: boolean;
    reason?: string;
    resourceId?: string;
  }>;
};

export const importFromDriveFolder = async (
  input: ImportFromDriveFolderInput
): Promise<ImportFromDriveFolderResult> => {
  return await authedJsonPost<ImportFromDriveFolderResult>('/api/resources/importFromDriveFolder', input, {
    timeoutMs: 30000,
  });
};
