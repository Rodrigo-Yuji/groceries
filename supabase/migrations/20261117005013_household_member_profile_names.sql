create or replace function grocery_private.manage_house(house uuid, action text, target uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); administrator boolean; result jsonb;
begin
 perform 1 from public.grocery_households where id=house for update;
 select owner into administrator from grocery_private.members where household_id=house and user_id=actor;
 if not found then raise insufficient_privilege; end if;
 if action='list' then
  select jsonb_build_object(
   'owner',administrator,
   'members',coalesce(jsonb_agg(
    jsonb_build_object('id',member.user_id,'name',profile.display_name,'owner',member.owner)
    order by member.owner desc,profile.display_name,member.user_id
   ),'[]'::jsonb)
  )
  into result
  from grocery_private.members member
  join auth.users account on account.id=member.user_id
  cross join lateral (
   select coalesce(
    nullif(left(trim(account.raw_user_meta_data->>'groceries_display_name'),60),''),
    nullif(left(trim(account.raw_user_meta_data->>'full_name'),60),''),
    'Participante'
   ) as display_name
  ) profile
  where member.household_id=house;
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
