begin;
insert into auth.users(id,email) values('11111111-1111-4111-8111-111111111111','groceries-test-1@example.invalid'),('22222222-2222-4222-8222-222222222222','groceries-test-2@example.invalid');
set local role authenticated;
do $$
declare a uuid; b uuid; item_id uuid:=gen_random_uuid(); purchase uuid:=gen_random_uuid(); operation uuid:=gen_random_uuid(); first jsonb;
begin
 perform set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
 a:=public.grocery_create_house('Teste A');
 first:=public.grocery_apply_batch(a,operation,jsonb_build_array(jsonb_build_object('id',item_id,'kind','item','deleted',false,'version',0,'data',jsonb_build_object('name','Arroz','quantity',2))));
 if first is distinct from public.grocery_apply_batch(a,operation,'[]') then raise exception 'Retry failed'; end if;
 begin
  perform public.grocery_apply_batch(a,gen_random_uuid(),jsonb_build_array(
   jsonb_build_object('id',purchase,'kind','purchase','deleted',false,'version',0,'data','{}'::jsonb),
   jsonb_build_object('id',item_id,'kind','item','deleted',true,'version',9,'data','{}'::jsonb)));
  raise exception 'Conflict missing';
 exception when sqlstate 'PT409' then null;
 end;
 if exists(select 1 from public.grocery_records where grocery_records.id=purchase) then raise exception 'Partial batch saved'; end if;
 perform set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
 b:=public.grocery_create_house('Teste B');
 if exists(select 1 from public.grocery_households where grocery_households.id=a) or exists(select 1 from public.grocery_records where household_id=a) then raise exception 'Isolation failed'; end if;
 begin
  perform public.grocery_apply_batch(a,gen_random_uuid(),'[]');
  raise exception 'Cross-house write succeeded';
 exception when insufficient_privilege then null;
 end;
end $$;
select 'isolamento, transação e repetição verificados' as result;
rollback;

