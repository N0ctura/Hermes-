import React, { useEffect, useMemo, useRef, useState } from "react";
import {
    Activity,
    AlertCircle,
    ArrowDown,
    ArrowUp,
    ChevronDown,
    ChevronUp,
    Clock,
    Copy,
    MessageSquare,
    Plus,
    RefreshCw,
    Save,
    Settings,
    Shield,
    ShieldAlert,
    SlidersHorizontal,
    Speaker,
    Sparkles,
    Tag,
    Trash2,
    TrendingUp,
    UserPlus,
    UserMinus,
    Volume2,
    ListTodo,
    List,
    LayoutDashboard,
    Server,
    Eye,
    EyeOff,
    Type,
    Image as ImageIcon,
    User,
    Download,
    Users,
    Crown,
    Coins,
} from "lucide-react";
import Login from "./pages/Login.js";
import type {
    BotConfigDto,
    BotStatusDto,
    CardConfig,
    CardLayer,
    DeletedModifiedLogEntry,
    DiscordChannel,
    DiscordGuild,
    DiscordRole,
    GuildLogs,
    GuildTTS,
    GuildWelcomeLeave,
    ScheduledMessage,
    ClanOverviewDto,
} from "./types.js";

/* ===========================
 * HELPERS
 * =========================== */

const AUTH_KEY = "hermes-dash-auth";
const AUTH_META = "hermes-dash-needpwd";
const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

function classNames(...xs: (string | false | null | undefined)[]) {
    return xs.filter(Boolean).join(" ");
}

function formatUptime(s: number) {
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (d > 0) return `${d}d ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m ${sec}s`;
    if (m > 0) return `${m}m ${sec}s`;
    return `${sec}s`;
}

/* Default card templates */
const DEFAULT_WELCOME_CARD: CardConfig = {
    width: 1440,
    height: 720,
    layers: [
        {
            id: uid(),
            type: "background",
            visible: true,
            x: 0,
            y: 0,
            width: 1440,
            height: 720,
            url: "/assets/benvenutocelestial.png",
            color: "#201A13",
            borderWidth: 0,
        },
        {
            id: uid(),
            type: "avatar",
            visible: true,
            x: 116,
            y: 203,
            width: 314,
            height: 314,
            borderRadius: 157,
            borderWidth: 8,
            borderColor: "#C9A227",
        },
        {
            id: uid(),
            type: "text",
            visible: true,
            x: 470,
            y: 250,
            width: 900,
            height: 80,
            text: "Benvenuto/a {USERNAME}!",
            fontSize: 60,
            fontWeight: "bold",
            color: "#ffffff",
            textAlign: "left",
        },
        {
            id: uid(),
            type: "text",
            visible: true,
            x: 470,
            y: 350,
            width: 900,
            height: 54,
            text: "Ora siamo in {MEMBER_COUNT} membri 🔥",
            fontSize: 32,
            color: "#E8DFC7",
            textAlign: "left",
        },
    ],
};

const DEFAULT_LEAVE_CARD: CardConfig = {
    width: 1440,
    height: 720,
    layers: [
        {
            id: uid(),
            type: "background",
            visible: true,
            x: 0,
            y: 0,
            width: 1440,
            height: 720,
            url: "/assets/arrivedercicelestial.png",
            color: "#201A13",
            borderWidth: 0,
            grayscale: false,
        },
        {
            id: uid(),
            type: "avatar",
            visible: true,
            x: 116,
            y: 203,
            width: 314,
            height: 314,
            borderRadius: 157,
            borderWidth: 8,
            borderColor: "#B0303F",
        },
        {
            id: uid(),
            type: "text",
            visible: true,
            x: 470,
            y: 250,
            width: 900,
            height: 80,
            text: "Arrivederci {USERNAME}",
            fontSize: 60,
            fontWeight: "bold",
            color: "#ffffff",
            textAlign: "left",
        },
        {
            id: uid(),
            type: "text",
            visible: true,
            x: 470,
            y: 350,
            width: 900,
            height: 54,
            text: "Il clan ti ricorderà ❤️",
            fontSize: 32,
            color: "#E8DFC7",
            textAlign: "left",
        },
    ],
};

/* ===========================
 * API CALLS
 * =========================== */

async function apiCall<T = any>(url: string, init?: RequestInit): Promise<T> {
    const auth = localStorage.getItem(AUTH_KEY) || "";
    const res = await fetch(url, {
        ...init,
        headers: {
            "Content-Type": "application/json",
            ...(auth ? { Authorization: `Bearer ${auth}` } : {}),
            ...(init?.headers || {}),
        },
    });
    if (res.status === 401) {
        localStorage.removeItem(AUTH_KEY);
        localStorage.removeItem(AUTH_META);
        window.dispatchEvent(new Event("hermes-logout"));
    }
    if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try {
            msg = (await res.json())?.error || msg;
        } catch {
            /* empty */
        }
        throw new Error(msg);
    }
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
}

/* ===========================
 * CANVAS EDITOR COMPONENT
 * =========================== */

interface CanvasEditorProps {
    card: CardConfig;
    onChange: (c: CardConfig) => void;
    type: "welcome" | "leave";
}

const PREVIEW_AVATAR =
    "https://i.pravatar.cc/300?img=15";

const CanvasEditor: React.FC<CanvasEditorProps> = ({ card, onChange, type }) => {
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [drag, setDrag] = useState<null | {
        id: string;
        startX: number;
        startY: number;
        origX: number;
        origY: number;
    }>(null);
    const [resize, setResize] = useState<null | {
        id: string;
        handle: string;
        startX: number;
        startY: number;
        orig: { x: number; y: number; w: number; h: number };
    }>(null);
    const wrapRef = useRef<HTMLDivElement>(null);
    const scaleRef = useRef<number>(1);

    const selectedLayer = card.layers.find((l) => l.id === selectedId) || null;

    const drawCanvas = React.useCallback(() => {
        const wrap = wrapRef.current;
        if (!wrap) return;
        const canvas = wrap.querySelector("canvas") as HTMLCanvasElement | null;
        if (!canvas) return;
        const dpr = window.devicePixelRatio || 1;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        canvas.width = card.width * dpr;
        canvas.height = card.height * dpr;
        // Non impostiamo canvas.style.width/height in px fissi: lo fa il CSS
        // (width 100% + aspectRatio) cosi' il canvas resta responsive e non
        // si "schiaccia" quando il contenitore e' piu' stretto di card.width.
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, card.width, card.height);

        const drawRoundedRect = (
            x: number,
            y: number,
            w: number,
            h: number,
            r: number
        ) => {
            const radius = Math.min(r, w / 2, h / 2);
            ctx.beginPath();
            ctx.moveTo(x + radius, y);
            ctx.arcTo(x + w, y, x + w, y + h, radius);
            ctx.arcTo(x + w, y + h, x, y + h, radius);
            ctx.arcTo(x, y + h, x, y, radius);
            ctx.arcTo(x, y, x + w, y, radius);
            ctx.closePath();
        };

        const applyGrayscaleArea = (x: number, y: number, w: number, h: number) => {
            try {
                const imgData = ctx.getImageData(x, y, w, h);
                const data = imgData.data;
                for (let i = 0; i < data.length; i += 4) {
                    const g = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
                    data[i] = g;
                    data[i + 1] = g;
                    data[i + 2] = g;
                }
                ctx.putImageData(imgData, x, y);
            } catch {
                /* empty */
            }
        };

        function drawImageOrFallback(
            url: string | undefined,
            fallbackColor: string | undefined,
            x: number,
            y: number,
            w: number,
            h: number,
            layerId: string,
            needGrayscale: boolean
        ) {
            if (url) {
                try {
                    const cacheId = `_hermes_${layerId}_${btoa(url).slice(-16)}`;
                    let img = document.getElementById(cacheId) as HTMLImageElement | null;
                    if (!img) {
                        img = new Image();
                        img.id = cacheId;
                        img.crossOrigin = "anonymous";
                        img.onload = () => drawCanvas();
                        img.style.display = "none";
                        document.body.appendChild(img);
                        try {
                            img.src = url;
                        } catch {
                            /* empty */
                        }
                    }
                    if (img && img.complete && img.naturalWidth > 0) {
                        ctx.drawImage(img, x, y, w, h);
                        if (needGrayscale) applyGrayscaleArea(x, y, w, h);
                        return true;
                    }
                    ctx.fillStyle = fallbackColor || "#2A2116";
                    ctx.fillRect(x, y, w, h);
                    ctx.fillStyle = "#A8967A";
                    ctx.font = "16px sans-serif";
                    ctx.textAlign = "center";
                    ctx.fillText(
                        "Caricamento immagine...",
                        x + w / 2,
                        y + h / 2
                    );
                    return true;
                } catch {
                    /* fallthrough to color */
                }
            }
            ctx.fillStyle = fallbackColor || "#201A13";
            ctx.fillRect(x, y, w, h);
            return false;
        }

        for (const layer of card.layers) {
            if (!layer.visible) continue;
            ctx.save();
            if (layer.type === "background" || layer.type === "image" || layer.type === "avatar") {
                const url = layer.type === "avatar" ? PREVIEW_AVATAR : layer.url;
                const radius = layer.borderRadius ?? 0;
                const fallbackColor =
                    layer.type === "avatar" ? "#2A2116" : layer.color;
                drawRoundedRect(layer.x, layer.y, layer.width, layer.height, radius);
                ctx.clip();
                drawImageOrFallback(
                    url,
                    fallbackColor,
                    layer.x,
                    layer.y,
                    layer.width,
                    layer.height,
                    layer.id,
                    type === "leave" || !!layer.grayscale
                );
                ctx.restore();
                ctx.save();
                if ((layer.borderWidth ?? 0) > 0) {
                    ctx.strokeStyle = layer.borderColor || "#C9A227";
                    ctx.lineWidth = layer.borderWidth ?? 0;
                    const inset = (layer.borderWidth ?? 0) / 2;
                    const innerR = Math.max(0, radius - inset);
                    drawRoundedRect(
                        layer.x + inset,
                        layer.y + inset,
                        layer.width - (layer.borderWidth ?? 0),
                        layer.height - (layer.borderWidth ?? 0),
                        innerR
                    );
                    ctx.stroke();
                }
            } else if (layer.type === "text") {
                const fs = layer.fontSize ?? 24;
                ctx.fillStyle = layer.color || "#ffffff";
                const weight = layer.fontWeight === "bold" ? 700 : 400;
                ctx.font = `${weight} ${fs}px ui-sans-serif, system-ui, sans-serif`;
                ctx.textBaseline = "middle";
                ctx.textAlign = (layer.textAlign as CanvasTextAlign) || "left";
                let text = layer.text || "";
                text = text.replaceAll("{USERNAME}", "MarioRossi");
                text = text.replaceAll("{SERVER_NAME}", "Tempio di Olimpo");
                text = text.replaceAll("{MEMBER_COUNT}", "420");
                const lines = text.split("\n");
                const lineH = Math.round(fs * 1.3);
                const totalH = lines.length * lineH;
                const baseY = layer.y + Math.max(0, (layer.height - totalH) / 2) + lineH / 2;
                let x = layer.x;
                if (layer.textAlign === "center") x = layer.x + layer.width / 2;
                if (layer.textAlign === "right") x = layer.x + layer.width;
                lines.forEach((ln, idx) => {
                    ctx.fillText(ln, x, baseY + idx * lineH);
                });
            }
            ctx.restore();
        }
    }, [card]);

    useEffect(() => {
        drawCanvas();
    }, [drawCanvas]);

    const getPos = (e: React.MouseEvent | MouseEvent) => {
        const wrap = wrapRef.current;
        if (!wrap) return { x: 0, y: 0 };
        const rect = wrap.getBoundingClientRect();
        const canvas = wrap.querySelector("canvas") as HTMLCanvasElement | null;
        const cRect = canvas?.getBoundingClientRect() || rect;
        const dpr = window.devicePixelRatio || 1;
        const scaleX = canvas ? canvas.width / dpr / cRect.width : 1;
        const scaleY = canvas ? canvas.height / dpr / cRect.height : 1;
        scaleRef.current = scaleX;
        return {
            x: (e.clientX - cRect.left) * scaleX,
            y: (e.clientY - cRect.top) * scaleY,
        };
    };

    useEffect(() => {
        const onMove = (e: MouseEvent) => {
            if (!drag && !resize) return;
            const { x, y } = getPos(e as any);
            if (drag) {
                const dx = x - drag.startX;
                const dy = y - drag.startY;
                const newLayers = card.layers.map((l) =>
                    l.id === drag.id ? { ...l, x: Math.round(drag.origX + dx), y: Math.round(drag.origY + dy) } : l
                );
                onChange({ ...card, layers: newLayers });
            } else if (resize) {
                const dx = x - resize.startX;
                const dy = y - resize.startY;
                let { x: nx, y: ny, w: nw, h: nh } = resize.orig;
                const h = resize.handle;
                if (h.includes("e")) nw = Math.max(10, resize.orig.w + dx);
                if (h.includes("s")) nh = Math.max(10, resize.orig.h + dy);
                if (h.includes("w")) {
                    nw = Math.max(10, resize.orig.w - dx);
                    nx = resize.orig.x + (resize.orig.w - nw);
                }
                if (h.includes("n")) {
                    nh = Math.max(10, resize.orig.h - dy);
                    ny = resize.orig.y + (resize.orig.h - nh);
                }
                const newLayers = card.layers.map((l) =>
                    l.id === resize.id
                        ? { ...l, x: Math.round(nx), y: Math.round(ny), width: Math.round(nw), height: Math.round(nh) }
                        : l
                );
                onChange({ ...card, layers: newLayers });
            }
        };
        const onUp = () => {
            setDrag(null);
            setResize(null);
        };
        if (drag || resize) {
            window.addEventListener("mousemove", onMove);
            window.addEventListener("mouseup", onUp);
            return () => {
                window.removeEventListener("mousemove", onMove);
                window.removeEventListener("mouseup", onUp);
            };
        }
    }, [drag, resize, card, onChange]);

    const addLayer = (type: CardLayer["type"]) => {
        const base: CardLayer = {
            id: uid(),
            type,
            visible: true,
            x: 80,
            y: 80,
            width: type === "background" ? card.width : type === "text" ? 300 : 180,
            height: type === "background" ? card.height : type === "text" ? 50 : 180,
        };
        if (type === "text") {
            base.text = "Testo...";
            base.fontSize = 32;
            base.color = "#ffffff";
            base.fontWeight = "normal";
            base.textAlign = "left";
        }
        if (type === "background") {
            base.color = "#201A13";
        }
        onChange({ ...card, layers: [...card.layers, base] });
        setSelectedId(base.id);
    };

    const updateLayer = (id: string, patch: Partial<CardLayer>) => {
        const newLayers = card.layers.map((l) => (l.id === id ? { ...l, ...patch } : l));
        onChange({ ...card, layers: newLayers });
    };

    const moveLayer = (id: string, dir: "up" | "down") => {
        const idx = card.layers.findIndex((l) => l.id === id);
        if (idx < 0) return;
        const arr = [...card.layers];
        const target = dir === "up" ? idx + 1 : idx - 1;
        if (target < 0 || target >= arr.length) return;
        [arr[idx], arr[target]] = [arr[target], arr[idx]];
        onChange({ ...card, layers: arr });
    };

    const duplicateLayer = (id: string) => {
        const l = card.layers.find((x) => x.id === id);
        if (!l) return;
        const copy: CardLayer = { ...l, id: uid(), x: l.x + 20, y: l.y + 20 };
        const idx = card.layers.findIndex((x) => x.id === id);
        const arr = [...card.layers];
        arr.splice(idx + 1, 0, copy);
        onChange({ ...card, layers: arr });
        setSelectedId(copy.id);
    };

    const deleteLayer = (id: string) => {
        onChange({ ...card, layers: card.layers.filter((l) => l.id !== id) });
        if (selectedId === id) setSelectedId(null);
    };

    const exportPNG = () => {
        const wrap = wrapRef.current;
        const canvas = wrap?.querySelector("canvas") as HTMLCanvasElement | null;
        if (!canvas) return;
        const a = document.createElement("a");
        a.download = `${type}-card.png`;
        a.href = canvas.toDataURL("image/png");
        a.click();
    };

    return (
        <div className="grid grid-cols-[1fr_320px] gap-4">
            {/* Preview */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <ImageIcon className="w-4 h-4 text-neutral-400" />
                        <span className="text-xs font-semibold text-neutral-300 uppercase tracking-wide">
                            Anteprima {type === "welcome" ? "Welcome" : "Leave"}
                        </span>
                    </div>
                    <button
                        onClick={exportPNG}
                        className="text-xs px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 inline-flex items-center gap-1.5"
                    >
                        <Download className="w-3.5 h-3.5" /> Esporta PNG
                    </button>
                </div>
                <div
                    ref={wrapRef}
                    className="rounded-xl overflow-auto p-2 bg-[#0D0906] flex justify-center border border-neutral-800"
                    style={{ maxHeight: 620 }}
                >
                    <div className="relative">
                        <canvas
                            onMouseDown={(e) => {
                                const { x, y } = getPos(e);
                                const arr = [...card.layers].reverse();
                                let hit: CardLayer | null = null;
                                for (const l of arr) {
                                    if (!l.visible) continue;
                                    if (x >= l.x && x <= l.x + l.width && y >= l.y && y <= l.y + l.height) {
                                        hit = l;
                                        break;
                                    }
                                }
                                if (hit) {
                                    setSelectedId(hit.id);
                                    setDrag({
                                        id: hit.id,
                                        startX: x,
                                        startY: y,
                                        origX: hit.x,
                                        origY: hit.y,
                                    });
                                } else {
                                    setSelectedId(null);
                                }
                            }}
                            style={{
                                width: "100%",
                                maxWidth: card.width,
                                aspectRatio: `${card.width} / ${card.height}`,
                                height: "auto",
                                display: "block",
                                background: "#000",
                                borderRadius: 12,
                                cursor: drag || resize ? "grabbing" : "default",
                            }}
                        />
                        {/* selection overlay */}
                        {selectedLayer && selectedLayer.visible && (
                            <>
                                <div
                                    style={{
                                        position: "absolute",
                                        left: `${(selectedLayer.x / card.width) * 100}%`,
                                        top: `${(selectedLayer.y / card.height) * 100}%`,
                                        width: `${(selectedLayer.width / card.width) * 100}%`,
                                        height: `${(selectedLayer.height / card.height) * 100}%`,
                                        border: "2px dashed #C9A227",
                                        pointerEvents: "none",
                                        boxSizing: "border-box",
                                    }}
                                />
                                {["nw", "n", "ne", "e", "se", "s", "sw", "w"].map((h) => {
                                    const pos: Record<string, React.CSSProperties> = {
                                        nw: { left: -6, top: -6, cursor: "nw-resize" },
                                        n: { left: "calc(50% - 6px)", top: -6, cursor: "n-resize" },
                                        ne: { right: -6, top: -6, cursor: "ne-resize" },
                                        e: { right: -6, top: "calc(50% - 6px)", cursor: "e-resize" },
                                        se: { right: -6, bottom: -6, cursor: "se-resize" },
                                        s: { left: "calc(50% - 6px)", bottom: -6, cursor: "s-resize" },
                                        sw: { left: -6, bottom: -6, cursor: "sw-resize" },
                                        w: { left: -6, top: "calc(50% - 6px)", cursor: "w-resize" },
                                    };
                                    return (
                                        <div
                                            key={h}
                                            onMouseDown={(e) => {
                                                e.stopPropagation();
                                                const { x, y } = getPos(e as any);
                                                setResize({
                                                    id: selectedLayer.id,
                                                    handle: h,
                                                    startX: x,
                                                    startY: y,
                                                    orig: {
                                                        x: selectedLayer.x,
                                                        y: selectedLayer.y,
                                                        w: selectedLayer.width,
                                                        h: selectedLayer.height,
                                                    },
                                                });
                                            }}
                                            style={{
                                                position: "absolute",
                                                width: 12,
                                                height: 12,
                                                background: "#C9A227",
                                                border: "2px solid #fff",
                                                borderRadius: 3,
                                                pointerEvents: "auto",
                                                ...pos[h],
                                            }}
                                        />
                                    );
                                })}
                            </>
                        )}
                    </div>
                </div>

                <div className="mt-4 grid grid-cols-4 gap-2">
                    <button
                        onClick={() => addLayer("text")}
                        className="p-3 bg-neutral-800 hover:bg-neutral-700 rounded-xl border border-neutral-700 inline-flex flex-col items-center gap-1.5 text-xs text-neutral-200"
                    >
                        <Type className="w-4 h-4" /> Testo
                    </button>
                    <button
                        onClick={() => addLayer("image")}
                        className="p-3 bg-neutral-800 hover:bg-neutral-700 rounded-xl border border-neutral-700 inline-flex flex-col items-center gap-1.5 text-xs text-neutral-200"
                    >
                        <ImageIcon className="w-4 h-4" /> Immagine
                    </button>
                    <button
                        onClick={() => addLayer("avatar")}
                        className="p-3 bg-neutral-800 hover:bg-neutral-700 rounded-xl border border-neutral-700 inline-flex flex-col items-center gap-1.5 text-xs text-neutral-200"
                    >
                        <User className="w-4 h-4" /> Avatar
                    </button>
                    <button
                        onClick={() => addLayer("background")}
                        className="p-3 bg-neutral-800 hover:bg-neutral-700 rounded-xl border border-neutral-700 inline-flex flex-col items-center gap-1.5 text-xs text-neutral-200"
                    >
                        <LayoutDashboard className="w-4 h-4" /> Sfondo
                    </button>
                </div>

                <div className="mt-3 flex items-center gap-2">
                    <div className="flex-1">
                        <label className="text-[11px] font-bold uppercase tracking-wide text-neutral-500 block mb-1">
                            Larghezza (px)
                        </label>
                        <input
                            type="number"
                            value={card.width}
                            onChange={(e) => onChange({ ...card, width: Math.max(100, +e.target.value || 1100) })}
                            className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-neutral-100"
                        />
                    </div>
                    <div className="flex-1">
                        <label className="text-[11px] font-bold uppercase tracking-wide text-neutral-500 block mb-1">
                            Altezza (px)
                        </label>
                        <input
                            type="number"
                            value={card.height}
                            onChange={(e) => onChange({ ...card, height: Math.max(100, +e.target.value || 500) })}
                            className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-neutral-100"
                        />
                    </div>
                    <button
                        onClick={() => onChange(type === "welcome" ? JSON.parse(JSON.stringify(DEFAULT_WELCOME_CARD)) : JSON.parse(JSON.stringify(DEFAULT_LEAVE_CARD)))}
                        className="self-end px-3 py-2 text-xs bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded-lg text-neutral-200 inline-flex items-center gap-1.5"
                    >
                        <RefreshCw className="w-3.5 h-3.5" /> Ripristina
                    </button>
                </div>
            </div>

            {/* Right: layer list + selected props */}
            <div className="space-y-4">
                <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4">
                    <h3 className="text-sm font-bold text-neutral-100 mb-3 flex items-center gap-2">
                        <Layers className="w-4 h-4 text-indigo-400" /> Layer
                    </h3>
                    <div className="space-y-1.5 max-h-[260px] overflow-auto pr-1">
                        {card.layers.length === 0 && (
                            <p className="text-xs text-neutral-500 italic">Nessun layer. Aggiungine uno dal pannello a sinistra.</p>
                        )}
                        {card.layers.map((l, idx) => (
                            <div
                                key={l.id}
                                onClick={() => setSelectedId(l.id)}
                                className={classNames(
                                    "flex items-center gap-2 px-3 py-2 rounded-lg border text-xs cursor-pointer transition-colors",
                                    selectedId === l.id
                                        ? "bg-[#C9A227]/10 border-[#C9A227]/40 text-white"
                                        : "bg-neutral-800 border-neutral-800 hover:bg-neutral-700 text-neutral-300"
                                )}
                            >
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        updateLayer(l.id, { visible: !l.visible });
                                    }}
                                    className="text-neutral-400 hover:text-white"
                                >
                                    {l.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5 opacity-40" />}
                                </button>
                                <span className="shrink-0">
                                    {l.type === "text" && <Type className="w-3.5 h-3.5" />}
                                    {l.type === "image" && <ImageIcon className="w-3.5 h-3.5" />}
                                    {l.type === "avatar" && <User className="w-3.5 h-3.5" />}
                                    {l.type === "background" && <LayoutDashboard className="w-3.5 h-3.5" />}
                                </span>
                                <span className="flex-1 truncate">
                                    {l.type === "text" ? l.text?.slice(0, 26) || "Testo" : capFirst(l.type)}
                                </span>
                                <span className="text-[10px] text-neutral-500">#{idx + 1}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {selectedLayer && (
                    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 animate-slide-up">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-sm font-bold text-neutral-100">Proprietà layer</h3>
                            <div className="flex gap-1.5">
                                <button onClick={() => moveLayer(selectedLayer.id, "down")} className="p-1.5 rounded hover:bg-neutral-800 text-neutral-400" title="Porta indietro">
                                    <ArrowDown className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={() => moveLayer(selectedLayer.id, "up")} className="p-1.5 rounded hover:bg-neutral-800 text-neutral-400" title="Porta avanti">
                                    <ArrowUp className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={() => duplicateLayer(selectedLayer.id)} className="p-1.5 rounded hover:bg-neutral-800 text-neutral-400" title="Duplica">
                                    <Copy className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={() => deleteLayer(selectedLayer.id)} className="p-1.5 rounded hover:bg-rose-500/20 text-rose-400" title="Elimina">
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 mb-2">
                            <FieldNum label="X" value={selectedLayer.x} onChange={(v) => updateLayer(selectedLayer.id, { x: v })} />
                            <FieldNum label="Y" value={selectedLayer.y} onChange={(v) => updateLayer(selectedLayer.id, { y: v })} />
                            <FieldNum label="W" value={selectedLayer.width} onChange={(v) => updateLayer(selectedLayer.id, { width: v })} />
                            <FieldNum label="H" value={selectedLayer.height} onChange={(v) => updateLayer(selectedLayer.id, { height: v })} />
                        </div>

                        {selectedLayer.type === "text" && (
                            <>
                                <Field label="Testo (variabili: {USERNAME}, {SERVER_NAME}, {MEMBER_COUNT})">
                                    <textarea
                                        rows={2}
                                        value={selectedLayer.text ?? ""}
                                        onChange={(e) => updateLayer(selectedLayer.id, { text: e.target.value })}
                                        className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-neutral-100 resize-none"
                                    />
                                </Field>
                                <div className="grid grid-cols-2 gap-2">
                                    <FieldNum label="Font size" value={selectedLayer.fontSize ?? 24} onChange={(v) => updateLayer(selectedLayer.id, { fontSize: v })} />
                                    <Field label="Spessore">
                                        <select
                                            value={selectedLayer.fontWeight ?? "normal"}
                                            onChange={(e) => updateLayer(selectedLayer.id, { fontWeight: e.target.value as any })}
                                            className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-neutral-100"
                                        >
                                            <option value="normal">Normale</option>
                                            <option value="bold">Grassetto</option>
                                        </select>
                                    </Field>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <FieldColor label="Colore" value={selectedLayer.color ?? "#ffffff"} onChange={(v) => updateLayer(selectedLayer.id, { color: v })} />
                                    <Field label="Allineamento">
                                        <select
                                            value={selectedLayer.textAlign ?? "left"}
                                            onChange={(e) => updateLayer(selectedLayer.id, { textAlign: e.target.value as any })}
                                            className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-neutral-100"
                                        >
                                            <option value="left">Sinistra</option>
                                            <option value="center">Centro</option>
                                            <option value="right">Destra</option>
                                        </select>
                                    </Field>
                                </div>
                            </>
                        )}

                        {selectedLayer.type === "background" && (
                            <FieldColor label="Colore sfondo" value={selectedLayer.color ?? "#201A13"} onChange={(v) => updateLayer(selectedLayer.id, { color: v })} />
                        )}

                        {(selectedLayer.type === "image" || selectedLayer.type === "avatar") && selectedLayer.type === "image" && (
                            <Field label="URL immagine">
                                <input
                                    value={selectedLayer.url ?? ""}
                                    onChange={(e) => updateLayer(selectedLayer.id, { url: e.target.value })}
                                    placeholder="https://..."
                                    className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-neutral-100"
                                />
                            </Field>
                        )}

                        {(selectedLayer.type === "avatar" || selectedLayer.type === "image") && (
                            <>
                                <div className="grid grid-cols-3 gap-2 mt-2">
                                    <FieldNum label="Bordo px" value={selectedLayer.borderWidth ?? 0} onChange={(v) => updateLayer(selectedLayer.id, { borderWidth: v })} />
                                    <FieldColor label="Colore bordo" value={selectedLayer.borderColor ?? "#C9A227"} onChange={(v) => updateLayer(selectedLayer.id, { borderColor: v })} />
                                    <FieldNum label="Raggio" value={selectedLayer.borderRadius ?? 0} onChange={(v) => updateLayer(selectedLayer.id, { borderRadius: v })} />
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

function capFirst(s: string) {
    return s.charAt(0).toUpperCase() + s.slice(1);
}

function Layers(props: { className?: string }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={props.className}
        >
            <path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z" />
            <path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65" />
            <path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65" />
        </svg>
    );
}

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
    <div className="mb-2">
        <label className="text-[10px] font-bold uppercase tracking-wide text-neutral-500 block mb-1">{label}</label>
        {children}
    </div>
);

const FieldNum: React.FC<{ label: string; value: number; onChange: (n: number) => void }> = ({ label, value, onChange }) => (
    <div>
        <label className="text-[10px] font-bold uppercase tracking-wide text-neutral-500 block mb-1">{label}</label>
        <input
            type="number"
            value={value}
            onChange={(e) => onChange(+e.target.value || 0)}
            className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-neutral-100"
        />
    </div>
);

const FieldColor: React.FC<{ label: string; value: string; onChange: (c: string) => void }> = ({ label, value, onChange }) => (
    <div>
        <label className="text-[10px] font-bold uppercase tracking-wide text-neutral-500 block mb-1">{label}</label>
        <div className="flex items-center gap-2">
            <input
                type="color"
                value={value.startsWith("#") ? value : "#ffffff"}
                onChange={(e) => onChange(e.target.value)}
                className="w-10 h-9 bg-neutral-900 border border-neutral-800 rounded-lg cursor-pointer"
            />
            <input
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="flex-1 bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-xs font-mono text-neutral-100"
            />
        </div>
    </div>
);

/* ===========================
 * APP MAIN
 * =========================== */

type TabKey = "home" | "welcome" | "leave" | "autorole" | "messages" | "tts" | "logs" | "clan";

const TABS: { key: TabKey; label: string; icon: any }[] = [
    { key: "home", label: "Home", icon: LayoutDashboard },
    { key: "welcome", label: "Welcome", icon: UserPlus },
    { key: "leave", label: "Leave", icon: UserMinus },
    { key: "autorole", label: "Auto Role", icon: Shield },
    { key: "messages", label: "Messaggi", icon: ListTodo },
    { key: "tts", label: "TTS", icon: Volume2 },
    { key: "logs", label: "Logs", icon: Activity },
    { key: "clan", label: "Clan Wolvesville", icon: Users },
];

export default function App() {
    const [authed, setAuthed] = useState<"loading" | "no" | "yes">("loading");
    const [needPwd, setNeedPwd] = useState(true);
    const [status, setStatus] = useState<BotStatusDto | null>(null);
    const [guilds, setGuilds] = useState<DiscordGuild[]>([]);
    const [selectedGuildId, setSelectedGuildId] = useState<string>("");
    const [channels, setChannels] = useState<DiscordChannel[]>([]);
    const [roles, setRoles] = useState<DiscordRole[]>([]);
    const [tab, setTab] = useState<TabKey>("home");

    const [wlConf, setWlConf] = useState<GuildWelcomeLeave | null>(null);
    const [ttsConf, setTtsConf] = useState<GuildTTS | null>(null);
    const [logsConf, setLogsConf] = useState<GuildLogs | null>(null);
    const [scheduled, setScheduled] = useState<ScheduledMessage[]>([]);
    const [dmLogs, setDmLogs] = useState<DeletedModifiedLogEntry[]>([]);
    const [clanOverview, setClanOverview] = useState<ClanOverviewDto | null>(null);
    const [clanError, setClanError] = useState<string | null>(null);
    const [clanLoading, setClanLoading] = useState(false);

    const [toast, setToast] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(false);

    const showToast = (kind: "ok" | "err", msg: string) => {
        setToast({ kind, msg });
        window.setTimeout(() => setToast(null), 3200);
    };

    /* ---------- Auth ---------- */
    useEffect(() => {
        (async () => {
            try {
                const res = await fetch("/api/auth/meta");
                if (res.ok) {
                    const data = (await res.json()) as { needPassword: boolean };
                    setNeedPwd(data.needPassword);
                    if (!data.needPassword) {
                        setAuthed("yes");
                        return;
                    }
                }
            } catch {
                /* empty */
            }
            if (localStorage.getItem(AUTH_KEY)) setAuthed("yes");
            else setAuthed("no");
        })();

        const onLogout = () => setAuthed("no");
        window.addEventListener("hermes-logout", onLogout);
        return () => window.removeEventListener("hermes-logout", onLogout);
    }, []);

    const handleLogin = async (pwd: string) => {
        try {
            const res = await apiCall<{ ok: boolean; token?: string }>("/api/auth/login", {
                method: "POST",
                body: JSON.stringify({ password: pwd }),
            });
            if (res.ok) {
                if (res.token) localStorage.setItem(AUTH_KEY, res.token);
                setAuthed("yes");
                return true;
            }
            return false;
        } catch {
            if (!needPwd) {
                setAuthed("yes");
                return true;
            }
            return false;
        }
    };

    /* ---------- Initial data load ---------- */
    const refreshAll = React.useCallback(async () => {
        setLoading(true);
        try {
            const s = await apiCall<BotStatusDto>("/api/status");
            setStatus(s);
            const g = await apiCall<DiscordGuild[]>("/api/guilds");
            setGuilds(g);
            const gid = selectedGuildId || g[0]?.id || "";
            if (gid) setSelectedGuildId(gid);
        } catch (e: any) {
            showToast("err", e?.message || "Errore caricamento stato");
        } finally {
            setLoading(false);
        }
    }, [selectedGuildId]);

    useEffect(() => {
        if (authed !== "yes") return;
        refreshAll();
        const id = window.setInterval(() => {
            apiCall<BotStatusDto>("/api/status")
                .then(setStatus)
                .catch(() => {
                    /* empty */
                });
        }, 8000);
        return () => window.clearInterval(id);
    }, [authed]);

    /* ---------- Guild change ---------- */
    const loadGuildData = React.useCallback(async () => {
        if (!selectedGuildId) return;
        setLoading(true);
        try {
            const [chs, rls, wl, tts, lg, sch, dml] = await Promise.all([
                apiCall<DiscordChannel[]>(`/api/guilds/${selectedGuildId}/channels`),
                apiCall<DiscordRole[]>(`/api/guilds/${selectedGuildId}/roles`),
                apiCall<GuildWelcomeLeave>(`/api/module/welcome-leave/${selectedGuildId}`),
                apiCall<GuildTTS>(`/api/module/tts/${selectedGuildId}`),
                apiCall<GuildLogs>(`/api/module/logs/${selectedGuildId}`),
                apiCall<ScheduledMessage[]>(`/api/scheduled-messages/${selectedGuildId}`),
                apiCall<DeletedModifiedLogEntry[]>(`/api/logs/deleted-modified/${selectedGuildId}`),
            ]);
            setChannels(chs);
            setRoles(rls);
            setWlConf(wl);
            setTtsConf(tts);
            setLogsConf(lg);
            setScheduled(sch);
            setDmLogs(dml);
        } catch (e: any) {
            showToast("err", e?.message || "Errore caricamento moduli");
        } finally {
            setLoading(false);
        }
    }, [selectedGuildId]);

    useEffect(() => {
        if (authed !== "yes" || !selectedGuildId) return;
        loadGuildData();
    }, [authed, selectedGuildId]);

    /* ---------- Clan Wolvesville: membri + log ---------- */
    const loadClanOverview = React.useCallback(async () => {
        setClanLoading(true);
        setClanError(null);
        try {
            const data = await apiCall<ClanOverviewDto>("/api/clan/overview");
            setClanOverview(data);
        } catch (e: any) {
            setClanError(e?.message || "Errore caricamento dati clan");
        } finally {
            setClanLoading(false);
        }
    }, []);

    useEffect(() => {
        if (authed !== "yes") return;
        loadClanOverview();
    }, [authed]);

    /* ---------- Save helpers ---------- */

    const saveWl = async (patch: Partial<GuildWelcomeLeave>) => {
        if (!wlConf) return;
        const next = { ...wlConf, ...patch };
        setWlConf(next);
        setSaving(true);
        try {
            await apiCall(`/api/module/welcome-leave/${selectedGuildId}`, {
                method: "PUT",
                body: JSON.stringify(next),
            });
            showToast("ok", "Welcome / Leave salvati");
        } catch (e: any) {
            showToast("err", e?.message || "Salvataggio fallito");
        } finally {
            setSaving(false);
        }
    };

    const saveTts = async (patch: Partial<GuildTTS>) => {
        if (!ttsConf) return;
        const next = { ...ttsConf, ...patch };
        setTtsConf(next);
        setSaving(true);
        try {
            await apiCall(`/api/module/tts/${selectedGuildId}`, {
                method: "PUT",
                body: JSON.stringify(next),
            });
            showToast("ok", "Configurazione TTS salvata");
        } catch (e: any) {
            showToast("err", e?.message || "Salvataggio fallito");
        } finally {
            setSaving(false);
        }
    };

    const saveLogs = async (patch: Partial<GuildLogs>) => {
        if (!logsConf) return;
        const next = { ...logsConf, ...patch };
        setLogsConf(next);
        setSaving(true);
        try {
            await apiCall(`/api/module/logs/${selectedGuildId}`, {
                method: "PUT",
                body: JSON.stringify(next),
            });
            showToast("ok", "Config Logs salvata");
        } catch (e: any) {
            showToast("err", e?.message || "Salvataggio fallito");
        } finally {
            setSaving(false);
        }
    };

    const saveScheduled = async (msg: ScheduledMessage) => {
        setSaving(true);
        try {
            const updated = await apiCall<ScheduledMessage>(`/api/scheduled-messages/${selectedGuildId}`, {
                method: "PUT",
                body: JSON.stringify(msg),
            });
            setScheduled((arr) => {
                const exists = arr.some((m) => m.id === updated.id);
                return exists ? arr.map((m) => (m.id === updated.id ? updated : m)) : [...arr, updated];
            });
            showToast("ok", "Messaggio programmato salvato");
        } catch (e: any) {
            showToast("err", e?.message || "Salvataggio fallito");
        } finally {
            setSaving(false);
        }
    };

    const deleteScheduled = async (id: string) => {
        setSaving(true);
        try {
            await apiCall(`/api/scheduled-messages/${selectedGuildId}/${id}`, { method: "DELETE" });
            setScheduled((arr) => arr.filter((m) => m.id !== id));
            showToast("ok", "Messaggio eliminato");
        } catch (e: any) {
            showToast("err", e?.message || "Eliminazione fallita");
        } finally {
            setSaving(false);
        }
    };

    const textChannels = useMemo(() => channels.filter((c) => c.type === 0), [channels]);
    const voiceChannels = useMemo(() => channels.filter((c) => c.type === 2), [channels]);

    if (authed === "loading") {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#120D09]">
                <div className="w-10 h-10 border-4 border-neutral-700 border-t-[#C9A227] rounded-full animate-spin" />
            </div>
        );
    }

    if (authed !== "yes") {
        return <Login needPassword={needPwd} onLogin={handleLogin} />;
    }

    /* ==========================
     * RENDER APP
     * ========================== */

    return (
        <div className="h-screen flex bg-[#0D0906] text-[#EDE3C8] overflow-hidden">
            {/* Rail dei server: un medaglione per ogni server dove Ade è presente */}
            <nav className="w-[72px] shrink-0 bg-[#0A0705] border-r border-[#241B12] flex flex-col items-center py-3 gap-2 overflow-y-auto">
                {guilds.map((g) => {
                    const active = g.id === selectedGuildId;
                    return (
                        <button
                            key={g.id}
                            onClick={() => setSelectedGuildId(g.id)}
                            title={g.name}
                            className="relative group w-11 h-11 shrink-0"
                        >
                            <span
                                className={classNames(
                                    "absolute -left-3 top-1/2 -translate-y-1/2 w-1 rounded-r-full bg-[#E4C468] transition-all",
                                    active ? "h-8" : "h-0 group-hover:h-4"
                                )}
                            />
                            {g.icon ? (
                                <img
                                    src={`https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png`}
                                    className={classNames(
                                        "w-11 h-11 rounded-full object-cover border-2 transition-colors",
                                        active ? "border-[#B8912A]" : "border-transparent group-hover:border-[#4A3A24]"
                                    )}
                                />
                            ) : (
                                <div
                                    className={classNames(
                                        "w-11 h-11 rounded-full border-2 flex items-center justify-center text-sm font-display font-bold transition-colors",
                                        active
                                            ? "border-[#B8912A] bg-[#B8912A]/15 text-[#E4C468]"
                                            : "border-transparent bg-[#1C150E] text-[#A8967A] group-hover:border-[#4A3A24]"
                                    )}
                                >
                                    {g.name.charAt(0)}
                                </div>
                            )}
                        </button>
                    );
                })}
                <div className="w-8 border-t border-[#241B12] my-1 shrink-0" />
                <button
                    onClick={refreshAll}
                    title="Ricarica"
                    className="w-11 h-11 rounded-full flex items-center justify-center text-[#A8967A] hover:bg-[#1C150E] hover:text-[#E4C468] transition-colors shrink-0"
                >
                    <RefreshCw className={classNames("w-4 h-4", loading && "animate-spin")} />
                </button>
            </nav>

            {/* Colonna sale: le sezioni di configurazione, come una lista di canali */}
            <aside className="w-[248px] shrink-0 bg-[#15100B] border-r border-[#241B12] flex flex-col">
                <div className="px-4 py-4 border-b border-[#241B12] flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-[#B8912A]/15 border border-[#B8912A]/40 flex items-center justify-center shrink-0">
                        <Sparkles className="w-4 h-4 text-[#E4C468]" />
                    </div>
                    <div className="min-w-0">
                        <div className="font-display font-bold tracking-wide text-[#EDE3C8] leading-tight">Ade</div>
                        <div className="text-[11px] text-[#7C6A4C] truncate">
                            {guilds.find((g) => g.id === selectedGuildId)?.name || "Nessun server"}
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
                    <div className="px-2.5 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-widest text-[#5C4E38]">
                        Impostazioni
                    </div>
                    {TABS.map((t) => {
                        const active = tab === t.key;
                        const Icon = t.icon;
                        return (
                            <button
                                key={t.key}
                                onClick={() => setTab(t.key)}
                                className={classNames(
                                    "w-full text-left pl-3 pr-3 py-2 rounded-lg text-sm inline-flex items-center gap-2.5 transition-colors border-l-2",
                                    active
                                        ? "bg-[#B8912A]/12 border-[#B8912A] text-[#E4C468]"
                                        : "border-transparent text-[#B5A583] hover:bg-[#1C150E] hover:text-[#EDE3C8]"
                                )}
                            >
                                <Icon className="w-4 h-4 shrink-0" />
                                <span className="font-medium truncate">{t.label}</span>
                            </button>
                        );
                    })}
                </div>

                <div className="p-2.5 border-t border-[#241B12] flex items-center gap-2">
                    <span className={classNames("w-2 h-2 rounded-full shrink-0", status?.online ? "bg-emerald-400" : "bg-rose-500")} />
                    <span className="text-xs text-[#7C6A4C]">Bot</span>
                    <span className="text-xs font-semibold text-[#EDE3C8]">{status?.online ? "Online" : "Offline"}</span>
                    <div className="flex-1" />
                    {saving && <Save className="w-3.5 h-3.5 text-[#E4C468] animate-pulse" title="Salvando..." />}
                </div>
            </aside>

            {/* Contenuto della sezione selezionata */}
            <main className="flex-1 min-w-0 overflow-y-auto">
                <div className="max-w-[1200px] mx-auto px-6 py-6">
                    {tab === "home" && <TabHome status={status} />}
                    {tab === "welcome" && wlConf && (
                        <TabWelcomeLeave
                            kind="welcome"
                            conf={wlConf}
                            channels={textChannels}
                            onChange={saveWl}
                        />
                    )}
                    {tab === "leave" && wlConf && (
                        <TabWelcomeLeave
                            kind="leave"
                            conf={wlConf}
                            channels={textChannels}
                            onChange={saveWl}
                        />
                    )}
                    {tab === "autorole" && wlConf && (
                        <TabAutorole conf={wlConf} roles={roles} onChange={saveWl} />
                    )}
                    {tab === "messages" && (
                        <TabScheduled
                            guildId={selectedGuildId}
                            channels={textChannels}
                            list={scheduled}
                            onSave={saveScheduled}
                            onDelete={deleteScheduled}
                        />
                    )}
                    {tab === "tts" && ttsConf && (
                        <TabTTS conf={ttsConf} textChannels={textChannels} voiceChannels={voiceChannels} onChange={saveTts} />
                    )}
                    {tab === "logs" && logsConf && (
                        <TabLogs conf={logsConf} channels={textChannels} onChange={saveLogs} entries={dmLogs} onRefresh={loadGuildData} />
                    )}
                    {tab === "clan" && (
                        <TabClan data={clanOverview} error={clanError} loading={clanLoading} onRefresh={loadClanOverview} />
                    )}
                </div>
            </main>

            {toast && (
                <div
                    className={classNames(
                        "fixed bottom-5 right-5 z-50 px-4 py-3 rounded-xl shadow-2xl text-sm font-medium flex items-center gap-2 animate-slide-up",
                        toast.kind === "ok"
                            ? "bg-emerald-500/95 text-white border border-emerald-400/40"
                            : "bg-rose-500/95 text-white border border-rose-400/40"
                    )}
                >
                    {toast.kind === "ok" ? <Save className="w-4 h-4" /> : <ShieldAlert className="w-4 h-4" />}
                    {toast.msg}
                </div>
            )}
        </div>
    );
}

/* ==========================
 * TAB COMPONENTS
 * ========================== */

const TabHome: React.FC<{ status: BotStatusDto | null }> = ({ status }) => {
    if (!status) return <EmptyState icon={Activity} title="Stato non disponibile" text="Ricarica tra pochi secondi..." />;
    const items: { label: string; value: string; icon: any; color: string }[] = [
        { label: "Uptime", value: formatUptime(status.uptimeSeconds), icon: Clock, color: "indigo" },
        { label: "Server", value: String(status.guildsCount), icon: Server, color: "emerald" },
        { label: "Membri", value: String(status.membersCount), icon: User, color: "amber" },
        { label: "Ping", value: `${status.pingMs} ms`, icon: Activity, color: "sky" },
    ];
    return (
        <div className="space-y-5 animate-fade-in">
            <div>
                <h1 className="text-2xl font-black tracking-tight">Stato del bot</h1>
                <p className="text-sm text-neutral-400 mt-1">Panoramica e modulo attivi sul server</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {items.map((it) => {
                    const Icon = it.icon;
                    return (
                        <div key={it.label} className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4">
                            <div className={`w-9 h-9 rounded-xl bg-${it.color}-500/15 border border-${it.color}-500/30 flex items-center justify-center mb-3`}>
                                <Icon className={`w-4 h-4 text-${it.color}-400`} />
                            </div>
                            <div className="text-[11px] uppercase tracking-wider font-bold text-neutral-500">{it.label}</div>
                            <div className="text-2xl font-black mt-1">{it.value}</div>
                        </div>
                    );
                })}
            </div>

            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5">
                <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-400 mb-4 flex items-center gap-2">
                    <SlidersHorizontal className="w-4 h-4" /> Moduli
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    {(Object.entries(status.modules) as [keyof BotStatusDto["modules"], boolean][]).map(([k, v]) => (
                        <div key={k} className={classNames("px-4 py-3 rounded-xl border flex items-center justify-between",
                            v ? "bg-emerald-500/10 border-emerald-500/30" : "bg-neutral-800/60 border-neutral-700/60"
                        )}>
                            <span className="text-sm capitalize font-semibold">{k === "autorole" ? "Auto Role" : k}</span>
                            <span className={classNames("text-[10px] font-bold uppercase px-2 py-0.5 rounded-full",
                                v ? "bg-emerald-500/20 text-emerald-300" : "bg-neutral-700 text-neutral-400"
                            )}>
                                {v ? "Attivo" : "Spento"}
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <InfoCard title="Porta Dashboard" icon={Settings} value={`http://localhost:${status.port}`} desc="Apri questa URL nel browser per usare la dashboard" />
                <InfoCard title="Piattaforma" icon={Server} value={status.platform} desc={`Avviato il ${new Date(status.startedAt).toLocaleString("it-IT")}`} />
            </div>
        </div>
    );
};

const InfoCard: React.FC<{ title: string; icon: any; value: string; desc: string }> = ({ title, icon: Icon, value, desc }) => (
    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center shrink-0">
            <Icon className="w-4 h-4 text-indigo-300" />
        </div>
        <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-wider font-bold text-neutral-500">{title}</div>
            <div className="text-base font-bold mt-0.5 break-all">{value}</div>
            <div className="text-xs text-neutral-400 mt-1">{desc}</div>
        </div>
    </div>
);

const TabWelcomeLeave: React.FC<{
    kind: "welcome" | "leave";
    conf: GuildWelcomeLeave;
    channels: DiscordChannel[];
    onChange: (patch: Partial<GuildWelcomeLeave>) => Promise<void>;
}> = ({ kind, conf, channels, onChange }) => {
    const enabled = kind === "welcome" ? conf.welcomeEnabled : conf.leaveEnabled;
    const channelId = kind === "welcome" ? conf.welcomeChannelId : conf.leaveChannelId;
    const message = kind === "welcome" ? conf.welcomeMessage : conf.leaveMessage;
    const card = kind === "welcome" ? conf.welcomeCard : conf.leaveCard;

    const defaultCard = kind === "welcome" ? DEFAULT_WELCOME_CARD : DEFAULT_LEAVE_CARD;
    const activeCard = card ?? JSON.parse(JSON.stringify(defaultCard));

    const updateCard = (c: CardConfig) => {
        onChange(kind === "welcome" ? { welcomeCard: c } : { leaveCard: c });
    };

    return (
        <div className="space-y-5 animate-fade-in">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-black tracking-tight">
                        {kind === "welcome" ? "Card Welcome" : "Card Leave"}
                    </h1>
                    <p className="text-sm text-neutral-400 mt-1">
                        {kind === "welcome"
                            ? "Invia una card personalizzata quando un nuovo membro entra nel server."
                            : "Invia una card quando un membro lascia il server."}
                    </p>
                </div>
                <label className="inline-flex items-center gap-2.5 px-3 py-2 rounded-xl bg-neutral-900 border border-neutral-800 cursor-pointer">
                    <Toggle value={!!enabled} onChange={(v) => onChange(kind === "welcome" ? { welcomeEnabled: v } : { leaveEnabled: v })} />
                    <span className="text-sm font-semibold">{enabled ? "Modulo attivo" : "Modulo disattivato"}</span>
                </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5">
                    <h3 className="text-sm font-bold text-neutral-100 mb-3">Canale & Messaggio</h3>
                    <Field label="Canale">
                        <select
                            value={channelId ?? ""}
                            onChange={(e) => onChange(kind === "welcome" ? { welcomeChannelId: e.target.value } : { leaveChannelId: e.target.value })}
                            className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2.5 text-sm text-neutral-100"
                        >
                            <option value="">— Seleziona un canale testuale —</option>
                            {channels.map((c) => (
                                <option key={c.id} value={c.id}>#{c.name}</option>
                            ))}
                        </select>
                    </Field>
                    <Field label={`Messaggio di ${kind === "welcome" ? "benvenuto" : "addio"} (variabili: {USERNAME}, {SERVER_NAME}, {MEMBER_COUNT})`}>
                        <textarea
                            rows={4}
                            value={message ?? ""}
                            onChange={(e) => onChange(kind === "welcome" ? { welcomeMessage: e.target.value } : { leaveMessage: e.target.value })}
                            placeholder={kind === "welcome" ? "Benvenuto/a {USERNAME} nel server!" : "Arrivederci {USERNAME}, ci mancherai!"}
                            className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2.5 text-sm text-neutral-100 resize-none"
                        />
                    </Field>
                    <div className="mt-2 text-[11px] text-neutral-500 flex items-start gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                        La card viene generata automaticamente dal canvas qui sotto. Le variabili vengono sostituite al momento dell'invio.
                    </div>
                </div>
                <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5">
                    <h3 className="text-sm font-bold text-neutral-100 mb-3">Variabili disponibili</h3>
                    <ul className="space-y-1.5 text-xs">
                        {[
                            ["{USERNAME}", "Nickname dell'utente (es. MarioRossi)"],
                            ["{SERVER_NAME}", "Nome del server Discord"],
                            ["{MEMBER_COUNT}", "Numero totale di membri nel server"],
                        ].map(([k, v]) => (
                            <li key={k} className="flex items-start gap-2 p-2 rounded-lg bg-neutral-950 border border-neutral-800">
                                <code className="font-mono text-emerald-300 bg-black/40 rounded px-2 py-0.5 text-[11px]">{k}</code>
                                <span className="text-neutral-400">{v}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>

            <CanvasEditor card={activeCard} onChange={updateCard} type={kind} />
        </div>
    );
};

const Toggle: React.FC<{ value: boolean; onChange: (v: boolean) => void }> = ({ value, onChange }) => (
    <button
        type="button"
        onClick={() => onChange(!value)}
        className={classNames(
            "w-11 h-6 rounded-full border transition-colors relative",
            value ? "bg-emerald-500/80 border-emerald-400/60" : "bg-neutral-800 border-neutral-700"
        )}
    >
        <span
            className={classNames(
                "absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all",
                value ? "left-[calc(100%-22px)]" : "left-0.5"
            )}
        />
    </button>
);

const TabAutorole: React.FC<{
    conf: GuildWelcomeLeave;
    roles: DiscordRole[];
    onChange: (patch: Partial<GuildWelcomeLeave>) => Promise<void>;
}> = ({ conf, roles, onChange }) => {
    const selected = new Set(conf.autoroleRoleIds ?? []);
    const toggle = (id: string) => {
        const next = new Set(selected);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        onChange({ autoroleRoleIds: Array.from(next) });
    };
    return (
        <div className="space-y-5 animate-fade-in">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-black tracking-tight">Auto Role</h1>
                    <p className="text-sm text-neutral-400 mt-1">Assegna automaticamente i ruoli selezionati ai nuovi membri.</p>
                </div>
                <label className="inline-flex items-center gap-2.5 px-3 py-2 rounded-xl bg-neutral-900 border border-neutral-800 cursor-pointer">
                    <Toggle value={!!conf.autoroleEnabled} onChange={(v) => onChange({ autoroleEnabled: v })} />
                    <span className="text-sm font-semibold">{conf.autoroleEnabled ? "Attivo" : "Disattivato"}</span>
                </label>
            </div>
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5">
                <h3 className="text-sm font-bold text-neutral-100 mb-3 flex items-center gap-2">
                    <Tag className="w-4 h-4 text-indigo-400" /> Seleziona ruoli da assegnare
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-[540px] overflow-auto pr-2">
                    {roles.filter((r) => r.name !== "@everyone").sort((a, b) => b.position - a.position).map((r) => {
                        const isSel = selected.has(r.id);
                        return (
                            <button
                                key={r.id}
                                onClick={() => toggle(r.id)}
                                className={classNames(
                                    "text-left px-3 py-2.5 rounded-xl border inline-flex items-center gap-3 transition-colors",
                                    isSel ? "bg-[#C9A227]/10 border-[#C9A227]/40" : "bg-neutral-950 border-neutral-800 hover:bg-neutral-800"
                                )}
                            >
                                <span
                                    className="w-3.5 h-3.5 rounded-full shrink-0"
                                    style={{ background: `#${r.color.toString(16).padStart(6, "0")}`, opacity: r.color === 0 ? 0.5 : 1 }}
                                />
                                <span className="truncate text-sm font-medium">{r.name}</span>
                                <span className="flex-1" />
                                <span className={classNames(
                                    "w-5 h-5 rounded-md border-2 flex items-center justify-center",
                                    isSel ? "bg-[#C9A227] border-[#C9A227] text-[#1a1410]" : "border-neutral-600"
                                )}>
                                    {isSel && "✓"}
                                </span>
                            </button>
                        );
                    })}
                </div>
                <div className="mt-4 text-xs text-neutral-500">
                    {selected.size} ruolo/i selezionato/i. Verrà assegnato subito dopo l'evento <code className="mx-1 px-1.5 py-0.5 bg-black/40 rounded text-emerald-300">guildMemberAdd</code>.
                </div>
            </div>
        </div>
    );
};

const TabScheduled: React.FC<{
    guildId: string;
    channels: DiscordChannel[];
    list: ScheduledMessage[];
    onSave: (m: ScheduledMessage) => void;
    onDelete: (id: string) => void;
}> = ({ guildId, channels, list, onSave, onDelete }) => {
    const blank = (): ScheduledMessage => ({
        id: uid(),
        guildId,
        channelId: channels[0]?.id ?? "",
        message: "",
        isRecurring: true,
        recurrenceInterval: "daily",
        scheduledTime: new Date(Date.now() + 60_000).toISOString().slice(0, 16),
        enabled: true,
        createdAt: new Date().toISOString(),
    });
    const [open, setOpen] = useState<ScheduledMessage | null>(list.length === 0 ? blank() : null);

    return (
        <div className="space-y-5 animate-fade-in">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-black tracking-tight">Messaggi Programmati</h1>
                    <p className="text-sm text-neutral-400 mt-1">Invia messaggi una tantum o ricorrenti (giornalieri/settimanali/mensili).</p>
                </div>
                <button
                    onClick={() => setOpen(blank())}
                    className="px-4 py-2 bg-[#C9A227] hover:bg-[#8A6B1D] text-[#1a1410] font-semibold rounded-xl text-sm inline-flex items-center gap-2 shadow-[0_8px_24px_-10px_#C9A227]"
                >
                    <Plus className="w-4 h-4" /> Nuovo messaggio
                </button>
            </div>

            {list.length === 0 ? (
                <EmptyState
                    icon={MessageSquare}
                    title="Nessun messaggio programmato"
                    text="Clicca su 'Nuovo messaggio' per creare il primo promemoria o comunicazione ricorrente."
                />
            ) : (
                <div className="space-y-2.5">
                    {list.map((m) => (
                        <div key={m.id} className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 flex items-center gap-4">
                            <label className="shrink-0">
                                <Toggle value={!!m.enabled} onChange={(v) => onSave({ ...m, enabled: v })} />
                            </label>
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 text-xs text-neutral-400 mb-1">
                                    <Tag className="w-3 h-3" />
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-neutral-800 border border-neutral-700">
                                        {m.isRecurring ? `🔁 Ricorrente: ${m.recurrenceInterval || "daily"}` : "⏱️ Una-tantum"}
                                    </span>
                                    <span>· Canale:</span>
                                    <span className="text-neutral-200">#{channels.find((c) => c.id === m.channelId)?.name || m.channelId}</span>
                                    <span>·</span>
                                    <span>{new Date(m.scheduledTime).toLocaleString("it-IT")}</span>
                                    {m.lastSent && <span className="text-emerald-300">· Inviato: {new Date(m.lastSent).toLocaleString("it-IT")}</span>}
                                </div>
                                <div className="text-sm text-neutral-200 whitespace-pre-wrap line-clamp-2">{m.message || "(nessun testo)"}</div>
                            </div>
                            <div className="flex gap-1.5">
                                <button
                                    onClick={() => setOpen(m)}
                                    className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-xs text-neutral-200 border border-neutral-700"
                                >
                                    Modifica
                                </button>
                                <button
                                    onClick={() => onDelete(m.id)}
                                    className="px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-xs text-rose-300 border border-rose-500/30"
                                >
                                    Elimina
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {open && (
                <ScheduledModal
                    initial={open}
                    channels={channels}
                    onCancel={() => setOpen(null)}
                    onSave={(m) => {
                        onSave(m);
                        setOpen(null);
                    }}
                />
            )}
        </div>
    );
};

const ScheduledModal: React.FC<{
    initial: ScheduledMessage;
    channels: DiscordChannel[];
    onCancel: () => void;
    onSave: (m: ScheduledMessage) => void;
}> = ({ initial, channels, onCancel, onSave }) => {
    const [m, setM] = useState<ScheduledMessage>(initial);
    return (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
            <div className="w-full max-w-xl bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-2xl animate-slide-up">
                <h3 className="text-lg font-black mb-4">{initial.message ? "Modifica" : "Nuovo"} messaggio programmato</h3>
                <div className="space-y-3">
                    <Field label="Canale">
                        <select
                            value={m.channelId}
                            onChange={(e) => setM({ ...m, channelId: e.target.value })}
                            className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2.5 text-sm"
                        >
                            {channels.map((c) => (
                                <option key={c.id} value={c.id}>#{c.name}</option>
                            ))}
                        </select>
                    </Field>
                    <Field label="Testo messaggio">
                        <textarea
                            rows={5}
                            value={m.message}
                            onChange={(e) => setM({ ...m, message: e.target.value })}
                            placeholder="Scrivi il messaggio..."
                            className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2.5 text-sm resize-none"
                        />
                    </Field>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-[10px] font-bold uppercase tracking-wide text-neutral-500 block mb-1">
                                Data e ora
                            </label>
                            <input
                                type="datetime-local"
                                value={m.scheduledTime.slice(0, 16)}
                                onChange={(e) => setM({ ...m, scheduledTime: new Date(e.target.value).toISOString() })}
                                className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2.5 text-sm"
                            />
                        </div>
                        <Field label="Modalità">
                            <select
                                value={m.isRecurring ? "yes" : "no"}
                                onChange={(e) => setM({ ...m, isRecurring: e.target.value === "yes" })}
                                className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2.5 text-sm"
                            >
                                <option value="no">Una-tantum</option>
                                <option value="yes">Ricorrente</option>
                            </select>
                        </Field>
                    </div>
                    {m.isRecurring && (
                        <Field label="Intervallo ricorrenza">
                            <select
                                value={m.recurrenceInterval || "daily"}
                                onChange={(e) => setM({ ...m, recurrenceInterval: e.target.value })}
                                className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2.5 text-sm"
                            >
                                <option value="daily">Giornaliero</option>
                                <option value="weekly">Settimanale</option>
                                <option value="monthly">Mensile</option>
                            </select>
                        </Field>
                    )}
                    <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
                        <Toggle value={m.enabled} onChange={(v) => setM({ ...m, enabled: v })} />
                        Attivo
                    </label>
                </div>
                <div className="mt-6 flex justify-end gap-2">
                    <button onClick={onCancel} className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-sm font-medium">
                        Annulla
                    </button>
                    <button
                        onClick={() => onSave(m)}
                        className="px-4 py-2 rounded-xl bg-[#C9A227] hover:bg-[#8A6B1D] text-[#1a1410] text-sm font-semibold inline-flex items-center gap-2"
                    >
                        <Save className="w-4 h-4" /> Salva
                    </button>
                </div>
            </div>
        </div>
    );
};

const TabTTS: React.FC<{
    conf: GuildTTS;
    textChannels: DiscordChannel[];
    voiceChannels: DiscordChannel[];
    onChange: (patch: Partial<GuildTTS>) => Promise<void>;
}> = ({ conf, textChannels, voiceChannels, onChange }) => {
    const prefixes = conf.ttsPrefixes ?? [];
    const [newPref, setNewPref] = useState("");
    const addPref = () => {
        const p = newPref.trim();
        if (!p) return;
        setNewPref("");
        onChange({ ttsPrefixes: [...prefixes, p] });
    };
    const delPref = (p: string) => onChange({ ttsPrefixes: prefixes.filter((x) => x !== p) });

    return (
        <div className="space-y-5 animate-fade-in">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-black tracking-tight">Text to Speech</h1>
                    <p className="text-sm text-neutral-400 mt-1">Il bot entra in vocale e legge ad alta voce i messaggi che iniziano con i prefissi definiti.</p>
                </div>
                <label className="inline-flex items-center gap-2.5 px-3 py-2 rounded-xl bg-neutral-900 border border-neutral-800 cursor-pointer">
                    <Toggle value={!!conf.ttsEnabled} onChange={(v) => onChange({ ttsEnabled: v })} />
                    <span className="text-sm font-semibold">{conf.ttsEnabled ? "Attivo" : "Disattivato"}</span>
                </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5">
                    <h3 className="text-sm font-bold text-neutral-100 mb-3 flex items-center gap-2">
                        <Speaker className="w-4 h-4 text-indigo-400" /> Canali
                    </h3>
                    <Field label="Canale testuale da leggere">
                        <select
                            value={conf.ttsSourceChannelId ?? ""}
                            onChange={(e) => onChange({ ttsSourceChannelId: e.target.value })}
                            className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2.5 text-sm"
                        >
                            <option value="">— Qualsiasi canale —</option>
                            {textChannels.map((c) => (
                                <option key={c.id} value={c.id}>#{c.name}</option>
                            ))}
                        </select>
                    </Field>
                    <Field label="Canale vocale dove parlare">
                        <select
                            value={conf.ttsVoiceChannelId ?? ""}
                            onChange={(e) => onChange({ ttsVoiceChannelId: e.target.value })}
                            className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2.5 text-sm"
                        >
                            <option value="">— Stesso canale dell'utente —</option>
                            {voiceChannels.map((c) => (
                                <option key={c.id} value={c.id}>🔊 {c.name}</option>
                            ))}
                        </select>
                    </Field>
                    <Field label="Lingua (codice es. it, en, es, fr, de)">
                        <input
                            value={conf.ttsLanguage ?? "it"}
                            onChange={(e) => onChange({ ttsLanguage: e.target.value })}
                            className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2.5 text-sm"
                        />
                    </Field>
                </div>

                <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5">
                    <h3 className="text-sm font-bold text-neutral-100 mb-3">Prefissi trigger TTS</h3>
                    <p className="text-xs text-neutral-400 mb-3">
                        I messaggi che iniziano con UNO di questi prefissi verranno letti in vocale. Puoi usare più prefissi per stanze o gruppi diversi.
                    </p>
                    <div className="flex gap-2 mb-3">
                        <input
                            value={newPref}
                            onChange={(e) => setNewPref(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && addPref()}
                            placeholder="Es. .tts oppure !parla"
                            className="flex-1 bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2.5 text-sm"
                        />
                        <button onClick={addPref} className="px-3 py-2 bg-[#C9A227] hover:bg-[#8A6B1D] text-[#1a1410] rounded-lg text-sm font-semibold">
                            Aggiungi
                        </button>
                    </div>
                    {prefixes.length === 0 ? (
                        <div className="text-xs text-neutral-500 italic p-3 rounded-lg bg-neutral-950 border border-dashed border-neutral-800">
                            Nessun prefisso. Aggiungine uno per usare il TTS (es. <code className="text-emerald-300">.tts</code>).
                        </div>
                    ) : (
                        <div className="flex flex-wrap gap-2">
                            {prefixes.map((p) => (
                                <span key={p} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-neutral-950 border border-neutral-800 text-sm">
                                    <code className="font-mono text-emerald-300">{p}</code>
                                    <button onClick={() => delPref(p)} className="text-rose-400 hover:text-rose-300">
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const TabLogs: React.FC<{
    conf: GuildLogs;
    channels: DiscordChannel[];
    onChange: (patch: Partial<GuildLogs>) => Promise<void>;
    entries: DeletedModifiedLogEntry[];
    onRefresh: () => Promise<void>;
}> = ({ conf, channels, onChange, entries, onRefresh }) => {
    const [filter, setFilter] = useState<"all" | "deleted" | "modified">("all");
    const filtered = entries.filter((e) => (filter === "all" ? true : e.type === filter));

    return (
        <div className="space-y-5 animate-fade-in">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-black tracking-tight">Logs Messaggi</h1>
                    <p className="text-sm text-neutral-400 mt-1">Registra messaggi eliminati e modificati. Configura il canale di notifica o usa solo la visualizzazione nella dashboard.</p>
                </div>
                <label className="inline-flex items-center gap-2.5 px-3 py-2 rounded-xl bg-neutral-900 border border-neutral-800 cursor-pointer">
                    <Toggle value={!!conf.enabled} onChange={(v) => onChange({ enabled: v })} />
                    <span className="text-sm font-semibold">{conf.enabled ? "Attivo" : "Disattivato"}</span>
                </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2 bg-neutral-900 border border-neutral-800 rounded-2xl p-5">
                    <h3 className="text-sm font-bold text-neutral-100 mb-3">Configurazione</h3>
                    <Field label="Canale Discord dove inviare i log">
                        <select
                            value={conf.channelId ?? ""}
                            onChange={(e) => onChange({ channelId: e.target.value })}
                            className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2.5 text-sm"
                        >
                            <option value="">— Solo dashboard (nessun canale) —</option>
                            {channels.map((c) => (
                                <option key={c.id} value={c.id}>#{c.name}</option>
                            ))}
                        </select>
                    </Field>
                    <div className="grid grid-cols-2 gap-3 mt-1">
                        <label className="inline-flex items-center gap-2 p-3 rounded-xl bg-neutral-950 border border-neutral-800 cursor-pointer">
                            <Toggle value={!!conf.interceptUsers} onChange={(v) => onChange({ interceptUsers: v })} />
                            <div>
                                <div className="text-sm font-semibold">Intercetta utenti</div>
                                <div className="text-[11px] text-neutral-500">Messaggi da membri normali</div>
                            </div>
                        </label>
                        <label className="inline-flex items-center gap-2 p-3 rounded-xl bg-neutral-950 border border-neutral-800 cursor-pointer">
                            <Toggle value={!!conf.interceptApps} onChange={(v) => onChange({ interceptApps: v })} />
                            <div>
                                <div className="text-sm font-semibold">Intercetta bot/app</div>
                                <div className="text-[11px] text-neutral-500">Messaggi da altri bot</div>
                            </div>
                        </label>
                    </div>
                </div>

                <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5">
                    <h3 className="text-sm font-bold text-neutral-100 mb-3">Statistiche recenti</h3>
                    <div className="space-y-2">
                        <Stat label="Catturati oggi" value={String(entries.length)} color="indigo" />
                        <Stat label="Eliminati" value={String(entries.filter((e) => e.type === "deleted").length)} color="rose" />
                        <Stat label="Modificati" value={String(entries.filter((e) => e.type === "modified").length)} color="amber" />
                    </div>
                    <button
                        onClick={onRefresh}
                        className="mt-4 w-full px-3 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-xs font-medium text-neutral-200 border border-neutral-700 inline-flex items-center justify-center gap-1.5"
                    >
                        <RefreshCw className="w-3.5 h-3.5" /> Aggiorna log
                    </button>
                </div>
            </div>

            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden">
                <div className="px-5 py-3 border-b border-neutral-800 flex items-center justify-between">
                    <h3 className="text-sm font-bold">Ultimi log (max 100)</h3>
                    <div className="flex items-center gap-1.5">
                        {(["all", "deleted", "modified"] as const).map((f) => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={classNames(
                                    "px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors",
                                    filter === f
                                        ? "bg-[#C9A227] text-[#1a1410] border-[#C9A227]/40"
                                        : "bg-neutral-950 text-neutral-300 border-neutral-800 hover:bg-neutral-800"
                                )}
                            >
                                {f === "all" ? "Tutti" : capFirst(f)}
                            </button>
                        ))}
                    </div>
                </div>
                {filtered.length === 0 ? (
                    <EmptyState compact icon={Activity} title="Nessun log" text="Nessun messaggio eliminato/modificato intercettato. Attiva il modulo e attendi che qualcuno scriva/modifichi/elimini qualcosa." />
                ) : (
                    <div className="max-h-[640px] overflow-auto">
                        {filtered.map((e) => (
                            <div key={e.id} className="border-b border-neutral-800 last:border-0 p-4 hover:bg-neutral-900/60">
                                <div className="flex items-center gap-3 mb-2">
                                    <img src={e.author.avatar} className="w-9 h-9 rounded-full object-cover" onError={(x) => ((x.target as HTMLImageElement).style.display = "none")} />
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                            <span className={classNames("text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full",
                                                e.type === "deleted"
                                                    ? "bg-rose-500/15 text-rose-300 border border-rose-500/30"
                                                    : "bg-amber-500/15 text-amber-300 border border-amber-500/30"
                                            )}>
                                                {e.type === "deleted" ? "Eliminato" : "Modificato"}
                                            </span>
                                            <span className="font-semibold text-sm truncate">{e.author.username}</span>
                                            <span className="text-[11px] text-neutral-500">in #{e.channelName}</span>
                                            <span className="flex-1" />
                                            <span className="text-[11px] text-neutral-500">{new Date(e.timestamp).toLocaleString("it-IT")}</span>
                                        </div>
                                    </div>
                                </div>
                                {e.type === "deleted" ? (
                                    <div className="ml-12 p-3 rounded-lg bg-rose-900/20 border border-rose-500/20 text-sm whitespace-pre-wrap">
                                        {e.deletedContent || "(contenuto non disponibile - messaggio non in cache)"}
                                    </div>
                                ) : (
                                    <div className="ml-12 grid grid-cols-1 md:grid-cols-2 gap-2">
                                        <div className="p-3 rounded-lg bg-neutral-800 border border-neutral-700/50 text-sm whitespace-pre-wrap">
                                            <div className="text-[10px] uppercase font-bold text-neutral-500 mb-1">Prima</div>
                                            {e.oldContent || "(vuoto)"}
                                        </div>
                                        <div className="p-3 rounded-lg bg-amber-900/20 border border-amber-500/20 text-sm whitespace-pre-wrap">
                                            <div className="text-[10px] uppercase font-bold text-amber-400 mb-1">Dopo</div>
                                            {e.newContent || "(vuoto)"}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

const TabClan: React.FC<{
    data: ClanOverviewDto | null;
    error: string | null;
    loading: boolean;
    onRefresh: () => Promise<void>;
}> = ({ data, error, loading, onRefresh }) => {
    const members = data?.members ?? [];
    const logs = data?.logs ?? [];
    const ledger = data?.ledger ?? [];
    const donations = data?.donations ?? [];

    const coLeaders = members.filter((m) => m.isCoLeader).length;
    const totalDonated = donations.reduce((s, d) => s + (d.amount || 0), 0);

    const donorMap = new Map<string, { username: string; total: number; count: number; lastTime: string }>();
    for (const d of donations) {
        const key = d.playerId || d.playerUsername;
        const cur = donorMap.get(key) || { username: d.playerUsername, total: 0, count: 0, lastTime: d.eventTime };
        cur.total += d.amount || 0;
        cur.count += 1;
        if (new Date(d.eventTime).getTime() > new Date(cur.lastTime).getTime()) cur.lastTime = d.eventTime;
        donorMap.set(key, cur);
    }
    const leaderboard = Array.from(donorMap.values()).sort((a, b) => b.total - a.total);

    return (
        <div className="space-y-5 animate-fade-in">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-black tracking-tight">Clan Wolvesville</h1>
                    <p className="text-sm text-neutral-400 mt-1">
                        {data?.clan?.name
                            ? `${data.clan.name}${data.clan.tag ? ` [${data.clan.tag}]` : ""} — panoramica membri e tracciamento donazioni.`
                            : "Panoramica clan: membri e donazioni tracciate dal ledger di Wolvesville."}
                    </p>
                </div>
                <button
                    onClick={onRefresh}
                    className="px-3 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-xs font-medium text-neutral-200 border border-neutral-700 inline-flex items-center gap-1.5"
                >
                    <RefreshCw className={classNames("w-3.5 h-3.5", loading && "animate-spin")} /> Aggiorna
                </button>
            </div>

            {error && (
                <div className="p-4 rounded-xl bg-rose-900/20 border border-rose-500/30 text-sm text-rose-200 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{error}</span>
                </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Stat label="Membri" value={String(members.length)} color="indigo" />
                <Stat label="Co-leader" value={String(coLeaders)} color="amber" />
                <Stat label="Donazioni" value={String(donations.length)} color="emerald" />
                <Stat label="Totale oro donato" value={totalDonated.toLocaleString("it-IT")} color="yellow" />
            </div>

            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden">
                <div className="px-5 py-3 border-b border-neutral-800 flex items-center justify-between gap-3 flex-wrap">
                    <h3 className="text-sm font-bold flex items-center gap-2">
                        <Coins className="w-4 h-4 text-amber-400" />
                        Classifica donatori
                    </h3>
                    <span className="text-[11px] text-neutral-500">Basata sullo storico salvato dal bot (max 1000 entry)</span>
                </div>
                {leaderboard.length === 0 ? (
                    <EmptyState
                        compact
                        icon={Coins}
                        title="Nessuna donazione registrata"
                        text="Il tracker salva automaticamente ogni donazione del ledger Wolvesville. Appena uno del clan dona, qui apparirà la classifica."
                    />
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left text-[11px] uppercase tracking-wider text-neutral-500 border-b border-neutral-800">
                                    <th className="px-4 py-2.5 font-semibold w-12">#</th>
                                    <th className="px-4 py-2.5 font-semibold">Giocatore</th>
                                    <th className="px-4 py-2.5 font-semibold">Oro</th>
                                    <th className="px-4 py-2.5 font-semibold">Volte</th>
                                    <th className="px-4 py-2.5 font-semibold">Ultima</th>
                                </tr>
                            </thead>
                            <tbody>
                                {leaderboard.map((r, i) => (
                                    <tr key={r.username + i} className="border-b border-neutral-800/60 last:border-0 hover:bg-neutral-900/60">
                                        <td className="px-4 py-2.5 font-black text-neutral-500">{i + 1}</td>
                                        <td className="px-4 py-2.5 font-semibold">{r.username}</td>
                                        <td className="px-4 py-2.5 text-amber-300 font-bold">{r.total.toLocaleString("it-IT")}</td>
                                        <td className="px-4 py-2.5 text-neutral-300">{r.count}</td>
                                        <td className="px-4 py-2.5 text-neutral-500 text-xs">
                                            {new Date(r.lastTime).toLocaleString("it-IT")}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden">
                <div className="px-5 py-3 border-b border-neutral-800 flex items-center justify-between gap-3 flex-wrap">
                    <h3 className="text-sm font-bold flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-emerald-400" />
                        Storico donazioni
                    </h3>
                    <span className="text-[11px] text-neutral-500">
                        Solo le voci del ledger con tipo donazione
                    </span>
                </div>
                {donations.length === 0 ? (
                    <EmptyState
                        compact
                        icon={Coins}
                        title="Nessuna donazione tracciata"
                        text="Devono ancora essere registrate transazioni di donazione (DONATE) nel clan ledger Wolvesville."
                    />
                ) : (
                    <div className="divide-y divide-neutral-800 max-h-[520px] overflow-y-auto">
                        {donations.map((d) => (
                            <div key={d.id} className="p-4 flex items-center gap-3 flex-wrap">
                                <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shrink-0">
                                    Donazione
                                </span>
                                <span className="font-semibold text-sm truncate">{d.playerUsername}</span>
                                <span className="text-amber-300 font-bold text-sm">
                                    {d.amount.toLocaleString("it-IT")} monete
                                </span>
                                <span className="flex-1" />
                                <span className="text-[11px] text-neutral-500 shrink-0">
                                    {new Date(d.eventTime).toLocaleString("it-IT")}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <details className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden group">
                <summary className="px-5 py-3 border-b border-neutral-800 text-sm font-bold cursor-pointer select-none list-none flex items-center justify-between">
                    <span className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-indigo-400" />
                        Membri del clan
                    </span>
                    <ChevronDown className="w-4 h-4 text-neutral-500 group-open:rotate-180 transition-transform" />
                </summary>
                {members.length === 0 ? (
                    <EmptyState compact icon={Users} title="Nessun membro" text="Nessun membro trovato." />
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left text-[11px] uppercase tracking-wider text-neutral-500 border-b border-neutral-800">
                                    <th className="px-4 py-2.5 font-semibold">Membro</th>
                                    <th className="px-4 py-2.5 font-semibold">Livello</th>
                                    <th className="px-4 py-2.5 font-semibold">XP</th>
                                    <th className="px-4 py-2.5 font-semibold">Ruolo</th>
                                    <th className="px-4 py-2.5 font-semibold">Ultimo accesso</th>
                                </tr>
                            </thead>
                            <tbody>
                                {members.map((m) => (
                                    <tr key={m.playerId} className="border-b border-neutral-800/60 last:border-0 hover:bg-neutral-900/60">
                                        <td className="px-4 py-2.5 font-semibold flex items-center gap-1.5">
                                            {m.isCoLeader && <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                                            {m.username}
                                        </td>
                                        <td className="px-4 py-2.5 text-neutral-300">{m.level}</td>
                                        <td className="px-4 py-2.5 text-neutral-300">{m.xp ?? "—"}</td>
                                        <td className="px-4 py-2.5 text-neutral-400">{m.isCoLeader ? "Co-leader" : "Membro"}</td>
                                        <td className="px-4 py-2.5 text-neutral-500 text-xs">
                                            {m.lastOnline ? new Date(m.lastOnline).toLocaleString("it-IT") : "—"}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </details>

            <details className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden group">
                <summary className="px-5 py-3 border-b border-neutral-800 text-sm font-bold cursor-pointer select-none list-none flex items-center justify-between">
                    <span className="flex items-center gap-2">
                        <List className="w-4 h-4 text-rose-400" />
                        Log generici del clan
                    </span>
                    <ChevronDown className="w-4 h-4 text-neutral-500 group-open:rotate-180 transition-transform" />
                </summary>
                {logs.length === 0 ? (
                    <EmptyState compact icon={List} title="Nessuna voce" text="L'API di Wolvesville espone solo l'evento più recente." />
                ) : (
                    <div className="divide-y divide-neutral-800">
                        {logs.map((l, i) => (
                            <div key={i} className="p-4 flex items-center gap-3">
                                <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 shrink-0">
                                    {l.action}
                                </span>
                                <span className="font-semibold text-sm truncate">{l.playerUsername || l.targetPlayerUsername || "—"}</span>
                                {l.comment && <span className="text-sm text-neutral-400 truncate">{l.comment}</span>}
                                <span className="flex-1" />
                                <span className="text-[11px] text-neutral-500 shrink-0">{new Date(l.creationTime).toLocaleString("it-IT")}</span>
                            </div>
                        ))}
                    </div>
                )}
            </details>

            <details className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden group">
                <summary className="px-5 py-3 border-b border-neutral-800 text-sm font-bold cursor-pointer select-none list-none flex items-center justify-between">
                    <span className="flex items-center gap-2">
                        <Activity className="w-4 h-4 text-violet-400" />
                        Ledger completo ({ledger.length} transazioni)
                    </span>
                    <ChevronDown className="w-4 h-4 text-neutral-500 group-open:rotate-180 transition-transform" />
                </summary>
                {ledger.length === 0 ? (
                    <EmptyState compact icon={Activity} title="Nessun dato" text="Il ledger Wolvesville è ancora vuoto o non leggibile." />
                ) : (
                    <div className="divide-y divide-neutral-800 max-h-[520px] overflow-y-auto">
                        {ledger.map((t) => (
                            <div key={t.id} className="p-4 flex items-center gap-3 flex-wrap">
                                <span className={classNames(
                                    "text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0 border",
                                    (t.type === "DONATE" || t.type === "GOLD_DONATION" || t.type === "GOLD_DEPOSIT")
                                        ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                                        : (t.gold < 0)
                                            ? "bg-rose-500/15 text-rose-300 border-rose-500/30"
                                            : "bg-violet-500/15 text-violet-300 border-violet-500/30"
                                )}>
                                    {t.type}
                                </span>
                                <span className="font-semibold text-sm truncate">{t.playerUsername || "Sistema"}</span>
                                {t.gold !== 0 && (
                                    <span className={classNames(
                                        "text-sm font-bold",
                                        t.gold > 0 ? "text-amber-300" : "text-rose-300"
                                    )}>
                                        {t.gold > 0 ? "+" : ""}{t.gold.toLocaleString("it-IT")} monete
                                    </span>
                                )}
                                {t.gems !== 0 && (
                                    <span className={classNames(
                                        "text-sm font-bold",
                                        t.gems > 0 ? "text-cyan-300" : "text-rose-300"
                                    )}>
                                        {t.gems > 0 ? "+" : ""}{t.gems} gemme
                                    </span>
                                )}
                                {t.comment && <span className="text-sm text-neutral-400 truncate">{t.comment}</span>}
                                <span className="flex-1" />
                                <span className="text-[11px] text-neutral-500 shrink-0">{new Date(t.creationTime).toLocaleString("it-IT")}</span>
                            </div>
                        ))}
                    </div>
                )}
            </details>
        </div>
    );
};

const Stat: React.FC<{ label: string; value: string; color: string }> = ({ label, value, color }) => (
    <div className="flex items-center justify-between p-3 rounded-xl bg-neutral-950 border border-neutral-800">
        <span className="text-xs text-neutral-400">{label}</span>
        <span className={`text-lg font-black text-${color}-300`}>{value}</span>
    </div>
);

const EmptyState: React.FC<{
    icon: any;
    title: string;
    text: string;
    compact?: boolean;
}> = ({ icon: Icon, title, text, compact }) => (
    <div className={classNames("flex flex-col items-center justify-center text-center bg-neutral-900/60 border border-dashed border-neutral-800 rounded-2xl", compact ? "py-8 px-5" : "py-16 px-5")}>
        <div className="w-12 h-12 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center mb-3">
            <Icon className="w-5 h-5 text-indigo-300" />
        </div>
        <div className="font-bold">{title}</div>
        <div className="text-sm text-neutral-400 mt-1 max-w-md">{text}</div>
    </div>
);
