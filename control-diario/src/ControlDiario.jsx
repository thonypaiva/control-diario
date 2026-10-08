import { useEffect, useMemo, useRef, useState } from "react";

const STORAGE_KEY = "controlDiario.v1";

const fmt = new Intl.NumberFormat("es-PE", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const money = (n) => (n < 0 ? "-" : "") + "S/ " + fmt.format(Math.abs(n));

const toNum = (v) => {
  const n = parseFloat(String(v).replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : 0;
};

const pad = (n) => (n < 10 ? "0" : "") + n;
const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseISO = (s) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const profit = (r) => r.gen - r.recarga - r.gas - r.mant;
const longDate = (s) =>
  parseISO(s).toLocaleDateString("es-PE", { weekday: "long", day: "numeric", month: "long" });

function loadRecords() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const data = raw ? JSON.parse(raw) : {};
    return data && typeof data === "object" && !Array.isArray(data) ? data : {};
  } catch {
    return {};
  }
}

const EMPTY = { gen: "", recarga: "", gas: "", mant: "" };

/* ---------- Paletas ---------- */
const SETTINGS_KEY = "controlDiario.ajustes.v1";

const PALETAS = [
  {
    id: "carretera",
    nombre: "Carretera",
    nota: "Gris azulado y esmeralda. Sigue el modo claro/oscuro de tu celular.",
    v: {
      "color-scheme": "light",
      bg: "#eef1f4", panel: "#ffffff", ink: "#13202c", muted: "#5d6b78", line: "#d7dde3",
      gain: "#0b7a55", "gain-soft": "#d9f0e6", loss: "#b3261e",
      recarga: "#2f6fdb", gas: "#e08a00", mant: "#7a5af8", focus: "#13202c",
    },
    oscuro: {
      "color-scheme": "dark",
      bg: "#0f171f", panel: "#17222d", ink: "#e8eef4", muted: "#94a4b3", line: "#2a3947",
      gain: "#4cd39b", "gain-soft": "#12382c", loss: "#ff8a80",
      recarga: "#6ea1ff", gas: "#ffb23d", mant: "#a994ff", focus: "#e8eef4",
    },
  },
  {
    id: "matcha",
    nombre: "Matcha",
    nota: "Verdes salvia y té, calmados y naturales.",
    v: {
      "color-scheme": "light",
      bg: "#e8eee1", panel: "#f6f9f2", ink: "#26301f", muted: "#586650", line: "#cdd8c1",
      gain: "#3f6b30", "gain-soft": "#d6e7ca", loss: "#a83f2c",
      recarga: "#4f7f9c", gas: "#bf8a22", mant: "#86689f", focus: "#26301f",
    },
  },
  {
    id: "mocha",
    nombre: "Mocha",
    nota: "Marrones café con leche, cálidos y sobrios.",
    v: {
      "color-scheme": "light",
      bg: "#efe6df", panel: "#faf5f1", ink: "#3b2a22", muted: "#6e5a4f", line: "#dccdc2",
      gain: "#566b2c", "gain-soft": "#e3e6c9", loss: "#b23a2e",
      recarga: "#4a78a6", gas: "#c97b1f", mant: "#9a5f86", focus: "#3b2a22",
    },
  },
  {
    id: "lavanda",
    nombre: "Lavanda",
    nota: "Lila digital con acentos suaves.",
    v: {
      "color-scheme": "light",
      bg: "#ece9f7", panel: "#f8f6ff", ink: "#241d3d", muted: "#5f5983", line: "#d6d0ec",
      gain: "#5b3fd0", "gain-soft": "#e0d9fa", loss: "#c0392b",
      recarga: "#2f78c4", gas: "#d9822b", mant: "#c04b9b", focus: "#241d3d",
    },
  },
  {
    id: "noche",
    nombre: "Medianoche",
    nota: "Fondo azul muy oscuro con verde menta eléctrico. Ideal para manejar de noche.",
    v: {
      "color-scheme": "dark",
      bg: "#0b1020", panel: "#141b30", ink: "#e9edf8", muted: "#98a3c0", line: "#263050",
      gain: "#3ee6c3", "gain-soft": "#0f3a3a", loss: "#ff7a85",
      recarga: "#6aa8ff", gas: "#ffc24d", mant: "#b79bff", focus: "#e9edf8",
    },
  },
];

const toVars = (v) =>
  Object.entries(v)
    .map(([k, val]) => (k === "color-scheme" ? `color-scheme:${val};` : `--${k}:${val};`))
    .join("");

const PALETA_CSS =
  PALETAS.map((p) => `.cd-root[data-palette="${p.id}"]{${toVars(p.v)}}`).join("\n") +
  "\n" +
  PALETAS.filter((p) => p.oscuro)
    .map(
      (p) =>
        `@media (prefers-color-scheme: dark){.cd-root[data-palette="${p.id}"]{${toVars(p.oscuro)}}}`
    )
    .join("\n");

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    const s = raw ? JSON.parse(raw) : {};
    const nombre = typeof s.nombre === "string" ? s.nombre.slice(0, 30) : "";
    const paleta = PALETAS.some((p) => p.id === s.paleta) ? s.paleta : "carretera";
    return { nombre, paleta };
  } catch {
    return { nombre: "", paleta: "carretera" };
  }
}

export default function ControlDiario() {
  const [records, setRecords] = useState(loadRecords);
  const [fecha, setFecha] = useState(() => toISO(new Date()));
  const [form, setForm] = useState(EMPTY);
  const [period, setPeriod] = useState("semana");
  const [toast, setToast] = useState("");
  const [backup, setBackup] = useState("");
  const [ajustes, setAjustes] = useState(loadSettings);
  const [panelAjustes, setPanelAjustes] = useState(false);
  const toastTimer = useRef(null);

  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(ajustes));
    } catch {
      /* sin almacenamiento disponible */
    }
  }, [ajustes]);

  // Guardar en el navegador cada vez que cambian los registros
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    } catch {
      /* sin almacenamiento disponible */
    }
    setBackup(JSON.stringify(records));
  }, [records]);

  // Cargar el formulario cuando cambia el día
  useEffect(() => {
    const r = records[fecha];
    setForm(
      r
        ? {
            gen: r.gen ? String(r.gen) : "",
            recarga: r.recarga ? String(r.recarga) : "",
            gas: r.gas ? String(r.gas) : "",
            mant: r.mant ? String(r.mant) : "",
          }
        : EMPTY
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fecha]);

  const showToast = (msg) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2200);
  };

  const current = useMemo(
    () => ({
      gen: toNum(form.gen),
      recarga: toNum(form.recarga),
      gas: toNum(form.gas),
      mant: toNum(form.mant),
    }),
    [form]
  );

  const ganancia = profit(current);
  const existe = Boolean(records[fecha]);
  const esHoy = fecha === toISO(new Date());

  const barTotal = Math.max(current.gen, current.recarga + current.gas + current.mant);
  const barParts = [
    ["var(--recarga)", current.recarga],
    ["var(--gas)", current.gas],
    ["var(--mant)", current.mant],
    ["var(--gain)", Math.max(ganancia, 0)],
  ];

  const stats = useMemo(() => {
    const d = parseISO(fecha);
    let from, to, title;
    if (period === "semana") {
      const dow = (d.getDay() + 6) % 7; // lunes = 0
      const s = new Date(d.getFullYear(), d.getMonth(), d.getDate() - dow);
      const e = new Date(s.getFullYear(), s.getMonth(), s.getDate() + 6);
      from = toISO(s);
      to = toISO(e);
      title = "Ganancia de la semana";
    } else {
      from = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`;
      to = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-31`;
      title = "Ganancia de " + d.toLocaleDateString("es-PE", { month: "long" });
    }
    const t = { gen: 0, gastos: 0, ganancia: 0, dias: 0 };
    Object.keys(records).forEach((k) => {
      if (k >= from && k <= to) {
        const r = records[k];
        t.gen += r.gen;
        t.gastos += r.recarga + r.gas + r.mant;
        t.ganancia += profit(r);
        t.dias += 1;
      }
    });
    return { ...t, title, prom: t.dias ? t.ganancia / t.dias : 0 };
  }, [records, fecha, period]);

  const historial = useMemo(
    () => Object.keys(records).sort().reverse().slice(0, 45),
    [records]
  );

  const setField = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const guardar = () => {
    if (!current.gen && !current.recarga && !current.gas && !current.mant) {
      showToast("Escribe al menos un monto");
      return;
    }
    setRecords((prev) => ({ ...prev, [fecha]: current }));
    showToast("Día guardado");
  };

  const borrar = () => {
    if (!existe) return;
    if (!window.confirm("¿Borrar el registro de este día?")) return;
    setRecords((prev) => {
      const next = { ...prev };
      delete next[fecha];
      return next;
    });
    setForm(EMPTY);
    showToast("Día borrado");
  };

  const abrirDia = (k) => {
    setFecha(k);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(backup);
      showToast("Copiado");
    } catch {
      showToast("Selecciona y copia el texto");
    }
  };

  const restaurar = () => {
    try {
      const data = JSON.parse(backup);
      if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("formato");
      const clean = {};
      Object.keys(data).forEach((k) => {
        const r = data[k];
        if (/^\d{4}-\d{2}-\d{2}$/.test(k) && r && typeof r === "object") {
          clean[k] = {
            gen: toNum(r.gen),
            recarga: toNum(r.recarga),
            gas: toNum(r.gas),
            mant: toNum(r.mant),
          };
        }
      });
      const n = Object.keys(clean).length;
      if (!window.confirm(`Se reemplazarán los datos actuales por ${n} días del texto. ¿Continuar?`)) return;
      setRecords(clean);
      showToast("Datos restaurados");
    } catch {
      showToast("El texto no tiene el formato correcto");
    }
  };

  const heroLabel = esHoy
    ? "Ganancia de hoy"
    : "Ganancia del " + parseISO(fecha).toLocaleDateString("es-PE", { day: "numeric", month: "long" });

  return (
    <div className="cd-root" data-palette={ajustes.paleta}>
      <style>{CSS}</style>
      <div className="wrap">
        <header>
          <div>
            <h1>{ajustes.nombre.trim() ? `Hola, ${ajustes.nombre.trim()}` : "Control diario"}</h1>
            {ajustes.nombre.trim() && <p className="tagline">Control diario</p>}
          </div>
          <button
            type="button"
            className="btn ghost"
            aria-expanded={panelAjustes}
            aria-controls="panel-ajustes"
            onClick={() => setPanelAjustes((v) => !v)}
          >
            Personalizar
          </button>
        </header>

        {panelAjustes && (
          <section className="panel settings" id="panel-ajustes">
            <h2>Personalizar</h2>
            <div className="field">
              <label htmlFor="nombre">Tu nombre</label>
              <input
                id="nombre"
                className="text-input"
                type="text"
                maxLength={30}
                placeholder="Escribe tu nombre"
                autoComplete="given-name"
                value={ajustes.nombre}
                onChange={(e) => setAjustes((a) => ({ ...a, nombre: e.target.value }))}
              />
            </div>
            <p className="field-title" id="paleta-titulo">Colores</p>
            <div className="palettes" role="group" aria-labelledby="paleta-titulo">
              {PALETAS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="pal"
                  aria-pressed={ajustes.paleta === p.id}
                  onClick={() => setAjustes((a) => ({ ...a, paleta: p.id }))}
                  style={{ background: p.v.bg, color: p.v.ink, borderColor: ajustes.paleta === p.id ? p.v.ink : p.v.line }}
                >
                  <span className="pal-name">{p.nombre}</span>
                  <span className="dots" aria-hidden="true">
                    <i style={{ background: p.v.gain }} />
                    <i style={{ background: p.v.recarga }} />
                    <i style={{ background: p.v.gas }} />
                    <i style={{ background: p.v.mant }} />
                  </span>
                </button>
              ))}
            </div>
            <p className="hint">{PALETAS.find((p) => p.id === ajustes.paleta)?.nota}</p>
          </section>
        )}

        <div className="daterow">
          <label htmlFor="fecha">Fecha del registro</label>
          <input
            id="fecha"
            type="date"
            value={fecha}
            onChange={(e) => e.target.value && setFecha(e.target.value)}
          />
        </div>

        <section className="hero" aria-live="polite">
          <p className="label">{heroLabel}</p>
          <p className={"amount" + (ganancia < 0 ? " neg" : "")}>{money(ganancia)}</p>
          <div className="bar" role="img" aria-label="Distribución de lo generado">
            {barTotal > 0 &&
              barParts.map(([color, value], i) => (
                <span key={i} style={{ background: color, width: `${(value / barTotal) * 100}%` }} />
              ))}
          </div>
          <div className="legend">
            <span><i style={{ background: "var(--recarga)" }} />Recarga</span>
            <span><i style={{ background: "var(--gas)" }} />Gas</span>
            <span><i style={{ background: "var(--mant)" }} />Mantenimiento</span>
            <span><i style={{ background: "var(--gain)" }} />Ganancia</span>
          </div>
        </section>

        <section className="panel">
          <h2>Registro del día</h2>
          <Campo id="gen" label="Lo que generé" value={form.gen} onChange={setField("gen")} />
          <Campo id="recarga" label="Apartado para recarga" color="var(--recarga)" value={form.recarga} onChange={setField("recarga")} />
          <Campo id="gas" label="Gas / combustible" color="var(--gas)" value={form.gas} onChange={setField("gas")} />
          <Campo id="mant" label="Ahorro de mantenimiento" color="var(--mant)" value={form.mant} onChange={setField("mant")} />
          <button className="btn" type="button" onClick={guardar}>
            {existe ? "Guardar cambios" : "Guardar día"}
          </button>
          {existe && (
            <div className="row">
              <button className="btn ghost danger" type="button" onClick={borrar}>
                Borrar este día
              </button>
            </div>
          )}
          <p className="hint">La ganancia es lo que queda después de recarga, gas y mantenimiento.</p>
        </section>

        <section className="panel">
          <div className="tabs" role="group" aria-label="Periodo">
            <button type="button" aria-pressed={period === "semana"} onClick={() => setPeriod("semana")}>Semana</button>
            <button type="button" aria-pressed={period === "mes"} onClick={() => setPeriod("mes")}>Mes</button>
          </div>
          <div className="stats">
            <div className="stat big">
              <small>{stats.title}</small>
              <b className={stats.ganancia < 0 ? "neg" : ""}>{money(stats.ganancia)}</b>
            </div>
            <div className="stat"><small>Generado</small><b>{money(stats.gen)}</b></div>
            <div className="stat"><small>Apartado</small><b>{money(stats.gastos)}</b></div>
            <div className="stat"><small>Días registrados</small><b>{stats.dias}</b></div>
            <div className="stat"><small>Promedio por día</small><b>{money(stats.prom)}</b></div>
          </div>
        </section>

        <section className="panel">
          <h2>Historial</h2>
          <ul className="list">
            {historial.length === 0 && (
              <li>
                <p className="empty">
                  Todavía no hay días guardados. Llena el registro de arriba y toca Guardar día.
                </p>
              </li>
            )}
            {historial.map((k) => {
              const r = records[k];
              const p = profit(r);
              return (
                <li key={k}>
                  <button type="button" onClick={() => abrirDia(k)}>
                    <span>
                      <span className="d">{longDate(k)}</span>
                      <br />
                      <span className="sub">
                        Generó {money(r.gen)} · apartó {money(r.recarga + r.gas + r.mant)}
                      </span>
                    </span>
                    <span className={"g" + (p < 0 ? " neg" : "")}>{money(p)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        <details>
          <summary>Copia de seguridad</summary>
          <div className="panel" style={{ marginTop: 6 }}>
            <p className="hint" style={{ marginTop: 0 }}>
              Tus datos se guardan en este navegador. Copia el texto y guárdalo (por ejemplo en notas o
              WhatsApp) por si cambias de celular o borras los datos del navegador.
            </p>
            <textarea
              aria-label="Datos en texto"
              value={backup}
              onChange={(e) => setBackup(e.target.value)}
            />
            <div className="row">
              <button className="btn ghost" type="button" onClick={copiar}>Copiar</button>
              <button className="btn ghost" type="button" onClick={restaurar}>Restaurar desde el texto</button>
            </div>
          </div>
        </details>
      </div>

      <div className={"toast" + (toast ? " show" : "")} role="status">{toast}</div>
    </div>
  );
}

function Campo({ id, label, color, value, onChange }) {
  return (
    <div className="field">
      <label htmlFor={id}>
        {color && <i style={{ background: color }} />}
        {label}
      </label>
      <div className="money">
        <span>S/</span>
        <input
          id={id}
          type="text"
          inputMode="decimal"
          placeholder="0.00"
          autoComplete="off"
          value={value}
          onChange={onChange}
        />
      </div>
    </div>
  );
}

const CSS = `
@import url("https://fonts.googleapis.com/css2?family=Schibsted+Grotesk:wght@400;500;700;800&display=swap");

${PALETA_CSS}

.cd-root {
  min-height: 100vh;
  padding-top: env(safe-area-inset-top, 0px);
  padding-bottom: env(safe-area-inset-bottom, 0px);
  background: var(--bg); color: var(--ink);
  font-family: "Schibsted Grotesk", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  font-size: 16px; line-height: 1.45; -webkit-text-size-adjust: 100%;
}
.cd-root *, .cd-root *::before, .cd-root *::after { box-sizing: border-box; }
.cd-root .wrap { max-width: 560px; margin: 0 auto; padding: 16px 16px 48px; }
.cd-root :focus-visible { outline: 3px solid var(--focus); outline-offset: 2px; }

.cd-root header { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 14px; }
.cd-root h1 { font-size: 1.35rem; margin: 0; font-weight: 800; letter-spacing: -0.01em; overflow-wrap: anywhere; }
.cd-root .tagline { margin: 0; color: var(--muted); font-size: .9rem; }
.cd-root input[type="date"] {
  font: inherit; color: var(--ink); background: var(--panel);
  border: 1.5px solid var(--line); border-radius: 10px; padding: 8px 10px; min-height: 44px;
}
.cd-root .daterow { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
.cd-root .daterow label { color: var(--muted); font-size: .95rem; }

.cd-root .settings { margin-top: 0; margin-bottom: 14px; }
.cd-root .text-input {
  width: 100%; font: inherit; font-size: 1.05rem; color: var(--ink); background: var(--bg);
  border: 1.5px solid var(--line); border-radius: 12px; padding: 12px 14px; min-height: 52px;
}
.cd-root .text-input:focus-visible { outline: none; border-color: var(--ink); }
.cd-root .field-title { font-weight: 500; margin: 14px 0 8px; }
.cd-root .palettes { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; }
.cd-root .pal {
  font: inherit; text-align: left; cursor: pointer; min-height: 64px; padding: 10px 12px;
  border: 2px solid; border-radius: 12px; display: flex; flex-direction: column; justify-content: space-between; gap: 8px;
}
.cd-root .pal[aria-pressed="true"] { box-shadow: 0 0 0 2px var(--panel), 0 0 0 4px currentColor; }
.cd-root .pal-name { font-weight: 700; }
.cd-root .dots { display: flex; gap: 6px; }
.cd-root .dots i { width: 16px; height: 16px; border-radius: 50%; display: inline-block; }

.cd-root .hero { background: var(--panel); border: 1.5px solid var(--line); border-radius: 18px; padding: 18px 18px 16px; }
.cd-root .hero .label { color: var(--muted); font-size: .95rem; margin: 0; }
.cd-root .hero .amount {
  font-size: clamp(2.6rem, 14vw, 3.6rem); font-weight: 800; letter-spacing: -0.03em; line-height: 1.05;
  margin: 4px 0 12px; font-variant-numeric: tabular-nums; color: var(--gain);
}
.cd-root .hero .amount.neg { color: var(--loss); }
.cd-root .bar { display: flex; height: 14px; border-radius: 7px; overflow: hidden; background: var(--line); }
.cd-root .bar span { display: block; height: 100%; min-width: 0; transition: width .25s ease; }
.cd-root .legend { display: flex; flex-wrap: wrap; gap: 6px 14px; margin-top: 10px; font-size: .85rem; color: var(--muted); }
.cd-root .legend i { display: inline-block; width: 10px; height: 10px; border-radius: 3px; margin-right: 5px; vertical-align: -1px; }

.cd-root .panel { background: var(--panel); border: 1.5px solid var(--line); border-radius: 18px; padding: 16px; margin-top: 14px; }
.cd-root h2 { font-size: 1.05rem; margin: 0 0 12px; font-weight: 700; }

.cd-root .field { margin-bottom: 12px; }
.cd-root .field label { display: flex; align-items: center; gap: 8px; font-weight: 500; margin-bottom: 4px; }
.cd-root .field label i { width: 10px; height: 10px; border-radius: 3px; display: inline-block; }
.cd-root .money { display: flex; align-items: center; background: var(--bg); border: 1.5px solid var(--line); border-radius: 12px; }
.cd-root .money:focus-within { border-color: var(--ink); }
.cd-root .money span { padding-left: 14px; color: var(--muted); font-weight: 500; }
.cd-root .money input {
  flex: 1; min-width: 0; font: inherit; font-size: 1.25rem; font-weight: 700; color: var(--ink);
  background: transparent; border: 0; padding: 12px 14px 12px 8px; min-height: 52px; font-variant-numeric: tabular-nums;
}
.cd-root .money input:focus-visible { outline: none; }
.cd-root .money input::placeholder { color: var(--muted); font-weight: 400; }

.cd-root .btn {
  font: inherit; font-weight: 700; border-radius: 12px; border: 0; min-height: 52px; padding: 0 18px;
  cursor: pointer; width: 100%; background: var(--ink); color: var(--bg);
}
.cd-root .btn.ghost { background: transparent; color: var(--ink); border: 1.5px solid var(--line); font-weight: 500; min-height: 44px; width: auto; }
.cd-root .btn.danger { color: var(--loss); }
.cd-root .row { display: flex; gap: 10px; margin-top: 10px; flex-wrap: wrap; }
.cd-root .hint { color: var(--muted); font-size: .9rem; margin: 8px 0 0; }

.cd-root .tabs { display: flex; gap: 6px; margin-bottom: 12px; }
.cd-root .tabs button { flex: 1; font: inherit; font-weight: 500; min-height: 44px; border-radius: 10px; border: 1.5px solid var(--line); background: transparent; color: var(--muted); cursor: pointer; }
.cd-root .tabs button[aria-pressed="true"] { background: var(--ink); color: var(--bg); border-color: var(--ink); }
.cd-root .stats { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.cd-root .stat { background: var(--bg); border-radius: 12px; padding: 10px 12px; }
.cd-root .stat small { display: block; color: var(--muted); font-size: .82rem; }
.cd-root .stat b { font-size: 1.1rem; font-variant-numeric: tabular-nums; }
.cd-root .stat.big { grid-column: 1 / -1; background: var(--gain-soft); }
.cd-root .stat.big b { color: var(--gain); font-size: 1.5rem; }
.cd-root .stat.big b.neg { color: var(--loss); }

.cd-root .list { list-style: none; margin: 0; padding: 0; }
.cd-root .list li { border-top: 1px solid var(--line); }
.cd-root .list li:first-child { border-top: 0; }
.cd-root .list button {
  width: 100%; text-align: left; font: inherit; color: var(--ink); background: transparent; border: 0;
  padding: 12px 2px; min-height: 56px; display: flex; justify-content: space-between; align-items: center; gap: 12px; cursor: pointer;
}
.cd-root .list .d { font-weight: 500; }
.cd-root .list .sub { color: var(--muted); font-size: .85rem; }
.cd-root .list .g { font-weight: 800; font-variant-numeric: tabular-nums; color: var(--gain); white-space: nowrap; }
.cd-root .list .g.neg { color: var(--loss); }
.cd-root .empty { color: var(--muted); margin: 0; }

.cd-root details { margin-top: 14px; }
.cd-root summary { cursor: pointer; font-weight: 500; color: var(--muted); min-height: 44px; display: flex; align-items: center; }
.cd-root textarea {
  width: 100%; min-height: 110px; font: .8rem/1.4 ui-monospace, Menlo, Consolas, monospace; color: var(--ink);
  background: var(--bg); border: 1.5px solid var(--line); border-radius: 12px; padding: 10px; resize: vertical;
}

.cd-root .toast {
  position: fixed; left: 50%; bottom: calc(20px + env(safe-area-inset-bottom, 0px)); transform: translate(-50%, 20px);
  background: var(--ink); color: var(--bg); padding: 12px 18px; border-radius: 12px; font-weight: 500;
  opacity: 0; pointer-events: none; transition: opacity .2s ease, transform .2s ease; max-width: 90%;
}
.cd-root .toast.show { opacity: 1; transform: translate(-50%, 0); }
@media (prefers-reduced-motion: reduce) { .cd-root * { transition: none !important; } }
`;
