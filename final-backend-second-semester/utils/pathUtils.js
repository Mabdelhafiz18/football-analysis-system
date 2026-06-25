import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const backendDir = join(__dirname, '..');
export const rootDir = join(backendDir, '..');
export const dataDir = join(rootDir, 'data');
export const uploadsDir = join(rootDir, 'uploads');
export const aiModelsDir = join(rootDir, 'ai_models');

export default {
  backendDir,
  rootDir,
  dataDir,
  uploadsDir,
  aiModelsDir
};

