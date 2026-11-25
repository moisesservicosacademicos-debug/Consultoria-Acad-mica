// Notificações no celular e no computador (Web Push) da Consultoria Acadêmica.
// mode "cron": chamado de hora em hora pelo pg_cron; envia avisos de entregas, provas e
//   agendamentos que vencem em até 2 dias ou estão atrasados, enquanto não forem resolvidos.
//   v3 (portais): inclui conferências de portais acadêmicos e eventos previstos nos portais
//   (liberação de disciplina, prova, prazo de atividade, retorno do recesso) na mesma janela.
// mode "test": chamado pelo app (usuário logado) para enviar uma notificação de teste.
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";

const URL_ = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const WS = "nova_empresa_main";
const ORIGINS = ["https://consultoria-acad-mica.vercel.app", "https://moisesservicosacademicos-debug.github.io"];
const JANELA = 2;

const admin = createClient(URL_, SERVICE, { auth: { persistSession: false } });

function cors(req: Request) {
  const o = req.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": ORIGINS.includes(o) || /^https:\/\/consultoria-acad-mica-[a-z0-9-]+\.vercel\.app$/.test(o) ? o : ORIGINS[0],
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}
const json = (req: Request, b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors(req), "Content-Type": "application/json" } });

function normDate(s: unknown): string {
  const v = String(s ?? "").trim();
  if (/^\d{2}[\/-]\d{2}[\/-]\d{4}/.test(v)) return v.slice(6, 10) + "-" + v.slice(3, 5) + "-" + v.slice(0, 2);
  return v.slice(0, 10);
}
const isISO = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);
const utc = (s: string) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
const days = (a: string, b: string) => Math.round((utc(b) - utc(a)) / 86400000);
const dbr = (s: string) => s.slice(8, 10) + "/" + s.slice(5, 7);

function agoraBR() {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hour12: false }).formatToParts(new Date());
  const g = (t: string) => p.find((x) => x.type === t)?.value || "";
  return { hoje: `${g("year")}-${g("month")}-${g("day")}`, hora: +g("hour") % 24 };
}

type Item = { k: string; tipo: "entrega" | "prova" | "agenda" | "portal"; titulo: string; nome: string; data: string; hora: string; dias: number; cod: string };

/* Mesma regra do sistema (js/portais.js): data que gera o aviso de um evento aberto do portal. */
function refPortal(e: any): { d: string; t: string } | null {
  const st = e?.status || "previsto";
  if (st === "concluido" || st === "cancelado") return null;
  const d = (k: string) => { const v = normDate(e?.[k]); return isISO(v) ? v : ""; };
  const nome = e?.disciplina || e?.descricao || "evento";
  if (e?.tipo === "prova") return d("prova") ? { d: d("prova"), t: "Prova: " + nome } : null;
  if (e?.tipo === "disciplina") {
    if (st === "previsto") return d("inicio") ? { d: d("inicio"), t: "Liberação: " + nome } : null;
    return d("fim") ? { d: d("fim"), t: "Término: " + nome } : null;
  }
  if (e?.tipo === "atividade" || e?.tipo === "trabalho") {
    if (st === "previsto" && d("inicio")) return { d: d("inicio"), t: "Liberação: " + nome };
    return d("fim") ? { d: d("fim"), t: "Prazo: " + nome } : null;
  }
  const x = d("inicio") || d("fim");
  return x ? { d: x, t: nome } : null;
}

function pendencias(d: any, hoje: string): Item[] {
  const arr = (k: string) => (Array.isArray(d?.[k]) ? d[k] : []);
  const out: Item[] = [];
  for (const s of arr("services")) {
    const ent = s["Status Entrega"] || "Em produção";
    if (ent === "Concluído" || ent === "Cancelado") continue;
    const pr = normDate(s["Data Entrega Prevista"]); if (!isISO(pr)) continue;
    const di = days(hoje, pr); if (di > JANELA) continue;
    out.push({ k: "sv:" + s._uid, tipo: "entrega", titulo: s["Serviço/Projeto"] || "Serviço", nome: s.Cliente || "", data: pr, hora: "", dias: di, cod: s["ID Serviço"] || "" });
  }
  for (const x of arr("deadlines")) {
    if (/conclu|cancel/i.test(x.Status || "")) continue;
    if (x._linkDs === "services" && x._linkUid) continue;
    const pr = normDate(x["Prazo previsto"]); if (!isISO(pr)) continue;
    const di = days(hoje, pr); if (di > JANELA) continue;
    out.push({ k: "dl:" + x._uid, tipo: "entrega", titulo: x["Serviço"] || x["Descrição / Etapa"] || "Prazo", nome: x["Cliente/Aluno"] || "", data: pr, hora: "", dias: di, cod: "" });
  }
  for (const s of arr("schedules")) {
    const st = s["Situação do agendamento"] || s.Status || "Pendente";
    if (/resolvid|conclu|cancel/i.test(st)) continue;
    const dt = normDate(s["Data agendada"]); if (!isISO(dt)) continue;
    const di = days(hoje, dt); if (di > JANELA) continue;
    const prova = /prova|avalia|exame/i.test((s.Tipo || "") + " " + (s["Descrição"] || ""));
    out.push({ k: "sch:" + s._uid, tipo: prova ? "prova" : "agenda", titulo: s["Descrição"] || s.Tipo || "Compromisso", nome: s["Cliente/Aluno"] || "", data: dt, hora: s["Horário"] || "", dias: di, cod: s.Tipo || "" });
  }
  // Portais acadêmicos: um aviso por portal e por data (conferência + eventos do mesmo dia juntos)
  const nomeCli: Record<string, string> = {};
  for (const c of arr("clients")) if (c?.["ID Cliente"]) nomeCli[c["ID Cliente"]] = c.Nome || "";
  for (const p of arr("portals")) {
    if ((p?.["Status do acompanhamento"] || "Ativo") !== "Ativo" || !p?._uid) continue;
    const nome = nomeCli[p._clientId] || p["Cliente/Aluno"] || "";
    const inst = p["Instituição"] || "Portal";
    const prox = normDate(p["Próxima conferência"]);
    if (!isISO(prox)) {
      out.push({ k: "pt:" + p._uid + ":semprog", tipo: "portal", titulo: "Portal sem acompanhamento programado", nome, data: hoje, hora: "", dias: 0, cod: inst });
      continue;
    }
    const g: Record<string, string[]> = {};
    const add = (dt: string, t: string) => { (g[dt] = g[dt] || []).push(t); };
    add(prox, "__conf");
    for (const e of Array.isArray(p.Eventos) ? p.Eventos : []) { const r = refPortal(e); if (r) add(r.d, r.t); }
    const ret = normDate(p?.Recesso?.retorno); if (isISO(ret)) add(ret, "Retorno das aulas");
    for (const dt of Object.keys(g)) {
      const di = days(hoje, dt); if (di > JANELA) continue;
      const conf = g[dt].includes("__conf"), evs = g[dt].filter((t) => t !== "__conf");
      const titulo = conf ? "Conferir portal " + inst + (evs.length ? " · " + evs.join(", ") : "") : evs.join(", ") + " · " + inst;
      out.push({ k: "pt:" + p._uid + ":" + dt, tipo: "portal", titulo, nome, data: dt, hora: "", dias: di, cod: inst });
    }
  }
  out.sort((a, b) => a.dias - b.dias || (a.tipo === "prova" ? -1 : b.tipo === "prova" ? 1 : 0));
  return out;
}

function mensagem(n: Item) {
  const rot = n.tipo === "portal" ? "Portal" : n.tipo === "prova" ? "Prova" : n.tipo === "agenda" ? "Agendamento" : "Entrega";
  const hr = n.hora ? " às " + n.hora : "";
  const quando = n.dias < 0 ? `atrasada há ${-n.dias} ${n.dias === -1 ? "dia" : "dias"}` : n.dias === 0 ? "é hoje" + hr : n.dias === 1 ? "é amanhã" + hr : "em 2 dias";
  const pq = n.dias < 0 ? `Atrasado há ${-n.dias} ${n.dias === -1 ? "dia" : "dias"}` : n.dias === 0 ? "Hoje" : n.dias === 1 ? "Amanhã" : `Em ${n.dias} dias`;
  const title = n.tipo === "portal"
    ? (n.k.endsWith(":semprog") ? "⚠️ Portal sem conferência programada: " + n.cod : (n.dias < 0 ? "⚠️ " : n.dias === 0 ? "🔴 " : "🟠 ") + pq + ": " + n.titulo)
    : (n.dias < 0 ? "⚠️ " : n.dias === 0 ? "🔴 " : "🟠 ") + rot + " " + quando + ": " + n.titulo;
  const body = n.tipo === "portal"
    ? `${n.nome || "Sem aluno"} · ${dbr(n.data)}. Confira o portal e registre a conferência em Resolver.`
    : `${n.nome || "Sem cliente"} · ${dbr(n.data)}${hr}${n.cod && n.tipo === "entrega" ? " · " + n.cod : ""}. Abra o sistema e marque como resolvido ao concluir.`;
  return { title, body, tag: n.k, url: "/#/agenda/" + (n.tipo === "portal" ? "portais" : n.tipo === "entrega" ? "prazos" : "agendamentos"), urgent: n.dias <= 0 };
}

async function config() {
  const { data, error } = await admin.rpc("push_config");
  if (error) throw error;
  webpush.setVapidDetails(data.push_vapid_subject, data.push_vapid_public, data.push_vapid_private);
  return data as Record<string, string>;
}

async function enviar(subs: any[], payloads: any[]) {
  let ok = 0, fail = 0;
  for (const s of subs) {
    for (const p of payloads) {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(p), { TTL: 6 * 3600, urgency: p.urgent ? "high" : "normal" });
        ok++;
        await admin.from("push_subscriptions").update({ last_ok_at: new Date().toISOString(), failures: 0 }).eq("id", s.id);
      } catch (e: any) {
        fail++;
        const code = e?.statusCode;
        if (code === 404 || code === 410) { await admin.from("push_subscriptions").delete().eq("id", s.id); break; }
        await admin.from("push_subscriptions").update({ failures: (s.failures || 0) + 1 }).eq("id", s.id);
      }
    }
  }
  return { ok, fail };
}

async function rodar(force = false) {
  const { hoje, hora } = agoraBR();
  if (!force && (hora < 7 || hora >= 22)) return { skipped: "silêncio noturno", hora };
  const { data: subs } = await admin.from("push_subscriptions").select("*");
  if (!subs?.length) return { skipped: "nenhum aparelho inscrito" };
  const { data: ws, error } = await admin.from("app_workspace").select("data").eq("id", WS).single();
  if (error) throw error;
  const L = pendencias(ws.data, hoje);
  const turno = hora < 13 ? "manha" : "tarde";
  const novos: Item[] = [];
  for (const n of L) {
    // atrasados e de hoje: aviso de manhã e à tarde; os próximos 2 dias: um aviso por dia
    const slot = n.dias <= 0 ? turno : "dia";
    const { data: ins } = await admin.from("push_log").upsert({ k: n.k, slot, day: hoje }, { onConflict: "k,slot,day", ignoreDuplicates: true }).select("k");
    if (ins && ins.length) novos.push(n);
  }
  if (!novos.length) return { pendentes: L.length, enviados: 0 };
  const payloads = novos.slice(0, 4).map(mensagem);
  if (novos.length > 4) payloads.push({ title: `+${novos.length - 4} pendências com prazo próximo`, body: "Abra o sistema para ver todas as notificações.", tag: "resumo", url: "/#/agenda/prazos", urgent: false });
  const r = await enviar(subs, payloads);
  await admin.from("push_log").delete().lt("day", new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10));
  return { pendentes: L.length, novos: novos.length, ...r };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  try {
    const body = await req.json().catch(() => ({}));
    const cfg = await config();
    if (body.mode === "cron") {
      if (req.headers.get("x-cron-secret") !== cfg.push_cron_secret) return json(req, { error: "não autorizado" }, 401);
      return json(req, await rodar(!!body.force));
    }
    if (body.mode === "test") {
      const auth = req.headers.get("authorization") || "";
      const user = createClient(URL_, ANON, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
      const { data: u } = await user.auth.getUser(auth.replace(/^Bearer\s+/i, ""));
      if (!u?.user) return json(req, { error: "sessão inválida" }, 401);
      const { data: subs } = await user.from("push_subscriptions").select("id, endpoint").eq(body.endpoint ? "endpoint" : "user_id", body.endpoint || u.user.id);
      if (!subs?.length) return json(req, { error: "aparelho não inscrito" }, 404);
      const { data: full } = await admin.from("push_subscriptions").select("*").in("id", subs.map((s: any) => s.id));
      const { hoje } = agoraBR();
      const { data: ws } = await admin.from("app_workspace").select("data").eq("id", WS).single();
      const L = pendencias(ws?.data, hoje);
      const p = { title: "✅ Notificações ativadas", body: L.length ? `Tudo certo! Agora há ${L.length} ${L.length === 1 ? "pendência" : "pendências"} com prazo em até 2 dias ou em atraso. Você será avisado aqui.` : "Tudo certo! Você será avisado aqui 2 dias antes de cada entrega, prova ou agendamento.", tag: "teste", url: "/#/painel", urgent: false };
      return json(req, await enviar(full || [], [p]));
    }
    return json(req, { error: "modo inválido" }, 400);
  } catch (e: any) {
    return json(req, { error: String(e?.message || e) }, 500);
  }
});
