create schema if not exists grocery_private;
revoke all on schema grocery_private from public;
grant usage on schema grocery_private to authenticated;

create table public.grocery_households (
 id uuid primary key default gen_random_uuid(),
 name text not null check (length(trim(name)) between 1 and 100)
);
create table grocery_private.members (
 household_id uuid references public.grocery_households on delete cascade,
 user_id uuid references auth.users on delete cascade,
 display_name text not null,
 owner boolean not null default false,
 primary key (household_id,user_id)
);
create index grocery_member_user on grocery_private.members(user_id);
create table grocery_private.invites (
 household_id uuid primary key references public.grocery_households on delete cascade,
 token uuid not null unique default gen_random_uuid(),
 expires_at timestamptz not null default now()+interval '7 days'
);
create table public.grocery_records (
 household_id uuid not null references public.grocery_households on delete cascade,
 id uuid not null,
 kind text not null check(kind in ('item','product','purchase','settings','alias')),
 data jsonb not null check(jsonb_typeof(data)='object'),
 deleted boolean not null default false,
 version integer not null check(version>0),
 primary key(household_id,id)
);
create unique index grocery_receipt_key on public.grocery_records(household_id,(data->>'receiptKey'))
 where kind='purchase' and not deleted and data->>'receiptKey' is not null;
create unique index grocery_receipt_fingerprint on public.grocery_records(household_id,(data->>'fingerprint'))
 where kind='purchase' and not deleted and data->>'fingerprint' is not null;
create table grocery_private.applied_batches (
 household_id uuid references public.grocery_households on delete cascade,
 id uuid,
 user_id uuid not null,
 rows jsonb not null,
 primary key(household_id,id)
);
alter table public.grocery_households enable row level security;
alter table public.grocery_records enable row level security;
alter table grocery_private.members enable row level security;
alter table grocery_private.invites enable row level security;
alter table grocery_private.applied_batches enable row level security;

create function grocery_private.is_member(house uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from grocery_private.members where household_id=house and user_id=(select auth.uid()));
$$;
create policy grocery_house_read on public.grocery_households for select to authenticated using(grocery_private.is_member(id));
create policy grocery_record_read on public.grocery_records for select to authenticated using(grocery_private.is_member(household_id));
revoke all on public.grocery_households,public.grocery_records from anon,authenticated;
grant select on public.grocery_households,public.grocery_records to authenticated;

create function grocery_private.create_house(house_name text) returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); house uuid;
begin
 if actor is null then raise insufficient_privilege; end if;
 insert into public.grocery_households(name) values(trim(house_name)) returning id into house;
 insert into grocery_private.members values(house,actor,coalesce(auth.jwt()->>'email','Participante'),true);
 return house;
end $$;
create function grocery_private.join_house(invite_code uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); house uuid;
begin
 if actor is null then raise insufficient_privilege; end if;
 select household_id into house from grocery_private.invites where token=invite_code and expires_at>now() for update;
 if not found then raise exception 'Convite inválido, revogado ou expirado.'; end if;
 insert into grocery_private.members values(house,actor,coalesce(auth.jwt()->>'email','Participante'),false) on conflict do nothing;
 return house;
end $$;
create function grocery_private.manage_house(house uuid, action text, target uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); administrator boolean; result jsonb;
begin
 perform 1 from public.grocery_households where id=house for update;
 select owner into administrator from grocery_private.members where household_id=house and user_id=actor;
 if not found then raise insufficient_privilege; end if;
 if action='list' then
  select jsonb_build_object('owner',administrator,'members',coalesce(jsonb_agg(jsonb_build_object('id',user_id,'name',split_part(display_name,'@',1),'owner',owner) order by owner desc,display_name),'[]'))
   into result from grocery_private.members where household_id=house;
  return result;
 end if;
 if not administrator then raise insufficient_privilege; end if;
 case action
 when 'invite' then
  insert into grocery_private.invites(household_id) values(house)
   on conflict(household_id) do update set token=excluded.token,expires_at=excluded.expires_at
   returning jsonb_build_object('code',token,'expires',expires_at) into result;
 when 'revoke' then delete from grocery_private.invites where household_id=house;
 when 'remove' then delete from grocery_private.members where household_id=house and user_id=target and not owner;
 else raise exception 'Ação inválida.';
 end case;
 return coalesce(result,'{}');
end $$;

create function grocery_private.apply_batch(house uuid, operation uuid, edits jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); result jsonb; edit record; saved public.grocery_records; saved_rows jsonb:='[]';
begin
 perform 1 from public.grocery_households where id=house for update;
 if actor is null or not grocery_private.is_member(house) then raise insufficient_privilege; end if;
 select rows into result from grocery_private.applied_batches where household_id=house and id=operation and user_id=actor;
 if found then return result; end if;
 if jsonb_typeof(edits) is distinct from 'array' or jsonb_array_length(edits) not between 1 and 1000 then raise exception 'Lote inválido.'; end if;
 for edit in select * from jsonb_to_recordset(edits) as x(id uuid,kind text,data jsonb,deleted boolean,version integer)
 loop
  if edit.version=0 then
   insert into public.grocery_records(household_id,id,kind,data,deleted,version)
   values(house,edit.id,edit.kind,
    case when edit.kind='item' then edit.data||jsonb_build_object('requesterId',actor) else edit.data end,
    edit.deleted,1)
   on conflict(household_id,id) do nothing returning * into saved;
  else
   update public.grocery_records r set
    data=case when r.kind='item' then edit.data||jsonb_build_object('requesterId',r.data->'requesterId','requester',r.data->'requester') else edit.data end,
    deleted=edit.deleted,version=r.version+1
   where r.household_id=house and r.id=edit.id and r.version=edit.version and r.kind=edit.kind returning r.* into saved;
  end if;
  if not found then raise sqlstate 'PT409' using message='Registro alterado em outro aparelho.'; end if;
  saved_rows:=saved_rows||jsonb_build_array(to_jsonb(saved));
 end loop;
 insert into grocery_private.applied_batches values(house,operation,actor,saved_rows);
 return saved_rows;
end $$;
revoke execute on all functions in schema grocery_private from public,anon;
grant execute on all functions in schema grocery_private to authenticated;

create function public.grocery_create_house(house_name text) returns uuid language sql set search_path='' as $$
 select grocery_private.create_house(house_name);
$$;
create function public.grocery_join_house(invite_code uuid) returns uuid language sql set search_path='' as $$
 select grocery_private.join_house(invite_code);
$$;
create function public.grocery_manage_house(house uuid,action text,target uuid default null) returns jsonb language sql set search_path='' as $$
 select grocery_private.manage_house(house,action,target);
$$;
create function public.grocery_apply_batch(house uuid,operation uuid,edits jsonb) returns jsonb language sql set search_path='' as $$
 select grocery_private.apply_batch(house,operation,edits);
$$;
revoke execute on function public.grocery_create_house(text),public.grocery_join_house(uuid),public.grocery_manage_house(uuid,text,uuid),public.grocery_apply_batch(uuid,uuid,jsonb) from public,anon;
grant execute on function public.grocery_create_house(text),public.grocery_join_house(uuid),public.grocery_manage_house(uuid,text,uuid),public.grocery_apply_batch(uuid,uuid,jsonb) to authenticated;
alter publication supabase_realtime add table public.grocery_records;
