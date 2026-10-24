-- =============================================================================
-- One print-settings row, always.
--
-- The reference seed inserted a row with a generated id while the demo seeder
-- upserts the canonical id, so a project that ran both ended up with two rows.
-- The app reads `limit(1)` and updates whichever row it read, while the pricing
-- trigger reads aggregates across the table, so duplicates can silently price
-- jobs with stale values. Collapse to the canonical row and prevent recurrence.
-- =============================================================================

do $$
declare
  canonical constant uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  newest uuid;
begin
  if exists (select 1 from public.print_queue_settings where id = canonical) then
    delete from public.print_queue_settings where id <> canonical;
    return;
  end if;

  select id into newest from public.print_queue_settings order by updated_at desc limit 1;
  if newest is null then
    return;
  end if;

  update public.print_queue_settings set id = canonical where id = newest;
  delete from public.print_queue_settings where id <> canonical;
end;
$$;

create unique index if not exists print_queue_settings_single_row
  on public.print_queue_settings ((true));
