-- Run once in the Supabase SQL editor (fixes "Database error creating new user").
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id,email,full_name) values (new.id,new.email,new.raw_user_meta_data->>'full_name');
  return new;
end $$;
drop trigger if exists on_auth_user on auth.users;
create trigger on_auth_user after insert on auth.users for each row execute function public.handle_new_user();
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path = public as
$$ select exists(select 1 from public.profiles where id = auth.uid() and role='admin') $$;
