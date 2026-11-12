import { useEffect, useRef, useState, type ReactNode } from "react";

export function Screen(props: {
  title: ReactNode;
  subtitle?: ReactNode;
  onBack?: () => void;
  right?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="screen">
      <header className="topbar">
        {props.onBack && (
          <button className="iconbtn" onClick={props.onBack} aria-label="Retour">
            <Icon name="back" />
          </button>
        )}
        <div className="topbar-titles">
          <h1>{props.title}</h1>
          {props.subtitle && <p>{props.subtitle}</p>}
        </div>
        {props.right}
      </header>
      <main className="content">{props.children}</main>
      {props.footer && <footer className="footer">{props.footer}</footer>}
    </div>
  );
}

const ICONS: Record<string, string> = {
  back: "M15 5l-7 7 7 7",
  check: "M5 12.5l4.5 4.5L19 7.5",
  close: "M6 6l12 12M18 6L6 18",
  chevron: "M9 6l6 6-6 6",
  down: "M6 9l6 6 6-6",
  alert: "M12 8v5m0 3.5v.5M10.3 3.9L2.6 17.5A2 2 0 004.3 20.5h15.4a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z",
  plus: "M12 5v14M5 12h14",
  logout: "M15 4h3a2 2 0 012 2v12a2 2 0 01-2 2h-3M10 16l4-4-4-4M14 12H4",
  up: "M6 15l6-6 6 6",
  lock: "M7 10V7a5 5 0 0110 0v3M6 10h12a1 1 0 011 1v8a1 1 0 01-1 1H6a1 1 0 01-1-1v-8a1 1 0 011-1z",
  info: "M12 11v6m0-9.5v.5M12 21a9 9 0 110-18 9 9 0 010 18z",
  clock: "M12 7v5l3 2M12 21a9 9 0 110-18 9 9 0 010 18z",
};

export function Icon({ name, size = 24 }: { name: keyof typeof ICONS | string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={ICONS[name]} />
    </svg>
  );
}

export function Btn(props: {
  children: ReactNode;
  onClick?: () => void;
  kind?: "primary" | "secondary" | "danger" | "ghost" | "success";
  disabled?: boolean;
  small?: boolean;
  block?: boolean;
  /** Bouton d'envoi d'un formulaire. */
  submit?: boolean;
}) {
  const cls = ["btn", `btn-${props.kind ?? "primary"}`, props.small && "btn-small", props.block && "btn-block"]
    .filter(Boolean)
    .join(" ");
  return (
    <button type={props.submit ? "submit" : "button"} className={cls} onClick={props.onClick} disabled={props.disabled}>
      {props.children}
    </button>
  );
}

/** Bouton en deux temps pour les actions irréversibles : un premier appui demande confirmation. */
export function ConfirmBtn(props: { children: ReactNode; confirm: string; onConfirm: () => void; small?: boolean }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <Btn
      kind={armed ? "danger" : "ghost"}
      small={props.small}
      onClick={() => {
        if (armed) props.onConfirm();
        setArmed(!armed);
      }}
    >
      {armed ? props.confirm : props.children}
    </Btn>
  );
}

export function Modal(props: { title: ReactNode; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && props.onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  return (
    <div className="modal-backdrop" onClick={props.onClose}>
      <div className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>{props.title}</h2>
          <button className="iconbtn dark" onClick={props.onClose} aria-label="Fermer">
            <Icon name="close" />
          </button>
        </div>
        <div className="modal-body">{props.children}</div>
      </div>
    </div>
  );
}

export function ProgressBar({ ratio }: { ratio: number }) {
  const pct = Math.round(Math.min(1, Math.max(0, ratio)) * 100);
  return (
    <div className="progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div className="progress-fill" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Toggle(props: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode }) {
  return (
    <label className="toggle">
      <input type="checkbox" checked={props.checked} onChange={(e) => props.onChange(e.target.checked)} />
      <span className="toggle-track" aria-hidden="true" />
      <span className="toggle-label">{props.label}</span>
    </label>
  );
}

export function Field(props: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="field">
      <span className="field-label">{props.label}</span>
      {props.children}
      {props.hint && <span className="field-hint">{props.hint}</span>}
    </label>
  );
}

/**
 * Pavé numérique pour le code PIN à 4 chiffres.
 * onComplete renvoie null si le code est accepté, sinon le message d'erreur à afficher.
 */
export function PinPad(props: { onComplete: (pin: string) => string | null | Promise<string | null>; length?: number }) {
  const length = props.length ?? 4;
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const press = (digit: string) => {
    if (busy || pin.length >= length) return;
    const next = pin + digit;
    setError("");
    setPin(next);
    if (next.length === length) {
      setBusy(true);
      setTimeout(async () => {
        const message = await props.onComplete(next);
        setBusy(false);
        if (message) {
          setError(message);
          setPin("");
        }
      }, 120);
    }
  };

  return (
    <div className="pinpad">
      <div className={`pin-dots${error ? " shake" : ""}`} aria-label={`${pin.length} chiffres saisis`}>
        {Array.from({ length }, (_, i) => (
          <span key={i} className={i < pin.length ? "dot on" : "dot"} />
        ))}
      </div>
      <p className="pin-error" role="alert">
        {error || (busy ? "Vérification…" : "\u00a0")}
      </p>
      <div className="pin-keys">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <button key={d} type="button" className="pin-key" onClick={() => press(d)}>
            {d}
          </button>
        ))}
        <span />
        <button type="button" className="pin-key" onClick={() => press("0")}>
          0
        </button>
        <button
          type="button"
          className="pin-key pin-del"
          onClick={() => !busy && setPin(pin.slice(0, -1))}
          aria-label="Effacer"
        >
          ⌫
        </button>
      </div>
    </div>
  );
}

/** Zone de signature au doigt. Renvoie une image PNG (data URL), ou "" si effacée. */
export function SignaturePad({ onChange }: { onChange: (dataUrl: string) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [empty, setEmpty] = useState(true);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.round(rect.width * ratio);
    canvas.height = Math.round(rect.height * ratio);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.6;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#0c2a38";
  }, []);

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  return (
    <div className="signature">
      <canvas
        ref={ref}
        className="signature-canvas"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          drawing.current = true;
          const ctx = e.currentTarget.getContext("2d");
          const p = point(e);
          ctx?.beginPath();
          ctx?.moveTo(p.x, p.y);
          ctx?.lineTo(p.x + 0.1, p.y + 0.1);
          ctx?.stroke();
        }}
        onPointerMove={(e) => {
          if (!drawing.current) return;
          const ctx = e.currentTarget.getContext("2d");
          const p = point(e);
          ctx?.lineTo(p.x, p.y);
          ctx?.stroke();
        }}
        onPointerUp={(e) => {
          if (!drawing.current) return;
          drawing.current = false;
          setEmpty(false);
          onChange(e.currentTarget.toDataURL("image/png"));
        }}
      />
      {empty && <span className="signature-hint">Signe ici avec ton doigt</span>}
      {!empty && (
        <button
          type="button"
          className="signature-clear"
          onClick={() => {
            const canvas = ref.current;
            const ctx = canvas?.getContext("2d");
            if (canvas && ctx) {
              ctx.save();
              ctx.setTransform(1, 0, 0, 1, 0, 0);
              ctx.clearRect(0, 0, canvas.width, canvas.height);
              ctx.restore();
            }
            setEmpty(true);
            onChange("");
          }}
        >
          Effacer
        </button>
      )}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="empty">{children}</p>;
}
