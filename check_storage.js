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

async function checkStorage() {
  console.log('Vérification du bucket de stockage...');
  try {
    const { data: buckets, error: bucketErr } = await supabase.storage.listBuckets();
    if (bucketErr) {
      console.error('Erreur listBuckets :', bucketErr);
    } else {
      console.log('Buckets trouvés :', buckets.map(b => b.name));
      const hasJustalk = buckets.some(b => b.name === 'justalk');
      if (hasJustalk) {
        console.log('Bucket "justalk" EXISTE !');
      } else {
        console.warn('ATTENTION: Le bucket "justalk" n\'existe pas !');
      }
    }

    console.log('Tentative d\'upload d\'un test...');
    const testBuffer = Buffer.from('test upload content');
    const { data, error: uploadErr } = await supabase.storage
      .from('justalk')
      .upload('test_upload_' + Date.now() + '.txt', testBuffer, {
        contentType: 'text/plain',
        duplex: 'half'
      });
      
    if (uploadErr) {
      console.error('L\'upload a ÉCHOUÉ :', uploadErr);
    } else {
      console.log('L\'upload a RÉUSSI !', data);
    }
  } catch (err) {
    console.error('Exception :', err);
  }
}

checkStorage();
