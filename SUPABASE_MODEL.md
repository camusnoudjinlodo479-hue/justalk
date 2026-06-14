# Modèle de données Supabase — Justalk

Pour configurer votre projet Supabase, exécutez le script SQL suivant dans le **SQL Editor** de Supabase.

## Table & Schema Definitions

```sql
-- Active UUID extension
create extension if exists "uuid-ossp";

-- 1. Table users (Contient les informations de profil et passkeys WebAuthn)
create table users (
  id uuid primary key,
  pseudo text unique not null,
  first_name text,
  last_name text,
  display_name text,
  birthdate date,
  birthdate_visibility text default 'private',
  bio text,
  avatar_url text,
  cover_url text,
  online boolean default false,
  last_seen timestamptz default now(),
  created_at text not null,
  authenticators jsonb default '[]'::jsonb,
  pattern_hash text
);

-- 2. Table biometric_hashes (Pour l'anti-doublon biométrique facial)
create table biometric_hashes (
  uid uuid primary key references users(id) on delete cascade,
  face_hash text unique not null,
  created_at text not null
);

-- 3. Table posts (Publications du fil d'actualité)
create table posts (
  id uuid primary key default uuid_generate_v4(),
  author_id uuid not null references users(id) on delete cascade,
  text text,
  image_url text,
  video_url text,
  likes integer default 0,
  comments_count integer default 0,
  shares integer default 0,
  created_at timestamptz default now()
);

-- 4. Table comments (Commentaires sous les posts)
create table comments (
  id uuid primary key default uuid_generate_v4(),
  post_id uuid not null references posts(id) on delete cascade,
  author_id uuid not null references users(id) on delete cascade,
  author text not null,
  text text not null,
  created_at timestamptz default now()
);

-- 5. Table likes (Abonnement et unicité des mentions J'aime)
create table likes (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id) on delete cascade,
  post_id uuid not null references posts(id) on delete cascade,
  created_at timestamptz default now(),
  unique(user_id, post_id)
);

-- 6. Table stories (Stories actives éphémères)
create table stories (
  id uuid primary key default uuid_generate_v4(),
  author_id uuid not null references users(id) on delete cascade,
  pseudo text not null,
  avatar_url text,
  media_url text not null,
  created_at timestamptz default now(),
  expires_at timestamptz not null
);

-- 7. Table story_views (Vues des stories enregistrées en direct)
create table story_views (
  id uuid primary key default uuid_generate_v4(),
  story_id uuid not null references stories(id) on delete cascade,
  viewer_id uuid not null references users(id) on delete cascade,
  viewer_pseudo text not null,
  viewer_avatar_url text,
  created_at timestamptz default now(),
  unique(story_id, viewer_id)
);

-- 8. Table conversations (Salons Messenger)
create table conversations (
  id uuid primary key default uuid_generate_v4(),
  members uuid[] not null,
  member_profiles jsonb not null,
  last_message text,
  unread jsonb default '{}'::jsonb,
  updated_at timestamptz default now()
);

-- 9. Table messages (Messages d'une conversation)
create table messages (
  id uuid primary key default uuid_generate_v4(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  sender_id uuid not null references users(id) on delete cascade,
  sender_pseudo text not null,
  text text not null,
  image_url text,
  audio_url text,
  created_at timestamptz default now()
);

-- 10. Table groups (Groupes / Pages d'actualités)
create table groups (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  description text,
  owner_id uuid not null references users(id) on delete cascade,
  moderators uuid[] default '{}'::uuid[],
  members uuid[] default '{}'::uuid[],
  created_at timestamptz default now()
);

-- 11. Table notifications (Alertes in-app & push)
create table notifications (
  id uuid primary key default uuid_generate_v4(),
  to_user_id uuid not null references users(id) on delete cascade,
  from_user_id uuid references users(id) on delete cascade,
  from_pseudo text not null,
  type text not null,
  message text not null,
  post_id uuid,
  read boolean default false,
  created_at timestamptz default now()
);

-- 12. Table friendships (Relations d'amitié)
create table friendships (
  id uuid primary key default uuid_generate_v4(),
  user_id_1 uuid not null references users(id) on delete cascade,
  user_id_2 uuid not null references users(id) on delete cascade,
  status text not null check (status in ('pending', 'accepted')),
  sender_id uuid not null references users(id) on delete cascade,
  created_at timestamptz default now(),
  unique(user_id_1, user_id_2)
);

-- 13. Table analytics (Vues des publications)
create table analytics (
  id uuid primary key default uuid_generate_v4(),
  post_id uuid not null references posts(id) on delete cascade,
  viewer_id uuid not null references users(id) on delete cascade,
  viewed_at timestamptz default now(),
  unique(post_id, viewer_id)
);
```

## Enable Realtime Publications

```sql
-- Activer Supabase Realtime sur les tables clés
alter publication supabase_realtime add table users, posts, comments, likes, stories, story_views, messages, conversations, notifications, friendships, analytics;
```

## Database Triggers (Compteurs & Notifications automatiques)

```sql
-- 1. Incrémenter comments_count lors d'un commentaire
create or replace function handle_comment_inserted()
returns trigger as $$
begin
  update posts set comments_count = comments_count + 1 where id = new.post_id;
  return new;
end;
$$ language plpgsql;

create trigger on_comment_inserted
  after insert on comments
  for each row execute function handle_comment_inserted();

-- 2. Décrémenter comments_count lors de la suppression d'un commentaire
create or replace function handle_comment_deleted()
returns trigger as $$
begin
  update posts set comments_count = greatest(0, comments_count - 1) where id = old.post_id;
  return old;
end;
$$ language plpgsql;

create trigger on_comment_deleted
  after delete on comments
  for each row execute function handle_comment_deleted();

-- 3. Incrémenter likes lors d'un J'aime
create or replace function handle_like_inserted()
returns trigger as $$
begin
  update posts set likes = likes + 1 where id = new.post_id;
  return new;
end;
$$ language plpgsql;

create trigger on_like_inserted
  after insert on likes
  for each row execute function handle_like_inserted();

-- 4. Décrémenter likes lors du retrait d'un J'aime
create or replace function handle_like_deleted()
returns trigger as $$
begin
  update posts set likes = greatest(0, likes - 1) where id = old.post_id;
  return old;
end;
$$ language plpgsql;

create trigger on_like_deleted
  after delete on likes
  for each row execute function handle_like_deleted();

-- 5. Notification automatique sur nouveau commentaire
create or replace function handle_comment_notification()
returns trigger as $$
declare
  post_author_id uuid;
begin
  select author_id into post_author_id from posts where id = new.post_id;
  if post_author_id <> new.author_id then
    insert into notifications (to_user_id, from_pseudo, type, message, post_id)
    values (post_author_id, new.author, 'comment', 'a commenté ta publication', new.post_id);
  end if;
  return new;
end;
$$ language plpgsql;

create trigger on_comment_notify
  after insert on comments
  for each row execute function handle_comment_notification();

-- 6. Notification automatique sur nouveau like
create or replace function handle_like_notification()
returns trigger as $$
declare
  post_author_id uuid;
  user_pseudo text;
begin
  select author_id into post_author_id from posts where id = new.post_id;
  select pseudo into user_pseudo from users where id = new.user_id;
  if post_author_id <> new.user_id then
    insert into notifications (to_user_id, from_pseudo, type, message, post_id)
    values (post_author_id, coalesce(user_pseudo, 'Quelqu''un'), 'like', 'a aimé ta publication', new.post_id);
  end if;
  return new;
end;
$$ language plpgsql;

create trigger on_like_notify
  after insert on likes
  for each row execute function handle_like_notification();
```

## Storage Configuration (Supabase Storage)

To configure the storage bucket `justalk` and allow users (even unauthenticated or with anonymous keys) to upload, update, view, and delete media files, execute the following SQL script in the **SQL Editor** of Supabase:

```sql
-- 1. Create the bucket 'justalk' if it does not exist
insert into storage.buckets (id, name, public)
values ('justalk', 'justalk', true)
on conflict (id) do nothing;

-- 2. Allow public read access to the 'justalk' bucket
create policy "Allow public read access"
on storage.objects for select
using (bucket_id = 'justalk');

-- 3. Allow public insert (upload) access to the 'justalk' bucket
create policy "Allow public insert access"
on storage.objects for insert
with check (bucket_id = 'justalk');

-- 4. Allow public update access to the 'justalk' bucket
create policy "Allow public update access"
on storage.objects for update
with check (bucket_id = 'justalk');

-- 5. Allow public delete access to the 'justalk' bucket
create policy "Allow public delete access"
on storage.objects for delete
using (bucket_id = 'justalk');
```

