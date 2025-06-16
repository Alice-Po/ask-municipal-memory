import fs from 'fs';
import path from 'path';

const baseDir = path.resolve('public/datas');

function fixNamesInDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      fixNamesInDir(fullPath);
    } else if (entry.isFile() && entry.name.endsWith('.pdf')) {
      let newName = entry.name.replace(/\s+/g, '-');
      newName = newName.replace(/[éè]/g, 'e');
      newName = newName.toLowerCase();
      if (newName !== entry.name) {
        const newPath = path.join(dir, newName);
        fs.renameSync(fullPath, newPath);
        console.log(`Renamed: ${fullPath} -> ${newPath}`);
      }
    }
  }
}

fixNamesInDir(baseDir);
