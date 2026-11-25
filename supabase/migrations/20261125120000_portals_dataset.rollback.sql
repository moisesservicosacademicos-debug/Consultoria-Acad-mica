-- Reverte 20261125120000_portals_dataset.sql (os registros de "portals" continuam na base, só deixam de aceitar gravação).
do $mig$
declare
  d text := pg_get_functiondef('public.consultoria_workspace_mutate_v496'::regproc);
begin
  if position($q$,'portals'$q$ in d) = 0 then return; end if;
  execute replace(d, $q$'financeEntries','whatsappManualHistory','portals'$q$, $q$'financeEntries','whatsappManualHistory'$q$);
end
$mig$;
