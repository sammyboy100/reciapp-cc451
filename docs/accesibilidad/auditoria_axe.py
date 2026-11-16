import json, sys, time, urllib.request, urllib.parse
from playwright.sync_api import sync_playwright
FE="http://localhost:4173"; API="http://localhost:8000"
AXE=open(sys.argv[1]).read(); OUT=sys.argv[2]
def tok(c):
    d=urllib.parse.urlencode({"username":c,"password":"Reciapp2026!"}).encode()
    return json.load(urllib.request.urlopen(API+"/auth/login",d))["access_token"]
PAGES=[(None,"/login","Login"),("lucia@reciapp.pe","/ciudadano","Inicio ciudadano"),("lucia@reciapp.pe","/ciudadano/solicitudes","Mis solicitudes"),
 ("lucia@reciapp.pe","/salas","Salas"),("lucia@reciapp.pe","/salas/1","Sala + jornadas"),("lucia@reciapp.pe","/perfil","Perfil y accesibilidad"),
 ("lucia@reciapp.pe","/encuesta","Encuesta SUS"),("juan.reciclador@reciapp.pe","/reciclador","Panel reciclador"),("admin@reciapp.pe","/admin/metricas","Métricas admin")]
res=[]
with sync_playwright() as pw:
    b=pw.chromium.launch()
    for c,path,name in PAGES:
        ctx=b.new_context(viewport={"width":1366,"height":860})
        ctx.add_init_script("sessionStorage.setItem('reciapp_splash_seen','1');"+(f"localStorage.setItem('token','{tok(c)}');" if c else ""))
        p=ctx.new_page(); p.goto(FE+path); time.sleep(2.2)
        p.add_script_tag(content=AXE)
        r=p.evaluate("async()=>{const r=await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']}});return r.violations.map(v=>({id:v.id,impact:v.impact,help:v.help,n:v.nodes.length,ej:v.nodes.slice(0,3).map(n=>n.target.join(' ')+' :: '+(n.failureSummary||'').split('\\n').slice(0,2).join(' '))}))}")
        res.append({"pagina":name,"ruta":path,"violaciones":r}); ctx.close()
    b.close()
json.dump(res,open(OUT,"w"),ensure_ascii=False,indent=1)
for x in res:
    print(x["pagina"], sum(v["n"] for v in x["violaciones"]), [ (v["id"],v["impact"],v["n"]) for v in x["violaciones"]])
