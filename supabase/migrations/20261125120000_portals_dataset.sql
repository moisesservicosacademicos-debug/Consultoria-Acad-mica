-- Controle de portais acadêmicos (v3.4.0)
-- Autoriza o conjunto "portals" no motor transacional oficial (consultoria_workspace_mutate_v496).
-- Alteração aditiva: nenhuma tabela, política RLS, registro ou regra existente é modificada.
-- O resto da função fica idêntico; a troca é feita sobre a própria definição atual e é idempotente.
do $mig$
declare
  d text := pg_get_functiondef('public.consultoria_workspace_mutate_v496'::regproc);
  antes constant text := $q$'financeEntries','whatsappManualHistory'$q$;
  depois constant text := $q$'financeEntries','whatsappManualHistory','portals'$q$;
begin
  if position($q$'portals'$q$ in d) > 0 then
    raise notice 'portals já autorizado; nada a fazer';
    return;
  end if;
  if (length(d) - length(replace(d, antes, ''))) / length(antes) <> 1 then
    raise exception 'Definição de consultoria_workspace_mutate_v496 diferente da esperada; migração abortada sem alterar nada.';
  end if;
  execute replace(d, antes, depois);
end
$mig$;
