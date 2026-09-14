<?php $GUARD_HOME = '../index.html'; $GUARD_FROM = 'app/da.php'; require __DIR__ . '/../guard.php'; ?>
<!DOCTYPE html>
<html lang="fr" data-da="a">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Direction artistique — Adopte un Job</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Sora:wght@400;500;600;700&family=DM+Sans:wght@400;500;700&family=Fraunces:opsz,wght@9..144,500;9..144,600&family=JetBrains+Mono:wght@400;600&display=swap">
<link rel="stylesheet" href="assets/app.css">
<style>
  body { background: #EEF0F3; }
  .wrap { max-width: 1100px; margin: 0 auto; padding: 28px 20px 80px; }
  .intro { max-width: 62ch; }
  .intro h1 { font-family: "Plus Jakarta Sans", sans-serif; font-size: 30px; font-weight: 800;
    letter-spacing: -.03em; color: #0F1A2B; margin-bottom: 10px; }
  .intro p { color: #46536A; font-size: 15px; line-height: 1.6; }
  .back { display: inline-block; font-size: 13px; font-weight: 600; color: #17356B;
    text-decoration: none; margin-bottom: 18px; }
  .pistes { display: grid; gap: 22px; grid-template-columns: repeat(auto-fit, minmax(310px, 1fr)); margin-top: 30px; }
  .piste { background: var(--bg); border: 1px solid var(--line); border-radius: 20px; padding: 20px;
    font-family: var(--font-ui); color: var(--ink); }
  .piste .nom { font-family: var(--font-display); font-weight: var(--display-weight);
    letter-spacing: var(--display-tracking); font-size: 22px; margin-bottom: 4px; }
  .piste .desc { font-size: 13px; color: var(--ink-2); line-height: 1.55; margin-bottom: 16px; min-height: 62px; }
  .swatches { display: flex; gap: 6px; margin-bottom: 14px; }
  .swatches i { flex: 1; height: 34px; border-radius: 8px; border: 1px solid rgba(0,0,0,.08); }
  .typespec { font-size: 12px; color: var(--ink-2); margin-bottom: 16px; line-height: 1.6; }
  .typespec b { color: var(--ink); }
  .mini { border-radius: var(--card-r); background: var(--stage); color: var(--stage-ink);
    border: 1px solid var(--stage-line); overflow: hidden; box-shadow: var(--shadow-card); }
  .mini .segs { display: flex; gap: 3px; padding: 12px 16px 0; }
  .mini .segs i { flex: 1; height: 3px; border-radius: 999px; background: rgba(255,255,255,.22); }
  .mini .segs i:first-child { background: var(--stage-ink); }
  .mini .st { padding: 14px 18px 16px; background:
    radial-gradient(115% 70% at 100% 0%, color-mix(in srgb, var(--accent) 22%, transparent), transparent 62%),
    radial-gradient(100% 70% at 0% 100%, color-mix(in srgb, var(--brand) 30%, transparent), transparent 68%); }
  .mini .role { font-family: var(--font-display); font-weight: var(--display-weight);
    letter-spacing: var(--display-tracking); font-size: 24px; line-height: 1.1; margin: 12px 0 4px; }
  .mini .org { font-size: 13px; color: var(--stage-ink-2); }
  .mini .facts { padding: 12px 18px 14px; border-top: 1px solid var(--stage-line);
    font-size: 13px; color: var(--stage-ink-2); }
  .mini .facts em { font-style: normal; color: var(--stage-ink); font-weight: 600; }
  .mini .tags { padding: 12px 18px 0; }
  .btns { display: flex; gap: 8px; margin-top: 16px; align-items: center; }
  .pick { flex: 1; min-height: 44px; border-radius: 12px; border: none; background: var(--brand);
    color: var(--brand-ink); font-weight: 700; font-size: 14px; }
  .pick.actif { background: var(--yes); }
  .mini .acts2 { display: flex; gap: 10px; justify-content: center; padding: 14px; background: var(--bg); }
  .mini .acts2 span { width: 40px; height: 40px; border-radius: 999px; border: 1px solid var(--line);
    background: var(--surface); display: grid; place-items: center; color: var(--ink-2); font-size: 15px; }
  .mini .acts2 span.y { background: var(--yes); border-color: var(--yes); color: #fff; width: 48px; height: 48px; }
  
  
  
  
  
  
  
</style>
</head>
<body>
<div class="wrap">
  <a class="back" href="index.php">← Retour à l’app</a>
  <div class="intro">
    <h1>Trois directions, un seul écran</h1>
    <p>Même écran, même contenu, trois traitements. Choisis-en un : l’app s’ouvrira dans cette direction pour tout le monde sur ce navigateur. Rien n’est définitif — c’est fait pour être discuté à neuf.</p>
  </div>

  <div class="pistes">

    <div class="piste" data-da="a">
      <div class="nom">A · Encre &amp; Ambre</div>
      <p class="desc">Chrome clair et sobre, deck sur fond charbon : la carte devient une scène. L’ambre ne sert qu’à ce qui mérite l’œil. Le plus consensuel, le plus lisible en plein soleil.</p>
      <div class="swatches">
        <i style="background:#17356B"></i><i style="background:#E8912B"></i><i style="background:#14171F"></i>
        <i style="background:#F4F6F8"></i><i style="background:#11875F"></i><i style="background:#C2384B"></i>
      </div>
      <p class="typespec"><b>Plus Jakarta Sans</b> — humaniste, très lisible en petit corps sur mobile.<br><b>JetBrains Mono</b> pour les chiffres.</p>
      <div class="mini">
        <div class="segs"><i></i><i></i><i></i><i></i><i></i><i></i></div>
        <div class="st">
          <span class="score"><span class="gauge"><b style="width:92%;background:var(--yes)"></b></span><span class="v" style="color:var(--yes)">92 %</span> compatible</span>
          <div class="role">Technicien support informatique</div>
          <div class="org">Pacific Systems · Nouméa</div>
          <div class="tags" style="padding:14px 0 0"><span>Windows Server</span><span>Réseau</span><span>Helpdesk</span></div>
        </div>
        <div class="facts">12 km <em>Nouméa</em> · <em>CDI</em> · <em>280 – 320 k XPF</em></div>
        <div class="acts2"><span>↺</span><span>✕</span><span>☆</span><span class="y">♥</span></div>
      </div>
      <div class="btns"><button class="pick" data-da-pick="a">Choisir cette direction</button></div>
    </div>

    <div class="piste" data-da="b">
      <div class="nom">B · Nuit &amp; Lagon</div>
      <p class="desc">Sombre de bout en bout. Économe en batterie sur écran OLED, et l’app n’a plus besoin de changer de registre entre le deck et le reste. Le turquoise porte l’action, l’ambre l’alerte.</p>
      <div class="swatches">
        <i style="background:#2ED3B7"></i><i style="background:#F2C14E"></i><i style="background:#141A1F"></i>
        <i style="background:#0C1013"></i><i style="background:#35D39A"></i><i style="background:#F0687E"></i>
      </div>
      <p class="typespec"><b>Sora</b> — géométrique, un peu technique, tranche avec les codes RH.<br><b>JetBrains Mono</b> pour les chiffres.</p>
      <div class="mini">
        <div class="segs"><i></i><i></i><i></i><i></i><i></i><i></i></div>
        <div class="st">
          <span class="score"><span class="gauge"><b style="width:92%;background:var(--yes)"></b></span><span class="v" style="color:var(--yes)">92 %</span> compatible</span>
          <div class="role">Technicien support informatique</div>
          <div class="org">Pacific Systems · Nouméa</div>
          <div class="tags" style="padding:14px 0 0"><span>Windows Server</span><span>Réseau</span><span>Helpdesk</span></div>
        </div>
        <div class="facts">12 km <em>Nouméa</em> · <em>CDI</em> · <em>280 – 320 k XPF</em></div>
        <div class="acts2"><span>↺</span><span>✕</span><span>☆</span><span class="y">♥</span></div>
      </div>
      <div class="btns"><button class="pick" data-da-pick="b">Choisir cette direction</button></div>
    </div>

    <div class="piste" data-da="c">
      <div class="nom">C · Papier &amp; Encre</div>
      <p class="desc">Registre éditorial. Un CV est un document : cette piste l’assume. C’est celle qui ressemble le moins à une application d’emploi — donc la plus risquée, et la plus mémorable.</p>
      <div class="swatches">
        <i style="background:#1B1815"></i><i style="background:#B2422C"></i><i style="background:#F2EFE9"></i>
        <i style="background:#E9E4DA"></i><i style="background:#2F6B4F"></i><i style="background:#96661B"></i>
      </div>
      <p class="typespec"><b>Fraunces</b> en titres — serif à caractère, jamais vu dans ce secteur.<br><b>DM Sans</b> en texte courant.</p>
      <div class="mini">
        <div class="segs"><i></i><i></i><i></i><i></i><i></i><i></i></div>
        <div class="st">
          <span class="score"><span class="gauge"><b style="width:92%;background:var(--yes)"></b></span><span class="v" style="color:var(--yes)">92 %</span> compatible</span>
          <div class="role">Technicien support informatique</div>
          <div class="org">Pacific Systems · Nouméa</div>
          <div class="tags" style="padding:14px 0 0"><span>Windows Server</span><span>Réseau</span><span>Helpdesk</span></div>
        </div>
        <div class="facts">12 km <em>Nouméa</em> · <em>CDI</em> · <em>280 – 320 k XPF</em></div>
        <div class="acts2"><span>↺</span><span>✕</span><span>☆</span><span class="y">♥</span></div>
      </div>
      <div class="btns"><button class="pick" data-da-pick="c">Choisir cette direction</button></div>
    </div>

  </div>

  <p style="margin-top:30px;font-size:14px;color:#46536A">
    Le raisonnement derrière ces trois pistes et les règles du système de design
    sont dans le wiki : <a href="../design.php" style="color:#17356B;font-weight:600">page Design</a>.
  </p>
</div>

<script>
(function () {
  var actuel = 'a';
  try { actuel = localStorage.getItem('aj.da') || 'a'; } catch (e) {}
  function maj() {
    var bs = document.querySelectorAll('[data-da-pick]');
    for (var i = 0; i < bs.length; i++) {
      var on = bs[i].dataset.daPick === actuel;
      bs[i].classList.toggle('actif', on);
      bs[i].textContent = on ? '✓ Direction retenue' : 'Choisir cette direction';
    }
  }
  var bs = document.querySelectorAll('[data-da-pick]');
  for (var i = 0; i < bs.length; i++) {
    bs[i].addEventListener('click', function () {
      actuel = this.dataset.daPick;
      try { localStorage.setItem('aj.da', actuel); } catch (e) {}
      maj();
    });
  }
  maj();
})();
</script>
</body>
</html>
