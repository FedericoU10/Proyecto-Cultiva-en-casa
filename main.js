/* ==========================================================================
   CULTIVA EN CASA — LÓGICA INTERACTIVA
   Autor: Federico Moreno Villamizar (2026)
   ========================================================================== */
document.addEventListener('DOMContentLoaded', () => {

    const $ = id => document.getElementById(id);

    // ---------------------------------------------------------------
    // 1. MENÚ (hamburguesa en móvil, barra horizontal desde 768 px)
    // ---------------------------------------------------------------
    const btnMenu = $('btn-menu');
    const menu = $('menu-navegacion');
    const escritorio = window.matchMedia('(min-width: 768px)');

    function sincronizarMenu() {
        const abierto = menu.classList.contains('abierto');
        menu.setAttribute('aria-hidden', escritorio.matches || abierto ? 'false' : 'true');
        btnMenu.setAttribute('aria-expanded', String(abierto));
    }
    btnMenu.addEventListener('click', () => { menu.classList.toggle('abierto'); sincronizarMenu(); });
    document.querySelectorAll('.enlace-menu').forEach(a =>
        a.addEventListener('click', () => { menu.classList.remove('abierto'); sincronizarMenu(); }));
    escritorio.addEventListener('change', sincronizarMenu);
    sincronizarMenu();

    // Encabezado inteligente: se oculta al bajar, reaparece al subir
    const header = $('header');
    let ultimoY = window.scrollY;
    window.addEventListener('scroll', () => {
        const y = window.scrollY;
        if (!menu.classList.contains('abierto')) {
            header.style.transform = (y > ultimoY && y > 80) ? 'translateY(-100%)' : 'translateY(0)';
        }
        ultimoY = y;
    }, { passive: true });

    // ---------------------------------------------------------------
    // 2. MEDIDORES
    // ---------------------------------------------------------------
    const switchAuto = $('switch-modo');
    let enRiego = false;
    let riegosSesion = 0;

    const estadoHumedad = p => p < 30 ? 'Sequía' : p < 60 ? 'Baja' : p <= 80 ? 'Óptima' : p <= 85 ? 'Alta' : 'Encharcamiento';
    const estadoTemp = t => t < 18 ? 'Fría' : t <= 24 ? 'Óptima' : t <= 30 ? 'Cálida' : 'Calor excesivo';

    function actualizarHumedad(valor) {
        const pct = Math.max(0, Math.min(100, valor));
        $('val-humedad').textContent = pct;
        $('aguja-humedad').style.transform = `translateX(-50%) rotate(${pct / 100 * 180 - 90}deg)`;
        $('est-humedad').textContent = estadoHumedad(pct);
        $('cap-humedad').textContent = `Humedad del suelo actual: ${pct}%. ${estadoHumedad(pct)}.`;

        const alerta = $('alerta-humedad');
        if (pct < 30) {
            alerta.className = 'alerta-contenedor sequia';
            alerta.innerHTML = '⚠️ <strong>¡Alerta de sequía!</strong> Humedad crítica en el suelo (&lt;30%).';
            if (switchAuto.checked) setTimeout(() => iniciarRiego(true), 1500);
        } else if (pct > 85) {
            alerta.className = 'alerta-contenedor encharcamiento';
            alerta.innerHTML = '🌊 <strong>¡Alerta de encharcamiento!</strong> Riesgo de pudrición de raíz (&gt;85%).';
        } else {
            alerta.className = 'alerta-contenedor oculta';
            alerta.innerHTML = '';
        }
    }

    function actualizarTemperatura(valor) {
        const t = Math.max(0, Math.min(40, valor));
        $('val-temperatura').textContent = t.toFixed(1);
        $('aguja-temperatura').style.transform = `translateX(-50%) rotate(${t / 40 * 180 - 90}deg)`;
        $('est-temperatura').textContent = estadoTemp(t);
        $('cap-temperatura').textContent = `Temperatura ambiental actual: ${t.toFixed(1)} °C. ${estadoTemp(t)}.`;
    }

    actualizarHumedad(65);
    actualizarTemperatura(21.5);

    // ---------------------------------------------------------------
    // 3. RIEGO (manual o automático)
    // ---------------------------------------------------------------
    const btnRiego = $('btn-riego');

    function iniciarRiego(automatico) {
        if (enRiego) return;
        enRiego = true;
        btnRiego.disabled = true;
        btnRiego.setAttribute('aria-pressed', 'true');
        btnRiego.style.backgroundColor = '#2B6CB0';
        const etiqueta = automatico ? 'Riego automático' : 'Regando';
        let seg = 15;
        btnRiego.textContent = `🚿 ${etiqueta} (${seg}s)...`;

        const cuenta = setInterval(() => {
            seg--;
            if (seg > 0) { btnRiego.textContent = `🚿 ${etiqueta} (${seg}s)...`; return; }
            clearInterval(cuenta);
            enRiego = false;
            btnRiego.disabled = false;
            btnRiego.setAttribute('aria-pressed', 'false');
            btnRiego.style.backgroundColor = '';
            btnRiego.innerHTML = '<span class="icono-btn" aria-hidden="true">🚿</span> Activar riego manual';
            actualizarHumedad(70);
            riegosSesion++;
            if (rangoActual === 'diario') pintarEstadisticas(); // el riego cuenta en las estadísticas
        }, 1000);
    }
    btnRiego.addEventListener('click', () => iniciarRiego(false));

    // ---------------------------------------------------------------
    // 4. SIMULADOR BETA
    // ---------------------------------------------------------------
    const wifi = $('estado-wifi'), textoWifi = $('texto-wifi');
    const irAlPanel = () => $('dashboard').scrollIntoView({ behavior: 'smooth' });

    $('btn-simular-sequia').addEventListener('click', () => { actualizarHumedad(25); irAlPanel(); });
    $('btn-simular-encharcamiento').addEventListener('click', () => { actualizarHumedad(90); irAlPanel(); });
    $('btn-simular-reconexion').addEventListener('click', () => {
        wifi.className = 'estado-conexion';
        wifi.style.color = '#F6AD55';
        textoWifi.textContent = 'Leyendo sensores...';
        $('val-humedad').textContent = '--';
        $('val-temperatura').textContent = '--';
        setTimeout(() => {
            wifi.className = 'estado-conexion desconectado';
            wifi.style.color = '';
            textoWifi.textContent = 'Sensores: Desconectados';
        }, 3000);
        setTimeout(() => {
            wifi.className = 'estado-conexion en-linea';
            textoWifi.textContent = 'Sensores: En línea';
            actualizarHumedad(65);
            actualizarTemperatura(21.5);
        }, 6000);
    });

    // ---------------------------------------------------------------
    // 5. ESTADÍSTICAS (diario · semanal · mensual · anual)
    // ---------------------------------------------------------------
    // Generador pseudoaleatorio con semilla: los datos simulados no cambian al redibujar.
    const semilla = s => () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    const fmt = (d, o) => d.toLocaleDateString('es-CO', o).replace('.', '');
    const pad = n => String(n).padStart(2, '0');

    const RANGOS = {
        diario:  { titulo: 'Últimas 24 horas',  riegos: 3,    alertas: 0 },
        semanal: { titulo: 'Últimos 7 días',    riegos: 21,   alertas: 1 },
        mensual: { titulo: 'Últimos 30 días',   riegos: 90,   alertas: 3 },
        anual:   { titulo: 'Últimos 12 meses',  riegos: 1095, alertas: 14 }
    };
    const LITROS_POR_RIEGO = 6; // estimado: micro-aspersión en 12 m²

    function generar(rango) {
        const r = semilla({ diario: 1, semanal: 2, mensual: 3, anual: 4 }[rango]);
        const ahora = new Date(), p = [];

        if (rango === 'diario') {
            for (let i = 0; i < 24; i++) {
                const d = new Date(ahora - (23 - i) * 36e5), h = d.getHours();
                const ciclo = Math.sin((h - 9) * Math.PI / 12);
                const riego = [6, 12, 18].reduce((s, x) => s + Math.max(0, 8 - 4 * ((h - x + 24) % 24)), 0);
                p.push({ et: `${pad(h)}:00`, tt: `${fmt(d, { day: 'numeric', month: 'short' })}, ${pad(h)}:00`,
                    hum: 69 - 6 * ciclo + riego + (r() - .5) * 3, temp: 20.5 + 3 * ciclo + (r() - .5) * .8 });
            }
        } else if (rango === 'semanal') {
            for (let i = 0; i < 7; i++) {
                const d = new Date(ahora - (6 - i) * 864e5);
                p.push({ et: fmt(d, { weekday: 'short' }), tt: fmt(d, { weekday: 'long', day: 'numeric', month: 'short' }),
                    hum: 68 + (r() - .5) * 10, temp: 20.5 + (r() - .5) * 2.4 });
            }
        } else if (rango === 'mensual') {
            for (let i = 0; i < 30; i++) {
                const d = new Date(ahora - (29 - i) * 864e5);
                p.push({ et: String(d.getDate()), tt: fmt(d, { day: 'numeric', month: 'long' }),
                    hum: 67 + 6 * Math.sin(i / 4.5) + (r() - .5) * 4, temp: 20.5 + 1.5 * Math.sin(i / 6) + (r() - .5) * 1.4 });
            }
        } else {
            const HM = [62, 63, 68, 74, 75, 68, 62, 62, 67, 73, 75, 68];            // épocas secas y de lluvia
            const TM = [20.5, 21, 20.5, 20, 19.8, 19.6, 19.5, 19.8, 20.2, 20.2, 20, 20.2];
            for (let i = 0; i < 12; i++) {
                const d = new Date(ahora.getFullYear(), ahora.getMonth() - (11 - i), 1), m = d.getMonth();
                p.push({ et: fmt(d, { month: 'short' }), tt: fmt(d, { month: 'long', year: 'numeric' }),
                    hum: HM[m] + (r() - .5) * 2, temp: TM[m] + (r() - .5) * .6 });
            }
        }
        return p;
    }

    const media = (a, k) => a.reduce((s, x) => s + x[k], 0) / a.length;
    const extremo = (a, k, f) => a.reduce((m, x) => f(x[k], m[k]) ? x : m, a[0]);

    let rangoActual = 'diario';

    function pintarEstadisticas() {
        const cfg = RANGOS[rangoActual], pts = generar(rangoActual);
        const enRango = pts.filter(x => x.hum >= 60 && x.hum <= 80 && x.temp >= 18 && x.temp <= 24).length / pts.length * 100;
        const riegos = cfg.riegos + (rangoActual === 'diario' ? riegosSesion : 0);

        $('periodo-texto').textContent = cfg.titulo;
        $('kpis').innerHTML = [
            ['Humedad media', `${media(pts, 'hum').toFixed(0)} %`],
            ['Temperatura media', `${media(pts, 'temp').toFixed(1)} °C`],
            ['En rango óptimo', `${enRango.toFixed(0)} %`],
            ['Riegos', riegos],
            ['Agua (aprox.)', `${riegos * LITROS_POR_RIEGO} L`],
            ['Alertas', cfg.alertas]
        ].map(([t, v]) => `<div><dt>${t}</dt><dd>${v}</dd></div>`).join('');

        const seco = extremo(pts, 'hum', (a, b) => a < b), calido = extremo(pts, 'temp', (a, b) => a > b);
        let texto = `La humedad y la temperatura estuvieron en rango el ${enRango.toFixed(0)} % del periodo. ` +
            `Lo más seco fue ${seco.tt} (${seco.hum.toFixed(0)} %) y lo más cálido ${calido.tt} (${calido.temp.toFixed(1)} °C).`;
        if (enRango < 60) texto += ' Revisa los horarios de riego para acercarte al rango ideal.';
        $('lectura-estadistica').textContent = texto;

        dibujarGrafico(pts);
    }

    // ---------- Gráfica SVG responsive con tooltip ----------
    const cont = $('grafico');

    function dibujarGrafico(pts) {
        const W = Math.max(280, cont.clientWidth), H = W < 520 ? 230 : W < 900 ? 280 : 320;
        const m = { t: 12, r: W < 520 ? 36 : 44, b: 26, l: W < 520 ? 34 : 42 };
        const iw = W - m.l - m.r, ih = H - m.t - m.b, n = pts.length;
        const x = i => m.l + i * iw / (n - 1);
        const yH = v => m.t + ih * (1 - v / 100), yT = v => m.t + ih * (1 - v / 40);
        const linea = (k, f) => pts.map((q, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${f(q[k]).toFixed(1)}`).join('');

        let s = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Gráfica de humedad y temperatura: ${RANGOS[rangoActual].titulo}">`;
        s += `<rect x="${m.l}" y="${yH(80)}" width="${iw}" height="${yH(60) - yH(80)}" fill="rgba(43,108,176,.15)"/>`;
        for (let k = 0; k <= 4; k++) {
            const y = m.t + ih * k / 4;
            s += `<line x1="${m.l}" x2="${W - m.r}" y1="${y}" y2="${y}" stroke="#E2E8F0"/>` +
                 `<text x="${m.l - 6}" y="${y + 4}" text-anchor="end" font-size="11" fill="#2B6CB0">${100 - 25 * k}</text>` +
                 `<text x="${W - m.r + 6}" y="${y + 4}" font-size="11" fill="#C05621">${40 - 10 * k}</text>`;
        }
        const paso = Math.ceil(n / Math.max(2, Math.floor(iw / 46)));
        pts.forEach((q, i) => { if (i % paso === 0 || i === n - 1 && (n - 1) % paso === 0)
            s += `<text x="${x(i)}" y="${H - 8}" text-anchor="middle" font-size="11" fill="#4A5568">${q.et}</text>`; });
        s += `<path d="${linea('hum', yH)}" fill="none" stroke="#2B6CB0" stroke-width="3" stroke-linejoin="round"/>`;
        s += `<path d="${linea('temp', yT)}" fill="none" stroke="#C05621" stroke-width="3" stroke-dasharray="7 4" stroke-linejoin="round"/>`;
        s += `<g id="cruz" visibility="hidden"><line id="cruz-l" y1="${m.t}" y2="${m.t + ih}" stroke="#718096"/>` +
             `<circle id="cruz-h" r="5" fill="#2B6CB0" stroke="#fff" stroke-width="2"/><circle id="cruz-t" r="5" fill="#C05621" stroke="#fff" stroke-width="2"/></g></svg>`;

        cont.innerHTML = s + '<div id="tip" class="tip" hidden></div>';
        const svg = cont.querySelector('svg'), tip = $('tip'), cruz = $('cruz');

        const mostrar = e => {
            const r = svg.getBoundingClientRect();
            const px = (e.clientX - r.left) * (W / r.width);
            const i = Math.max(0, Math.min(n - 1, Math.round((px - m.l) / iw * (n - 1))));
            const q = pts[i];
            cruz.setAttribute('visibility', 'visible');
            $('cruz-l').setAttribute('x1', x(i)); $('cruz-l').setAttribute('x2', x(i));
            $('cruz-h').setAttribute('cx', x(i)); $('cruz-h').setAttribute('cy', yH(q.hum));
            $('cruz-t').setAttribute('cx', x(i)); $('cruz-t').setAttribute('cy', yT(q.temp));
            tip.hidden = false;
            tip.innerHTML = `<strong>${q.tt}</strong><br>💧 ${q.hum.toFixed(0)} %  🌡️ ${q.temp.toFixed(1)} °C`;
            const medio = tip.offsetWidth / 2;
            tip.style.left = `${Math.max(medio, Math.min(cont.clientWidth - medio, x(i) * r.width / W))}px`;
            tip.style.top = `${Math.min(yH(q.hum), yT(q.temp)) * r.height / H}px`;
        };
        const ocultar = () => { tip.hidden = true; cruz.setAttribute('visibility', 'hidden'); };
        svg.addEventListener('pointermove', mostrar);
        svg.addEventListener('pointerdown', mostrar);
        svg.addEventListener('pointerleave', ocultar);
    }

    // ---------- Pestañas (con flechas del teclado) ----------
    const tabs = [...document.querySelectorAll('.btn-tab')];
    function elegirTab(tab) {
        tabs.forEach(t => {
            const activa = t === tab;
            t.classList.toggle('activa', activa);
            t.setAttribute('aria-selected', String(activa));
            t.tabIndex = activa ? 0 : -1;
        });
        $('panel-stats').setAttribute('aria-labelledby', tab.id);
        rangoActual = tab.dataset.rango;
        pintarEstadisticas();
    }
    tabs.forEach((tab, i) => {
        tab.addEventListener('click', () => elegirTab(tab));
        tab.addEventListener('keydown', e => {
            const d = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
            if (!d) return;
            const sig = tabs[(i + d + tabs.length) % tabs.length];
            sig.focus(); elegirTab(sig);
        });
    });

    // Redibuja al cambiar el ancho del contenedor (rotar el celular, redimensionar la ventana)
    let anchoPrevio = 0;
    new ResizeObserver(() => {
        if (cont.clientWidth && cont.clientWidth !== anchoPrevio) { anchoPrevio = cont.clientWidth; pintarEstadisticas(); }
    }).observe(cont);

    pintarEstadisticas();
});
