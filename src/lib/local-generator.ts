// Generador local: produce HTML standalone real basado en el prompt.
// No requiere backend. Sirve como fallback funcional sin IA.
import type { FileItem } from "@/components/builder/CodeEditor";

export interface GenResult {
  name: string;
  description: string;
  files: FileItem[];
  suggestions: string[];
  model: string;
}

function detectTemplate(prompt: string): keyof typeof TEMPLATES {
  const p = prompt.toLowerCase();
  if (/(landing|saas|startup|hero|marketing)/.test(p)) return "landing";
  if (/(calculadora|propina|tip|conversor|convertidor)/.test(p)) return "calculator";
  if (/(dashboard|kpi|métricas|metricas|gráfico|grafico|stats)/.test(p)) return "dashboard";
  if (/(agenda|contactos|crm|directorio)/.test(p)) return "contacts";
  if (/(pos|carrito|tienda|ecommerce|productos|menu|menú)/.test(p)) return "pos";
  if (/(todo|tareas|task|pendientes|kanban)/.test(p)) return "todos";
  if (/(portafolio|portfolio|cv|resume)/.test(p)) return "portfolio";
  return "landing";
}

function deriveName(prompt: string): string {
  const clean = prompt.trim().replace(/[^\p{L}\p{N}\s-]/gu, "").slice(0, 40);
  return clean ? clean.charAt(0).toUpperCase() + clean.slice(1) : "App generada";
}

const BASE_HEAD = (title: string) => `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${title}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body { font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
    .gradient-text { background: linear-gradient(135deg,#60a5fa,#a78bfa); -webkit-background-clip: text; background-clip: text; color: transparent; }
    .glow { box-shadow: 0 10px 40px -10px rgba(96,165,250,.4); }
  </style>
</head>`;

const TEMPLATES = {
  landing: (title: string, prompt: string) => `${BASE_HEAD(title)}
<body class="bg-slate-950 text-slate-100">
  <header class="container mx-auto flex items-center justify-between px-6 py-5">
    <div class="font-bold text-xl">${title}</div>
    <nav class="flex gap-6 text-sm text-slate-300">
      <a href="#features" class="hover:text-white">Features</a>
      <a href="#pricing" class="hover:text-white">Precios</a>
      <a href="#contact" class="hover:text-white">Contacto</a>
    </nav>
  </header>
  <main class="container mx-auto px-6 py-20 text-center">
    <span class="inline-block rounded-full border border-slate-800 bg-slate-900/60 px-4 py-1 text-xs text-slate-400">Nuevo · 2026</span>
    <h1 class="mt-6 text-5xl md:text-7xl font-bold tracking-tight">La forma <span class="gradient-text">moderna</span><br/>de construir productos.</h1>
    <p class="mx-auto mt-6 max-w-xl text-slate-400 text-lg">${prompt}</p>
    <div class="mt-10 flex justify-center gap-3">
      <button onclick="document.getElementById('cta-modal').showModal()" class="rounded-lg bg-gradient-to-r from-blue-500 to-violet-500 px-6 py-3 font-medium glow">Empezar gratis</button>
      <a href="#features" class="rounded-lg border border-slate-700 px-6 py-3 font-medium hover:bg-slate-900">Ver features</a>
    </div>
    <section id="features" class="mt-32 grid gap-6 md:grid-cols-3 text-left">
      ${["Rápido", "Seguro", "Escalable"].map((t,i)=>`
      <div class="rounded-xl border border-slate-800 bg-slate-900/40 p-6 hover:border-blue-500/50 transition">
        <div class="h-10 w-10 rounded-lg bg-gradient-to-br from-blue-500 to-violet-500"></div>
        <h3 class="mt-4 font-semibold">${t}</h3>
        <p class="mt-1 text-sm text-slate-400">Característica ${i+1} construida con tecnología moderna y enfoque premium.</p>
      </div>`).join("")}
    </section>
  </main>
  <footer id="contact" class="border-t border-slate-800 py-8 text-center text-sm text-slate-500">© 2026 ${title}</footer>

  <dialog id="cta-modal" class="rounded-2xl bg-slate-900 text-slate-100 border border-slate-700 p-8 backdrop:bg-black/60">
    <h3 class="text-xl font-semibold">Empieza gratis</h3>
    <p class="text-sm text-slate-400 mt-1">Déjanos tu email y te contactamos.</p>
    <form onsubmit="event.preventDefault(); alert('¡Gracias! Te contactaremos a ' + this.email.value); this.closest('dialog').close();" class="mt-4 space-y-3">
      <input name="email" type="email" required placeholder="tu@email.com" class="w-full rounded-lg bg-slate-800 border border-slate-700 px-4 py-2"/>
      <div class="flex gap-2 justify-end">
        <button type="button" onclick="this.closest('dialog').close()" class="px-4 py-2 text-slate-400">Cancelar</button>
        <button class="rounded-lg bg-gradient-to-r from-blue-500 to-violet-500 px-4 py-2">Enviar</button>
      </div>
    </form>
  </dialog>
</body></html>`,

  calculator: (title: string) => `${BASE_HEAD(title)}
<body class="bg-slate-950 text-slate-100 min-h-screen flex items-center justify-center p-6">
  <div class="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/60 p-8 glow">
    <h1 class="text-2xl font-bold">${title}</h1>
    <p class="text-sm text-slate-400 mt-1">Calcula propina y total a pagar.</p>
    <div class="mt-6 space-y-4">
      <label class="block">
        <span class="text-sm text-slate-300">Monto de la cuenta</span>
        <input id="bill" type="number" step="0.01" value="100" class="mt-1 w-full rounded-lg bg-slate-800 border border-slate-700 px-4 py-3 text-lg"/>
      </label>
      <label class="block">
        <span class="text-sm text-slate-300">Propina: <span id="tipv">15</span>%</span>
        <input id="tip" type="range" min="0" max="30" value="15" class="mt-1 w-full"/>
      </label>
      <label class="block">
        <span class="text-sm text-slate-300">Personas</span>
        <input id="ppl" type="number" min="1" value="1" class="mt-1 w-full rounded-lg bg-slate-800 border border-slate-700 px-4 py-3"/>
      </label>
    </div>
    <div class="mt-8 grid grid-cols-2 gap-3 text-center">
      <div class="rounded-xl bg-slate-800/60 p-4"><div class="text-xs text-slate-400">Propina</div><div id="tipAmt" class="text-2xl font-bold gradient-text">$0</div></div>
      <div class="rounded-xl bg-slate-800/60 p-4"><div class="text-xs text-slate-400">Total</div><div id="total" class="text-2xl font-bold gradient-text">$0</div></div>
      <div class="col-span-2 rounded-xl border border-blue-500/40 bg-blue-500/10 p-4"><div class="text-xs text-blue-300">Por persona</div><div id="perPerson" class="text-3xl font-bold">$0</div></div>
    </div>
  </div>
  <script>
    const $=(id)=>document.getElementById(id);
    const fmt=(n)=>'$'+n.toLocaleString('es-MX',{minimumFractionDigits:2,maximumFractionDigits:2});
    function calc(){
      const bill=parseFloat($('bill').value)||0;
      const tip=parseInt($('tip').value)||0;
      const ppl=Math.max(1,parseInt($('ppl').value)||1);
      $('tipv').textContent=tip;
      const tipAmt=bill*tip/100;
      const total=bill+tipAmt;
      $('tipAmt').textContent=fmt(tipAmt);
      $('total').textContent=fmt(total);
      $('perPerson').textContent=fmt(total/ppl);
    }
    ['bill','tip','ppl'].forEach(id=>$(id).addEventListener('input',calc));
    calc();
  </script>
</body></html>`,

  dashboard: (title: string) => `${BASE_HEAD(title)}
<body class="bg-slate-950 text-slate-100 min-h-screen">
  <header class="border-b border-slate-800 px-6 py-4 flex items-center justify-between">
    <h1 class="font-bold text-lg">${title}</h1>
    <div class="text-sm text-slate-400">Hoy · <span id="today"></span></div>
  </header>
  <main class="p-6 space-y-6 max-w-7xl mx-auto">
    <div class="grid gap-4 md:grid-cols-3">
      ${[{l:"Ingresos",v:"$48,290",d:"+12.4%"},{l:"Usuarios",v:"2,431",d:"+8.1%"},{l:"Conversión",v:"3.8%",d:"+0.4%"}].map(k=>`
      <div class="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
        <div class="text-sm text-slate-400">${k.l}</div>
        <div class="mt-2 text-3xl font-bold gradient-text">${k.v}</div>
        <div class="mt-1 text-xs text-emerald-400">${k.d} vs mes anterior</div>
      </div>`).join("")}
    </div>
    <div class="rounded-xl border border-slate-800 bg-slate-900/40 p-6">
      <div class="flex justify-between items-center mb-4">
        <h2 class="font-semibold">Ventas últimos 7 días</h2>
        <button onclick="randomize()" class="text-xs rounded-lg border border-slate-700 px-3 py-1 hover:bg-slate-800">Aleatorio</button>
      </div>
      <svg id="chart" viewBox="0 0 700 240" class="w-full h-60"></svg>
    </div>
    <div class="rounded-xl border border-slate-800 bg-slate-900/40 overflow-hidden">
      <table class="w-full text-sm">
        <thead class="bg-slate-900/60 text-slate-400"><tr><th class="text-left p-3">Cliente</th><th class="text-left p-3">Plan</th><th class="text-right p-3">MRR</th><th class="text-right p-3">Estado</th></tr></thead>
        <tbody id="rows"></tbody>
      </table>
    </div>
  </main>
  <script>
    document.getElementById('today').textContent=new Date().toLocaleDateString('es-MX');
    const customers=[{n:"Acme Corp",p:"Pro",m:1290,s:"Activo"},{n:"Globex",p:"Team",m:790,s:"Activo"},{n:"Initech",p:"Enterprise",m:4900,s:"Trial"},{n:"Umbrella",p:"Pro",m:1290,s:"Activo"},{n:"Stark Ind.",p:"Team",m:790,s:"Pausa"}];
    document.getElementById('rows').innerHTML=customers.map(c=>'<tr class="border-t border-slate-800"><td class="p-3 font-medium">'+c.n+'</td><td class="p-3 text-slate-400">'+c.p+'</td><td class="p-3 text-right font-mono">$'+c.m+'</td><td class="p-3 text-right"><span class="rounded-full px-2 py-0.5 text-xs '+(c.s==="Activo"?"bg-emerald-500/20 text-emerald-300":c.s==="Trial"?"bg-blue-500/20 text-blue-300":"bg-slate-700 text-slate-300")+'">'+c.s+'</span></td></tr>').join("");
    function chart(values){
      const w=700,h=240,pad=20;
      const max=Math.max(...values);
      const step=(w-pad*2)/(values.length-1);
      const pts=values.map((v,i)=>[pad+i*step, h-pad-(v/max)*(h-pad*2)]);
      const path=pts.map((p,i)=>(i?'L':'M')+p[0]+','+p[1]).join(' ');
      const area=path+' L'+pts[pts.length-1][0]+','+(h-pad)+' L'+pts[0][0]+','+(h-pad)+' Z';
      document.getElementById('chart').innerHTML='<defs><linearGradient id="g" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#60a5fa" stop-opacity=".4"/><stop offset="1" stop-color="#60a5fa" stop-opacity="0"/></linearGradient></defs><path d="'+area+'" fill="url(#g)"/><path d="'+path+'" fill="none" stroke="#a78bfa" stroke-width="2.5"/>'+pts.map(p=>'<circle cx="'+p[0]+'" cy="'+p[1]+'" r="4" fill="#a78bfa"/>').join('');
    }
    function randomize(){chart(Array.from({length:7},()=>Math.round(Math.random()*100+20)));}
    randomize();
  </script>
</body></html>`,

  contacts: (title: string) => `${BASE_HEAD(title)}
<body class="bg-slate-950 text-slate-100 min-h-screen">
  <main class="max-w-3xl mx-auto p-6">
    <header class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold gradient-text">${title}</h1>
      <button onclick="addContact()" class="rounded-lg bg-gradient-to-r from-blue-500 to-violet-500 px-4 py-2 text-sm font-medium">+ Nuevo</button>
    </header>
    <input id="q" oninput="render()" placeholder="Buscar contactos..." class="w-full rounded-lg bg-slate-900 border border-slate-800 px-4 py-3 mb-4"/>
    <ul id="list" class="space-y-2"></ul>
    <p id="empty" class="text-center text-slate-500 mt-12 hidden">Sin resultados</p>
  </main>
  <script>
    let contacts=JSON.parse(localStorage.getItem('nexa-contacts')||'null')||[
      {id:1,name:"Ana López",email:"ana@ejemplo.com",phone:"+52 55 1234 5678"},
      {id:2,name:"Carlos Pérez",email:"carlos@ejemplo.com",phone:"+52 55 8765 4321"},
      {id:3,name:"María Torres",email:"maria@ejemplo.com",phone:"+52 81 2345 6789"},
    ];
    const save=()=>localStorage.setItem('nexa-contacts',JSON.stringify(contacts));
    function render(){
      const q=document.getElementById('q').value.toLowerCase();
      const list=contacts.filter(c=>c.name.toLowerCase().includes(q)||c.email.toLowerCase().includes(q));
      document.getElementById('empty').classList.toggle('hidden',list.length>0);
      document.getElementById('list').innerHTML=list.map(c=>'<li class="flex items-center gap-4 rounded-xl border border-slate-800 bg-slate-900/40 p-4 hover:border-blue-500/50 transition"><div class="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center font-bold">'+c.name[0]+'</div><div class="flex-1 min-w-0"><div class="font-medium truncate">'+c.name+'</div><div class="text-xs text-slate-400 truncate">'+c.email+' · '+c.phone+'</div></div><button onclick="del('+c.id+')" class="text-slate-500 hover:text-red-400 text-sm">Eliminar</button></li>').join("");
    }
    function addContact(){
      const name=prompt("Nombre:"); if(!name) return;
      const email=prompt("Email:")||""; const phone=prompt("Teléfono:")||"";
      contacts.unshift({id:Date.now(),name,email,phone}); save(); render();
    }
    function del(id){if(!confirm("¿Eliminar?")) return; contacts=contacts.filter(c=>c.id!==id); save(); render();}
    render();
  </script>
</body></html>`,

  pos: (title: string) => `${BASE_HEAD(title)}
<body class="bg-slate-950 text-slate-100 min-h-screen">
  <main class="grid md:grid-cols-[1fr,360px] min-h-screen">
    <section class="p-6">
      <h1 class="text-2xl font-bold gradient-text mb-4">${title}</h1>
      <div id="products" class="grid grid-cols-2 md:grid-cols-3 gap-3"></div>
    </section>
    <aside class="border-l border-slate-800 bg-slate-900/40 p-6 flex flex-col">
      <h2 class="font-semibold">Carrito</h2>
      <ul id="cart" class="mt-4 flex-1 overflow-auto space-y-2"></ul>
      <div class="border-t border-slate-800 pt-4 mt-4 space-y-2">
        <div class="flex justify-between text-sm text-slate-400"><span>Subtotal</span><span id="sub">$0</span></div>
        <div class="flex justify-between text-sm text-slate-400"><span>IVA 16%</span><span id="iva">$0</span></div>
        <div class="flex justify-between text-lg font-bold"><span>Total</span><span id="tot" class="gradient-text">$0</span></div>
        <button onclick="checkout()" class="w-full rounded-lg bg-gradient-to-r from-blue-500 to-violet-500 py-3 font-medium">Cobrar</button>
      </div>
    </aside>
  </main>
  <script>
    const products=[{id:1,n:"Café",p:45,e:"☕"},{id:2,n:"Latte",p:65,e:"🥛"},{id:3,n:"Croissant",p:55,e:"🥐"},{id:4,n:"Sandwich",p:95,e:"🥪"},{id:5,n:"Bagel",p:65,e:"🥯"},{id:6,n:"Jugo",p:55,e:"🧃"}];
    let cart={};
    document.getElementById('products').innerHTML=products.map(p=>'<button onclick="add('+p.id+')" class="rounded-xl border border-slate-800 bg-slate-900/40 p-4 hover:border-blue-500/50 transition text-left"><div class="text-3xl">'+p.e+'</div><div class="mt-2 font-medium">'+p.n+'</div><div class="text-sm text-slate-400">$'+p.p+'</div></button>').join("");
    function add(id){cart[id]=(cart[id]||0)+1; render();}
    function rem(id){if(--cart[id]<=0) delete cart[id]; render();}
    function render(){
      const items=Object.entries(cart).map(([id,q])=>{const p=products.find(x=>x.id==id); return {p,q};});
      document.getElementById('cart').innerHTML=items.length?items.map(({p,q})=>'<li class="flex items-center justify-between rounded-lg bg-slate-800/50 p-2"><div><div class="font-medium text-sm">'+p.n+'</div><div class="text-xs text-slate-400">$'+p.p+' c/u</div></div><div class="flex items-center gap-2"><button onclick="rem('+p.id+')" class="h-7 w-7 rounded bg-slate-700">−</button><span class="w-6 text-center">'+q+'</span><button onclick="add('+p.id+')" class="h-7 w-7 rounded bg-slate-700">+</button></div></li>').join(""):'<li class="text-sm text-slate-500 text-center py-8">Carrito vacío</li>';
      const sub=items.reduce((s,{p,q})=>s+p.p*q,0); const iva=sub*0.16; const tot=sub+iva;
      document.getElementById('sub').textContent='$'+sub.toFixed(2);
      document.getElementById('iva').textContent='$'+iva.toFixed(2);
      document.getElementById('tot').textContent='$'+tot.toFixed(2);
    }
    function checkout(){const items=Object.keys(cart); if(!items.length){alert("Carrito vacío");return;} alert("✅ Venta registrada por "+document.getElementById('tot').textContent); cart={}; render();}
    render();
  </script>
</body></html>`,

  todos: (title: string) => `${BASE_HEAD(title)}
<body class="bg-slate-950 text-slate-100 min-h-screen">
  <main class="max-w-xl mx-auto p-6">
    <h1 class="text-3xl font-bold gradient-text">${title}</h1>
    <form onsubmit="event.preventDefault(); add(this.t.value); this.reset();" class="mt-6 flex gap-2">
      <input name="t" required placeholder="Nueva tarea..." class="flex-1 rounded-lg bg-slate-900 border border-slate-800 px-4 py-3"/>
      <button class="rounded-lg bg-gradient-to-r from-blue-500 to-violet-500 px-5">+</button>
    </form>
    <div class="mt-4 flex gap-2 text-sm" id="filters"></div>
    <ul id="list" class="mt-4 space-y-2"></ul>
  </main>
  <script>
    let todos=JSON.parse(localStorage.getItem('nexa-todos')||'[]'); let filter='all';
    const save=()=>localStorage.setItem('nexa-todos',JSON.stringify(todos));
    function add(t){todos.unshift({id:Date.now(),t,done:false}); save(); render();}
    function tog(id){todos=todos.map(x=>x.id===id?{...x,done:!x.done}:x); save(); render();}
    function del(id){todos=todos.filter(x=>x.id!==id); save(); render();}
    function setF(f){filter=f; render();}
    function render(){
      const list=todos.filter(x=>filter==='all'||(filter==='done'?x.done:!x.done));
      document.getElementById('filters').innerHTML=['all','active','done'].map(f=>'<button onclick="setF(\\''+f+'\\')" class="rounded-lg px-3 py-1 '+(filter===f?'bg-blue-500/30 text-blue-200':'text-slate-400 hover:bg-slate-800')+'">'+f+'</button>').join("");
      document.getElementById('list').innerHTML=list.length?list.map(x=>'<li class="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-900/40 p-3"><input type="checkbox" '+(x.done?'checked':'')+' onchange="tog('+x.id+')" class="h-5 w-5"/><span class="flex-1 '+(x.done?'line-through text-slate-500':'')+'">'+x.t+'</span><button onclick="del('+x.id+')" class="text-slate-500 hover:text-red-400">×</button></li>').join(""):'<li class="text-center text-slate-500 py-8">Sin tareas</li>';
    }
    render();
  </script>
</body></html>`,

  portfolio: (title: string) => `${BASE_HEAD(title)}
<body class="bg-slate-950 text-slate-100">
  <main class="max-w-3xl mx-auto p-8">
    <header class="text-center py-16">
      <div class="mx-auto h-24 w-24 rounded-full bg-gradient-to-br from-blue-500 to-violet-500"></div>
      <h1 class="mt-6 text-4xl font-bold">${title}</h1>
      <p class="mt-2 text-slate-400">Diseñador y desarrollador full-stack</p>
      <div class="mt-4 flex justify-center gap-3 text-sm">
        <a href="#" class="text-blue-400 hover:underline">GitHub</a>
        <a href="#" class="text-blue-400 hover:underline">LinkedIn</a>
        <a href="#" class="text-blue-400 hover:underline">Email</a>
      </div>
    </header>
    <section>
      <h2 class="text-xl font-semibold mb-4">Proyectos</h2>
      <div class="grid gap-4">
        ${[1,2,3].map(i=>`<a href="#" class="rounded-xl border border-slate-800 bg-slate-900/40 p-5 hover:border-blue-500/50 transition block"><div class="font-semibold">Proyecto ${i}</div><p class="text-sm text-slate-400 mt-1">Descripción breve del proyecto ${i}, su stack y resultado.</p></a>`).join("")}
      </div>
    </section>
  </main>
</body></html>`,
};

export function generateLocal(prompt: string, mode: string = "generate", currentHtml?: string): GenResult {
  const tplKey = detectTemplate(prompt);
  const name = mode === "generate" ? deriveName(prompt) : (deriveName(prompt) || "App");
  const title = name;

  let html: string;
  if (mode === "generate" || !currentHtml) {
    html = TEMPLATES[tplKey](title, prompt);
  } else {
    // Variantes simples sobre el HTML actual.
    html = currentHtml;
    if (mode === "improve") {
      html = html.replace(/bg-slate-950/g, "bg-gradient-to-br from-slate-950 via-indigo-950/40 to-slate-950");
    } else if (mode === "mobile") {
      if (!html.includes('viewport')) html = html.replace("<head>", '<head><meta name="viewport" content="width=device-width,initial-scale=1"/>');
    } else if (mode === "fix") {
      // ya viene corregido
    } else if (mode === "optimize") {
      html = html.replace(/<img /g, '<img loading="lazy" decoding="async" ');
    } else if (mode === "netlify") {
      // se añadirán archivos abajo
    }
  }

  const files: FileItem[] = [
    { path: "index.html", content: html, language: "html" },
    {
      path: "README.md",
      content: `# ${title}\n\nGenerado con **Nexa One Builder** (modo local).\n\n## Prompt\n${prompt}\n\n## Cómo usar\n1. Abre \`index.html\` en tu navegador, o\n2. Sube esta carpeta a Netlify (drag & drop en https://app.netlify.com/drop)\n`,
      language: "markdown",
    },
  ];

  if (mode === "netlify") {
    files.push({
      path: "netlify.toml",
      content: `[build]\n  publish = "."\n  command = ""\n\n[[redirects]]\n  from = "/*"\n  to = "/index.html"\n  status = 200\n`,
      language: "plaintext",
    });
  }

  const suggestions: Record<string, string[]> = {
    landing: ["Añade testimonios", "Añade sección de pricing", "Añade FAQ"],
    calculator: ["Añade historial", "Añade modo dividir cuenta", "Añade exportar PDF"],
    dashboard: ["Conecta a una API real", "Añade filtros por fecha", "Añade exportar CSV"],
    contacts: ["Añade etiquetas", "Importar CSV", "Compartir contacto"],
    pos: ["Añade categorías", "Añade impresión de ticket", "Añade descuentos"],
    todos: ["Añade categorías", "Recordatorios con notificación", "Sincronizar con calendario"],
    portfolio: ["Añade blog", "Modo claro/oscuro", "Formulario de contacto"],
  };

  return {
    name: title,
    description:
      mode === "generate"
        ? `Plantilla ${tplKey} generada localmente para: ${prompt.slice(0, 80)}`
        : `Acción aplicada: ${mode}`,
    files,
    suggestions: suggestions[tplKey] || [],
    model: "nexa-local-v1",
  };
}