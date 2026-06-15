const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach((line) => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] ? match[2].trim() : '';
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.substring(1, value.length - 1);
    }
    env[match[1]] = value;
  }
});

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(url, key);

async function main() {
  console.log('Tentative de création du bucket "justalk"...');
  try {
    const { data, error } = await supabase.storage.createBucket('justalk', {
      public: true,
      allowedMimeTypes: ['image/*', 'audio/*', 'video/*'],
      fileSizeLimit: 10485760 // 10MB
    });
    if (error) {
      console.error('Erreur lors de la création du bucket :', error);
    } else {
      console.log('Succès ! Bucket créé :', data);
    }
  } catch (err) {
    console.error('Exception :', err);
  }
}

main();
