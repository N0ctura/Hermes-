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
    Inbox,
    Cake,
    Menu,
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
    GuildJoinRequests,
    JoinRequestEntry,
    GuildProfileCardConfig,
    GuildBirthdayConfig,
    GuildDailyConfig,
    GuildTempleOnboarding,
    BirthdayEntry,
    DiscordMember,
    ScheduledMessage,
    AutoResponse,
    ClanOverviewDto,
    GuildActivityDto,
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

function toLocalDateTimeInput(value: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const offset = date.getTimezoneOffset();
    return new Date(date.getTime() - offset).toISOString().slice(0, 16);
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

const DEFAULT_PROFILE_CARD: CardConfig = {
    width: 780,
    height: 280,
    layers: [
        {
            id: uid(),
            type: "background",
            visible: true,
            x: 0,
            y: 0,
            width: 780,
            height: 280,
            color: "#0e0e0e",
            borderWidth: 0,
        },
        {
            id: uid(),
            type: "avatar",
            visible: true,
            x: 20,
            y: 30,
            width: 220,
            height: 220,
            borderRadius: 10,
            borderWidth: 3,
            borderColor: "#c0392b",
        },
        {
            id: uid(),
            type: "text",
            visible: true,
            x: 260,
            y: 24,
            width: 500,
            height: 60,
            text: "{username}",
            fontSize: 32,
            fontWeight: "bold",
            color: "#ffffff",
            textAlign: "left",
        },
        {
            id: uid(),
            type: "text",
            visible: true,
            x: 260,
            y: 64,
            width: 500,
            height: 30,
            text: "🏰 {clan}",
            fontSize: 14,
            color: "#a0a0a0",
            textAlign: "left",
        },
        {
            id: uid(),
            type: "text",
            visible: true,
            x: 260,
            y: 86,
            width: 500,
            height: 30,
            text: "{description}",
            fontSize: 13,
            fontWeight: "normal",
            color: "#888888",
            textAlign: "left",
        },
        {
            id: uid(),
            type: "text",
            visible: true,
            x: 260,
            y: 128,
            width: 250,
            height: 48,
            text: "PARTITE: {games}\nVITTORIE: {wins}",
            fontSize: 11,
            color: "#ffffff",
            textAlign: "left",
        },
        {
            id: uid(),
            type: "text",
            visible: true,
            x: 510,
            y: 128,
            width: 250,
            height: 48,
            text: "VILLAGGIO: {village_wins}\nLUPO: {wolf_wins}",
            fontSize: 11,
            color: "#ffffff",
            textAlign: "left",
        },
        {
            id: uid(),
            type: "text",
            visible: true,
            x: 260,
            y: 220,
            width: 500,
            height: 30,
            text: "🌹 {roses_received} ricevute   💌 {roses_sent} inviate",
            fontSize: 13,
            color: "#a0a0a0",
            textAlign: "left",
        },
    ],
};

const DEFAULT_BIRTHDAY_CARD: CardConfig = {
    width: 1440,
    height: 560,
    layers: [
        {
            id: uid(),
            type: "background",
            visible: true,
            x: 0,
            y: 0,
            width: 1440,
            height: 560,
            url: "/assets/compleanno.png",
            color: "#132133",
            borderWidth: 0,
        },
        {
            id: uid(),
            type: "avatar",
            visible: true,
            x: 570,
            y: 60,
            width: 300,
            height: 300,
            borderRadius: 150,
            borderWidth: 6,
            borderColor: "#5DADE2",
        },
        {
            id: uid(),
            type: "text",
            visible: true,
            x: 120,
            y: 380,
            width: 1200,
            height: 60,
            text: "🎉 Buon Compleanno! 🎉",
            fontSize: 52,
            fontWeight: "bold",
            color: "#ffffff",
            textAlign: "center",
        },
        {
            id: uid(),
            type: "text",
            visible: true,
            x: 120,
            y: 440,
            width: 1200,
            height: 56,
            text: "{USERNAME}",
            fontSize: 40,
            fontWeight: "bold",
            color: "#5DADE2",
            textAlign: "center",
        },
        {
            id: uid(),
            type: "text",
            visible: true,
            x: 120,
            y: 496,
            width: 1200,
            height: 40,
            text: "Tutto {SERVER_NAME} ti augura una giornata fantastica 🐺🌹",
            fontSize: 24,
            color: "#cfe3f2",
            textAlign: "center",
        },
    ],
};

const DEFAULT_BIRTHDAY_MESSAGE_TEMPLATE =
    "🎂 Oggi festeggiamo {USERNAME}! Tanti auguri di buon compleanno da tutto {SERVER_NAME}! 🎉";

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
    type: "welcome" | "leave" | "profile" | "birthday";
}

const PREVIEW_AVATAR =
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 300 300'%3E%3Crect width='300' height='300' fill='%23171b1f'/%3E%3Ccircle cx='150' cy='112' r='58' fill='%23dfbd55'/%3E%3Cpath d='M55 285c8-70 45-103 95-103s87 33 95 103' fill='%23dfbd55'/%3E%3C/svg%3E";

const CANVAS_TYPE_LABELS: Record<CanvasEditorProps["type"], string> = {
    welcome: "Welcome",
    leave: "Leave",
    profile: "Profile Card",
    birthday: "Compleanno",
};

function getDefaultCardForType(type: CanvasEditorProps["type"]): CardConfig {
    switch (type) {
        case "welcome": return DEFAULT_WELCOME_CARD;
        case "leave": return DEFAULT_LEAVE_CARD;
        case "profile": return DEFAULT_PROFILE_CARD;
        case "birthday": return DEFAULT_BIRTHDAY_CARD;
    }
}

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
        const canvasContext = ctx;
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
            // Difensivo: con w/h a 0 o negativi (es. mentre si digita un nuovo
            // valore nel campo numerico e per un istante il campo è vuoto/0),
            // un raggio negativo mandava in eccezione ctx.arcTo() e bloccava
            // il disegno dell'INTERO canvas (appariva tutto nero). Clampiamo
            // sempre a valori validi.
            const safeW = Math.max(1, w);
            const safeH = Math.max(1, h);
            const radius = Math.max(0, Math.min(r, safeW / 2, safeH / 2));
            ctx.beginPath();
            ctx.moveTo(x + radius, y);
            ctx.arcTo(x + safeW, y, x + safeW, y + safeH, radius);
            ctx.arcTo(x + safeW, y + safeH, x, y + safeH, radius);
            ctx.arcTo(x, y + safeH, x, y, radius);
            ctx.arcTo(x, y, x + safeW, y, radius);
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
                        canvasContext.drawImage(img, x, y, w, h);
                        if (needGrayscale) applyGrayscaleArea(x, y, w, h);
                        return true;
                    }
                    canvasContext.fillStyle = fallbackColor || "#2A2116";
                    canvasContext.fillRect(x, y, w, h);
                    canvasContext.fillStyle = "#A8967A";
                    canvasContext.font = "16px sans-serif";
                    canvasContext.textAlign = "center";
                    canvasContext.fillText(
                        "Caricamento immagine...",
                        x + w / 2,
                        y + h / 2
                    );
                    return true;
                } catch {
                    /* fallthrough to color */
                }
            }
            canvasContext.fillStyle = fallbackColor || "#201A13";
            canvasContext.fillRect(x, y, w, h);
            return false;
        }

        for (const layer of card.layers) {
            if (!layer.visible) continue;
            ctx.save();
            try {
            // Sanifica le dimensioni: un valore NaN/vuoto/non numerico salvato
            // in precedenza (es. campo lasciato vuoto mentre si digitava un
            // nuovo numero) non deve più bloccare il disegno dell'intero
            // canvas. Se il dato non è valido, ripieghiamo su un default
            // ragionevole invece di propagare NaN dentro le API canvas.
            const lx = Number.isFinite(layer.x) ? layer.x : 0;
            const ly = Number.isFinite(layer.y) ? layer.y : 0;
            const lw = Number.isFinite(layer.width) && layer.width > 0 ? layer.width : 180;
            const lh = Number.isFinite(layer.height) && layer.height > 0 ? layer.height : 180;
            if (layer.type === "background" || layer.type === "image" || layer.type === "avatar") {
                const url = layer.type === "avatar" ? PREVIEW_AVATAR : layer.url;
                const radius = layer.borderRadius ?? 0;
                const fallbackColor =
                    layer.type === "avatar" ? "#2A2116" : layer.color;
                drawRoundedRect(lx, ly, lw, lh, radius);
                ctx.clip();
                drawImageOrFallback(
                    url,
                    fallbackColor,
                    lx,
                    ly,
                    lw,
                    lh,
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
                        lx + inset,
                        ly + inset,
                        lw - (layer.borderWidth ?? 0),
                        lh - (layer.borderWidth ?? 0),
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
                text = text.replaceAll("{DATE}", "22 Agosto");
                text = text.replaceAll("{DAY}", "22");
                text = text.replaceAll("{MONTH}", "Agosto");
                // Profile card placeholders
                if (type === "profile") {
                    text = text.replaceAll("{username}", "Noctura");
                    text = text.replaceAll("{level}", "35");
                    text = text.replaceAll("{clan}", "Nessun clan");
                    text = text.replaceAll("{description}", "Strategist and part-time werewolf");
                    text = text.replaceAll("{games}", "142");
                    text = text.replaceAll("{wins}", "87 (61%)");
                    text = text.replaceAll("{village_wins}", "45");
                    text = text.replaceAll("{wolf_wins}", "42");
                    text = text.replaceAll("{winrate}", "61%");
                    text = text.replaceAll("{roses_received}", "28");
                    text = text.replaceAll("{roses_sent}", "15");
                }
                const lines = text.split("\n");
                const lineH = Math.round(fs * 1.3);
                const totalH = lines.length * lineH;
                const baseY = ly + Math.max(0, (lh - totalH) / 2) + lineH / 2;
                let x = lx;
                if (layer.textAlign === "center") x = lx + lw / 2;
                if (layer.textAlign === "right") x = lx + lw;
                lines.forEach((ln, idx) => {
                    ctx.fillText(ln, x, baseY + idx * lineH);
                });
            }
            } catch (err) {
                console.error("Errore disegno layer, salto al successivo:", layer.id, err);
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
            e.preventDefault();
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
                            Anteprima {CANVAS_TYPE_LABELS[type]}
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
                    style={{ maxHeight: 620, userSelect: "none", WebkitUserSelect: "none" }}
                >
                    <div className="relative" style={{ userSelect: "none" }}>
                        <canvas
                            onMouseDown={(e) => {
                                e.preventDefault();
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
                                                e.preventDefault();
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
                        onClick={() => onChange(JSON.parse(JSON.stringify(getDefaultCardForType(type))))}
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
                            <FieldNum label="W" value={selectedLayer.width} onChange={(v) => updateLayer(selectedLayer.id, { width: Math.max(10, v) })} />
                            <FieldNum label="H" value={selectedLayer.height} onChange={(v) => updateLayer(selectedLayer.id, { height: Math.max(10, v) })} />
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

type TabKey = "home" | "templeOnboarding" | "welcome" | "leave" | "autorole" | "messages" | "daily" | "autoResponses" | "tts" | "logs" | "activity" | "clan" | "joinRequests" | "profileCard" | "birthday";

const TABS: { key: TabKey; label: string; icon: any; asset: string }[] = [
    { key: "home", label: "Home", icon: LayoutDashboard, asset: "home-icon.png" },
    { key: "templeOnboarding", label: "Onboarding Templi", icon: Crown, asset: "icon-welcome.png" },
    { key: "welcome", label: "Welcome", icon: UserPlus, asset: "icon-welcome.png" },
    { key: "leave", label: "Leave", icon: UserMinus, asset: "icon-leave.png" },
    { key: "autorole", label: "Auto Role", icon: Shield, asset: "icon-avatar-shield.png" },
    { key: "messages", label: "Messaggi", icon: ListTodo, asset: "icon-announcements.png" },
    { key: "daily", label: "Daily", icon: MessageSquare, asset: "icon-daily.png" },
    { key: "autoResponses", label: "Autorisposte", icon: MessageSquare, asset: "icon-autoresponse.png" },
    { key: "tts", label: "TTS", icon: Volume2, asset: "icon-tts.png" },
    { key: "logs", label: "Logs", icon: Activity, asset: "icon-divider.png" },
    { key: "activity", label: "Attività server", icon: TrendingUp, asset: "icon-activity-server.png" },
    { key: "clan", label: "Clan Wolvesville", icon: Users, asset: "icon-clan-wov.png" },
    { key: "joinRequests", label: "Richieste Clan", icon: Inbox, asset: "icon-join-request-clan.png" },
    { key: "profileCard", label: "Profile Card", icon: User, asset: "icon-profile-card.png" },
    { key: "birthday", label: "Compleanni", icon: Cake, asset: "icon-birthday.png" },
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
    const [templeOnboardingConf, setTempleOnboardingConf] = useState<GuildTempleOnboarding | null>(null);
    const [ttsConf, setTtsConf] = useState<GuildTTS | null>(null);
    const [logsConf, setLogsConf] = useState<GuildLogs | null>(null);
    const [scheduled, setScheduled] = useState<ScheduledMessage[]>([]);
    const [dailyConf, setDailyConf] = useState<GuildDailyConfig | null>(null);
    const [autoResponses, setAutoResponses] = useState<AutoResponse[]>([]);
    const [dmLogs, setDmLogs] = useState<DeletedModifiedLogEntry[]>([]);
    const [clanOverview, setClanOverview] = useState<ClanOverviewDto | null>(null);
    const [clanError, setClanError] = useState<string | null>(null);
    const [clanLoading, setClanLoading] = useState(false);
    const [joinReqConf, setJoinReqConf] = useState<GuildJoinRequests | null>(null);
    const [joinRequestHistory, setJoinRequestHistory] = useState<JoinRequestEntry[]>([]);
    const [joinReqLoading, setJoinReqLoading] = useState(false);
    const [profileCardConf, setProfileCardConf] = useState<GuildProfileCardConfig | null>(null);
    const [birthdayConf, setBirthdayConf] = useState<GuildBirthdayConfig | null>(null);
    const [guildMembers, setGuildMembers] = useState<DiscordMember[]>([]);
    const [activity, setActivity] = useState<GuildActivityDto | null>(null);

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
            const results = await Promise.allSettled([
                apiCall<DiscordChannel[]>(`/api/guilds/${selectedGuildId}/channels`),
                apiCall<DiscordRole[]>(`/api/guilds/${selectedGuildId}/roles`),
                apiCall<GuildWelcomeLeave>(`/api/module/welcome-leave/${selectedGuildId}`),
                apiCall<GuildTempleOnboarding>(`/api/module/temple-onboarding/${selectedGuildId}`),
                apiCall<GuildTTS>(`/api/module/tts/${selectedGuildId}`),
                apiCall<GuildLogs>(`/api/module/logs/${selectedGuildId}`),
                apiCall<ScheduledMessage[]>(`/api/scheduled-messages/${selectedGuildId}`),
                apiCall<GuildDailyConfig>(`/api/module/daily/${selectedGuildId}`),
                apiCall<AutoResponse[]>(`/api/auto-responses/${selectedGuildId}`),
                apiCall<DeletedModifiedLogEntry[]>(`/api/logs/deleted-modified/${selectedGuildId}`),
                apiCall<GuildJoinRequests>(`/api/module/join-requests/${selectedGuildId}`),
                apiCall<GuildProfileCardConfig>(`/api/module/profile-card/${selectedGuildId}`),
                apiCall<GuildBirthdayConfig>(`/api/module/birthday/${selectedGuildId}`),
                apiCall<DiscordMember[]>(`/api/guilds/${selectedGuildId}/members`),
                apiCall<GuildActivityDto>(`/api/guilds/${selectedGuildId}/activity`),
            ]);
            const [chs, rls, wl, templeOnboarding, tts, lg, sch, daily, ars, dml, jr, pc, bd, mbrs, act] = results;
            if (chs.status === "fulfilled") setChannels(Array.isArray(chs.value) ? chs.value : []);
            if (rls.status === "fulfilled") setRoles(Array.isArray(rls.value) ? rls.value : []);
            if (wl.status === "fulfilled") setWlConf(wl.value);
            if (templeOnboarding.status === "fulfilled") setTempleOnboardingConf(templeOnboarding.value);
            if (tts.status === "fulfilled") setTtsConf(tts.value);
            if (lg.status === "fulfilled") setLogsConf(lg.value);
            if (sch.status === "fulfilled") setScheduled(sch.value);
            if (daily.status === "fulfilled") setDailyConf(daily.value);
            if (ars.status === "fulfilled") setAutoResponses(ars.value);
            if (dml.status === "fulfilled") setDmLogs(dml.value);
            if (jr.status === "fulfilled") setJoinReqConf(jr.value);
            if (pc.status === "fulfilled") setProfileCardConf(pc.value);
            if (bd.status === "fulfilled") setBirthdayConf(bd.value);
            if (mbrs.status === "fulfilled") setGuildMembers(mbrs.value);
            if (act.status === "fulfilled") setActivity(act.value);

            const failed = results.filter((result) => result.status === "rejected").length;
            if (failed > 0) showToast("err", `${failed} modulo/i non disponibili al momento`);
        } finally {
            setLoading(false);
        }
    }, [selectedGuildId]);

    useEffect(() => {
        if (authed !== "yes" || !selectedGuildId) return;
        loadGuildData();
    }, [authed, selectedGuildId]);

    useEffect(() => {
        if (authed !== "yes" || !selectedGuildId) return;
        const refreshActivityAndLogs = () => {
            Promise.all([
                apiCall<GuildActivityDto>(`/api/guilds/${selectedGuildId}/activity`),
                apiCall<DeletedModifiedLogEntry[]>(`/api/logs/deleted-modified/${selectedGuildId}`),
            ]).then(([nextActivity, nextLogs]) => {
                setActivity(nextActivity);
                setDmLogs(nextLogs);
            }).catch(() => {
                /* Keep the last known activity when a refresh is temporarily unavailable. */
            });
        };
        const id = window.setInterval(refreshActivityAndLogs, 20_000);
        return () => window.clearInterval(id);
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

    /* ---------- Richieste Clan: storico notifiche ---------- */
    const loadJoinRequestHistory = React.useCallback(async () => {
        setJoinReqLoading(true);
        try {
            const data = await apiCall<{ history: JoinRequestEntry[] }>("/api/clan/join-requests");
            setJoinRequestHistory(data.history ?? []);
        } catch (e: any) {
            showToast("err", e?.message || "Errore caricamento richieste clan");
        } finally {
            setJoinReqLoading(false);
        }
    }, []);

    useEffect(() => {
        if (authed !== "yes") return;
        loadJoinRequestHistory();
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
            setWlConf(wlConf);
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
            setTtsConf(ttsConf);
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
            setLogsConf(logsConf);
            showToast("err", e?.message || "Salvataggio fallito");
        } finally {
            setSaving(false);
        }
    };

    const saveTempleOnboarding = async (patch: Partial<GuildTempleOnboarding>) => {
        if (!templeOnboardingConf) return;
        const next = { ...templeOnboardingConf, ...patch };
        setTempleOnboardingConf(next);
        setSaving(true);
        try {
            const saved = await apiCall<GuildTempleOnboarding>(`/api/module/temple-onboarding/${selectedGuildId}`, { method: "PUT", body: JSON.stringify(next) });
            setTempleOnboardingConf(saved);
            showToast("ok", "Onboarding Templi salvato");
        } catch (e: any) {
            setTempleOnboardingConf(templeOnboardingConf);
            showToast("err", e?.message || "Salvataggio fallito");
        } finally { setSaving(false); }
    };

    const saveJoinRequests = async (patch: Partial<GuildJoinRequests>) => {
        if (!joinReqConf) return;
        const next = { ...joinReqConf, ...patch };
        setJoinReqConf(next);
        setSaving(true);
        try {
            await apiCall(`/api/module/join-requests/${selectedGuildId}`, {
                method: "PUT",
                body: JSON.stringify(next),
            });
            showToast("ok", "Config Richieste Clan salvata");
        } catch (e: any) {
            setJoinReqConf(joinReqConf);
            showToast("err", e?.message || "Salvataggio fallito");
        } finally {
            setSaving(false);
        }
    };

    const saveProfileCard = async (patch: Partial<GuildProfileCardConfig>) => {
        if (!profileCardConf) return;
        const next = { ...profileCardConf, ...patch };
        setProfileCardConf(next);
        setSaving(true);
        try {
            await apiCall(`/api/module/profile-card/${selectedGuildId}`, {
                method: "PUT",
                body: JSON.stringify(next),
            });
            showToast("ok", "Profile Card salvata");
        } catch (e: any) {
            setProfileCardConf(profileCardConf);
            showToast("err", e?.message || "Salvataggio fallito");
        } finally {
            setSaving(false);
        }
    };

    const saveBirthday = async (patch: Partial<GuildBirthdayConfig>) => {
        if (!birthdayConf) return;
        const next = { ...birthdayConf, ...patch };
        setBirthdayConf(next);
        setSaving(true);
        try {
            const saved = await apiCall<GuildBirthdayConfig>(`/api/module/birthday/${selectedGuildId}`, {
                method: "PUT",
                body: JSON.stringify(patch),
            });
            setBirthdayConf(saved);
            showToast("ok", "Config Compleanni salvata");
        } catch (e: any) {
            setBirthdayConf(birthdayConf);
            showToast("err", e?.message || "Salvataggio fallito");
        } finally {
            setSaving(false);
        }
    };

    const addBirthdayEntry = async (entry: { userId: string; username: string; day: number; month: number }) => {
        setSaving(true);
        try {
            const saved = await apiCall<GuildBirthdayConfig>(`/api/module/birthday/${selectedGuildId}/entries`, {
                method: "POST",
                body: JSON.stringify(entry),
            });
            setBirthdayConf(saved);
            showToast("ok", `Compleanno di ${entry.username} salvato`);
        } catch (e: any) {
            showToast("err", e?.message || "Salvataggio fallito");
        } finally {
            setSaving(false);
        }
    };

    const removeBirthdayEntry = async (userId: string) => {
        setSaving(true);
        try {
            const saved = await apiCall<GuildBirthdayConfig>(`/api/module/birthday/${selectedGuildId}/entries/${userId}`, {
                method: "DELETE",
            });
            setBirthdayConf(saved);
            showToast("ok", "Compleanno rimosso");
        } catch (e: any) {
            showToast("err", e?.message || "Rimozione fallita");
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

    const saveDaily = async (patch: Partial<GuildDailyConfig>) => {
        if (!dailyConf) return;
        const next = { ...dailyConf, ...patch };
        setDailyConf(next);
        setSaving(true);
        try {
            const saved = await apiCall<GuildDailyConfig>(`/api/module/daily/${selectedGuildId}`, {
                method: "PUT",
                body: JSON.stringify(next),
            });
            setDailyConf(saved);
            showToast("ok", "Daily salvato");
        } catch (e: any) {
            setDailyConf(dailyConf);
            showToast("err", e?.message || "Salvataggio fallito");
        } finally {
            setSaving(false);
        }
    };

    const runDailyTest = async () => {
        if (!selectedGuildId) return;
        setSaving(true);
        try {
            const saved = await apiCall<GuildDailyConfig>(`/api/module/daily/${selectedGuildId}/test`, {
                method: "POST",
            });
            setDailyConf(saved);
            showToast("ok", "Test Daily avviato");
        } catch (e: any) {
            showToast("err", e?.message || "Errore avvio test Daily");
        } finally {
            setSaving(false);
        }
    };

    const closeDailyTest = async () => {
        if (!selectedGuildId) return;
        setSaving(true);
        try {
            const saved = await apiCall<GuildDailyConfig>(`/api/module/daily/${selectedGuildId}/close`, {
                method: "POST",
            });
            setDailyConf(saved);
            showToast("ok", "Daily di test chiusa");
        } catch (e: any) {
            showToast("err", e?.message || "Errore chiusura test Daily");
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

    const saveAutoResponse = async (response: AutoResponse) => {
        setSaving(true);
        try {
            const saved = await apiCall<AutoResponse>(`/api/auto-responses/${selectedGuildId}`, { method: "PUT", body: JSON.stringify(response) });
            setAutoResponses((arr) => arr.some((item) => item.id === saved.id) ? arr.map((item) => item.id === saved.id ? saved : item) : [...arr, saved]);
            showToast("ok", "Autorisposta salvata");
        } catch (e: any) { showToast("err", e?.message || "Salvataggio fallito"); }
        finally { setSaving(false); }
    };

    const deleteAutoResponse = async (id: string) => {
        setSaving(true);
        try {
            await apiCall(`/api/auto-responses/${selectedGuildId}/${id}`, { method: "DELETE" });
            setAutoResponses((arr) => arr.filter((item) => item.id !== id));
            showToast("ok", "Autorisposta eliminata");
        } catch (e: any) { showToast("err", e?.message || "Eliminazione fallita"); }
        finally { setSaving(false); }
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
        <div className="hermes-app-shell h-screen flex bg-[#0D0906] text-[#EDE3C8] overflow-hidden">
            {/* Rail dei server: un medaglione per ogni server dove Ade è presente */}
            <nav className="hermes-server-rail w-[72px] shrink-0 bg-[#0A0705] border-r border-[#241B12] flex flex-col items-center py-3 gap-2 overflow-y-auto">
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
            <aside className="hermes-nav-panel w-[248px] shrink-0 bg-[#15100B] border-r border-[#241B12] flex flex-col">
                <div className="px-4 py-4 border-b border-[#241B12] flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-[#B8912A]/15 border border-[#B8912A]/40 flex items-center justify-center shrink-0">
                        <Sparkles className="w-4 h-4 text-[#E4C468]" />
                    </div>
                    <div className="min-w-0">
                        <div className="font-display font-bold tracking-wide text-[#EDE3C8] leading-tight">Hermes</div>
                        <div className="text-[11px] text-[#7C6A4C] truncate">
                            {guilds.find((g) => g.id === selectedGuildId)?.name || "Nessun server"}
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
                    <div className="px-2.5 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-widest text-[#5C4E38]">Generale</div>
                    {TABS.slice(0, 8).map((t) => {
                        const active = tab === t.key;
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
                                <img src={`/assets/dashboard-icons/${t.asset}`} alt="" className="w-4 h-4 shrink-0 object-contain" />
                                <span className="font-medium truncate">{t.label}</span>
                            </button>
                        );
                    })}
                    <div className="px-2.5 pt-5 pb-1 text-[10px] font-semibold uppercase tracking-widest text-[#5C4E38]">Clan</div>
                    {TABS.slice(8).map((t) => {
                        const active = tab === t.key;
                        return (
                            <button key={t.key} onClick={() => setTab(t.key)} className={classNames(
                                "w-full text-left pl-3 pr-3 py-2 rounded-lg text-sm inline-flex items-center gap-2.5 transition-colors border-l-2",
                                active ? "bg-[#B8912A]/12 border-[#B8912A] text-[#E4C468]" : "border-transparent text-[#B5A583] hover:bg-[#1C150E] hover:text-[#EDE3C8]"
                            )}>
                                <img src={`/assets/dashboard-icons/${t.asset}`} alt="" className="w-4 h-4 shrink-0 object-contain" /><span className="font-medium truncate">{t.label}</span>
                            </button>
                        );
                    })}
                </div>

                <div className="p-2.5 border-t border-[#241B12] flex items-center gap-2">
                    <span className={classNames("w-2 h-2 rounded-full shrink-0", status?.online ? "bg-emerald-400" : "bg-rose-500")} />
                    <span className="text-xs text-[#7C6A4C]">Bot</span>
                    <span className="text-xs font-semibold text-[#EDE3C8]">{status?.online ? "Online" : "Offline"}</span>
                    <div className="flex-1" />
                    {saving && <span title="Salvando..."><Save className="w-3.5 h-3.5 text-[#E4C468] animate-pulse" /></span>}
                </div>
            </aside>

            {/* Contenuto della sezione selezionata */}
            <main className="hermes-main flex-1 min-w-0 overflow-y-auto">
                <header className="hermes-topbar h-16 shrink-0 px-7 flex items-center gap-3 border-b border-[#241B12]">
                    <Menu className="w-5 h-5 text-[#A8967A]" />
                    <span className="font-display text-lg font-bold text-[#F1F1ED]">{TABS.find((item) => item.key === tab)?.label || "Home"}</span>
                    <span className="text-xs text-[#7C6A4C]">— {guilds.find((g) => g.id === selectedGuildId)?.name || "Nessun server"}</span>
                    <span className="flex-1" />
                    <span className="hidden sm:inline-flex items-center gap-2 text-xs text-[#A8967A]"><span className="w-2 h-2 rounded-full bg-emerald-400" /> {status?.online ? "Online" : "Offline"}</span>
                </header>
                <div className="max-w-[1200px] mx-auto px-6 py-6">
                    {tab === "home" && <TabHome status={status} activity={activity} members={guildMembers} />}
                    {tab === "templeOnboarding" && templeOnboardingConf && (
                        <TabTempleOnboarding conf={templeOnboardingConf} channels={textChannels} roles={roles} onChange={saveTempleOnboarding} />
                    )}
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
                    {tab === "daily" && (
                        <TabDaily
                            channels={textChannels}
                            roles={roles}
                            conf={dailyConf}
                            onSave={saveDaily}
                            onRunTest={runDailyTest}
                            onCloseTest={closeDailyTest}
                        />
                    )}
                    {tab === "autoResponses" && <TabAutoResponses list={autoResponses} onSave={saveAutoResponse} onDelete={deleteAutoResponse} />}
                    {tab === "tts" && ttsConf && (
                        <TabTTS conf={ttsConf} textChannels={textChannels} voiceChannels={voiceChannels} onChange={saveTts} />
                    )}
                    {tab === "logs" && logsConf && (
                        <TabLogs conf={logsConf} channels={textChannels} onChange={saveLogs} entries={dmLogs} onRefresh={loadGuildData} />
                    )}
                    {tab === "activity" && <ActivityChart activity={activity} members={guildMembers} fullPage />}
                    {tab === "clan" && (
                        <TabClan data={clanOverview} error={clanError} loading={clanLoading} onRefresh={loadClanOverview} />
                    )}
                    {tab === "joinRequests" && joinReqConf && (
                        <TabJoinRequests
                            conf={joinReqConf}
                            channels={textChannels}
                            roles={roles}
                            history={joinRequestHistory}
                            loading={joinReqLoading}
                            onChange={saveJoinRequests}
                            onRefresh={loadJoinRequestHistory}
                        />
                    )}
                    {tab === "profileCard" && profileCardConf && (
                        <TabProfileCard conf={profileCardConf} onChange={saveProfileCard} />
                    )}
                    {tab === "birthday" && birthdayConf && (
                        <TabBirthday
                            conf={birthdayConf}
                            channels={textChannels}
                            roles={roles}
                            members={guildMembers}
                            onChange={saveBirthday}
                            onAddEntry={addBirthdayEntry}
                            onRemoveEntry={removeBirthdayEntry}
                        />
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

const TabHome: React.FC<{ status: BotStatusDto | null; activity: GuildActivityDto | null; members: DiscordMember[] }> = ({ status, activity, members }) => {
    if (!status) return <EmptyState icon={Activity} title="Stato non disponibile" text="Ricarica tra pochi secondi..." />;
    const items: { label: string; value: string; icon: any; color: string }[] = [
        { label: "Uptime", value: formatUptime(status.uptimeSeconds), icon: Clock, color: "indigo" },
        { label: "Server", value: String(status.guildsCount), icon: Server, color: "emerald" },
        { label: "Membri", value: String(status.membersCount), icon: User, color: "amber" },
        { label: "Ping", value: `${status.pingMs} ms`, icon: Activity, color: "sky" },
    ];
    return (
        <div className="space-y-5 animate-fade-in">
            <div className="hermes-home-banner relative overflow-hidden border border-[#C9A227]/30 rounded-[10px]" aria-label="Hermes" />
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

            <ActivityChart activity={activity} members={members} />
        </div>
    );
};

const ActivityChart: React.FC<{ activity: GuildActivityDto | null; members: DiscordMember[]; fullPage?: boolean }> = ({ activity, members, fullPage = false }) => {
    const [range, setRange] = useState<7 | 30 | 90 | 360>(30);
    const [userSearch, setUserSearch] = useState("");
    const [hiddenUsers, setHiddenUsers] = useState<Set<string>>(new Set());
    const allDays = activity?.days ?? [];
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const daysByDate = new Map(allDays.map((day) => [day.date, day]));
    const days = Array.from({ length: range }, (_, index) => {
        const date = new Date(today);
        date.setUTCDate(today.getUTCDate() - (range - 1 - index));
        const dateKey = date.toISOString().slice(0, 10);
        return daysByDate.get(dateKey) ?? { date: dateKey, messages: {}, voiceSeconds: {} };
    });
    const memberNames = new Map(members.map((member) => [member.id, member.displayName || member.username]));
    const users = [...(activity?.users ?? [])].map((user) => ({
        ...user,
        name: memberNames.get(user.userId) || `Utente ${user.userId.slice(-6)}`,
    }));
    const totals = new Map(users.map((user) => [user.userId, { messages: 0, voiceSeconds: 0 }]));
    for (const day of days) {
        for (const [userId, count] of Object.entries(day.messages)) {
            const total = totals.get(userId) || { messages: 0, voiceSeconds: 0 };
            total.messages += count;
            totals.set(userId, total);
        }
        for (const [userId, seconds] of Object.entries(day.voiceSeconds)) {
            const total = totals.get(userId) || { messages: 0, voiceSeconds: 0 };
            total.voiceSeconds += seconds;
            totals.set(userId, total);
        }
    }
    const periodUsers = users.map((user) => ({ ...user, ...(totals.get(user.userId) || { messages: 0, voiceSeconds: 0 }) }))
        .filter((user) => user.messages > 0 || user.voiceSeconds > 0)
        .sort((a, b) => (b.messages + b.voiceSeconds / 3600) - (a.messages + a.voiceSeconds / 3600));
    const totalMessages = periodUsers.reduce((sum, user) => sum + user.messages, 0);
    const totalVoiceHours = periodUsers.reduce((sum, user) => sum + user.voiceSeconds, 0) / 3600;
    const matchingUsers = periodUsers.filter((user) => user.name.toLowerCase().includes(userSearch.trim().toLowerCase()));
    const chartUsers = matchingUsers.filter((user) => !hiddenUsers.has(user.userId));
    const width = 900;
    const height = fullPage ? 360 : 300;
    const pad = { left: 42, right: 18, top: 24, bottom: 42 };
    const innerWidth = width - pad.left - pad.right;
    const innerHeight = height - pad.top - pad.bottom;
    const maxMessages = Math.max(1, ...days.flatMap((day) => periodUsers.map((user) => day.messages[user.userId] ?? 0)));
    const maxVoiceHours = Math.max(1, ...days.flatMap((day) => periodUsers.map((user) => (day.voiceSeconds[user.userId] ?? 0) / 3600)));
    const colors = ["#E4C468", "#D98B4A", "#72B8A5", "#9B8FD4", "#7CA6D9", "#C75C6B", "#B7A15B", "#C7C9CE"];
    const xFor = (index: number) => days.length <= 1 ? pad.left + innerWidth / 2 : pad.left + (index / (days.length - 1)) * innerWidth;
    const pointsFor = (userId: string, metric: "messages" | "voice") => days.map((day, index) => {
        const value = metric === "messages" ? day.messages[userId] ?? 0 : (day.voiceSeconds[userId] ?? 0) / 3600;
        const max = metric === "messages" ? maxMessages : maxVoiceHours;
        return `${xFor(index)},${pad.top + innerHeight - (value / max) * innerHeight}`;
    }).join(" ");

    return (
        <section className="hermes-activity-panel bg-neutral-900 border border-neutral-800 rounded-[14px] p-5 space-y-5">
            <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                    <div className="text-[10px] uppercase tracking-[0.2em] font-extrabold text-[#B8983F] mb-2">Analytics / Activity</div>
                    <h2 className="text-xl md:text-2xl font-black tracking-tight flex items-center gap-2"><TrendingUp className="w-5 h-5 text-[#E4C468]" /> Attività utenti</h2>
                    <p className="text-sm text-neutral-400 mt-1">Una linea per ogni utente: messaggi solidi, ore vocali tratteggiate.</p>
                </div>
                <div className="flex items-center gap-1 p-1 bg-neutral-950 border border-neutral-800 rounded-xl">
                    {[7, 30, 90, 360].map((value) => (
                        <button key={value} onClick={() => setRange(value as 7 | 30 | 90 | 360)} className={classNames("px-3 py-1.5 rounded-lg text-xs font-bold transition-colors", range === value ? "bg-[#C9A227] text-[#1a1410]" : "text-neutral-400 hover:text-neutral-100")}>
                            {value}g
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
                <div className="flex-1 relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                    <input value={userSearch} onChange={(event) => setUserSearch(event.target.value)} placeholder="Cerca una persona nel grafico..." className="w-full bg-neutral-950 border border-neutral-800 rounded-lg pl-9 pr-3 py-2.5 text-sm" />
                </div>
                <button onClick={() => setHiddenUsers(new Set())} className="px-3 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold text-neutral-300">Mostra tutti</button>
            </div>

            <div className="grid grid-cols-2 gap-3 md:max-w-lg">
                <Stat label="Messaggi nel periodo" value={totalMessages.toLocaleString("it-IT")} color="amber" />
                <Stat label="Ore in vocale" value={totalVoiceHours.toLocaleString("it-IT", { maximumFractionDigits: 1 })} color="amber" />
            </div>

            {days.length === 0 ? (
                <EmptyState compact icon={Activity} title="Ancora nessuna attività" text="I dati verranno raccolti da ora in poi mentre gli utenti scrivono o entrano nei canali vocali." />
            ) : (
                <>
                    <div className="hermes-chart-frame overflow-hidden rounded-xl border border-white/[0.06] bg-[#080A0C]/75">
                        <div className="flex items-center justify-between px-4 pt-4">
                            <div><div className="text-xs font-bold uppercase tracking-[0.14em] text-neutral-500">Andamento giornaliero</div><div className="text-[11px] text-neutral-600 mt-1">Top {chartUsers.length} utenti del periodo selezionato</div></div>
                            <div className="flex flex-wrap justify-end gap-2 max-w-[70%] max-h-20 overflow-auto">
                                {matchingUsers.map((user, index) => <button key={user.userId} onClick={() => setHiddenUsers((current) => { const next = new Set(current); if (next.has(user.userId)) next.delete(user.userId); else next.add(user.userId); return next; })} className={classNames("inline-flex items-center gap-1.5 text-[10px] rounded-md px-1.5 py-1 transition-opacity", hiddenUsers.has(user.userId) ? "opacity-30 line-through" : "text-neutral-500 hover:text-neutral-200")}><i className="w-2 h-2 rounded-full" style={{ background: colors[index % colors.length] }} />{user.name}</button>)}
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-[300px]" style={{ minWidth: Math.max(680, days.length * 28) }} role="img" aria-label="Grafico attività utenti">
                                {[0, .25, .5, .75, 1].map((tick) => <line key={tick} x1={pad.left} x2={width - pad.right} y1={pad.top + innerHeight - tick * innerHeight} y2={pad.top + innerHeight - tick * innerHeight} stroke="rgba(255,255,255,.055)" />)}
                                {chartUsers.map((user, index) => <g key={user.userId}>
                                    <polyline points={pointsFor(user.userId, "messages")} fill="none" stroke={colors[index % colors.length]} strokeOpacity=".16" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
                                    <polyline points={pointsFor(user.userId, "messages")} fill="none" stroke={colors[index % colors.length]} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                                    <polyline points={pointsFor(user.userId, "voice")} fill="none" stroke={colors[index % colors.length]} strokeOpacity=".72" strokeWidth="1.5" strokeDasharray="5 5" strokeLinecap="round" strokeLinejoin="round" />
                                    {days.map((day, dayIndex) => {
                                        const messages = day.messages[user.userId] ?? 0;
                                        const voiceHours = (day.voiceSeconds[user.userId] ?? 0) / 3600;
                                        if (!messages && !voiceHours) return null;
                                        const color = colors[index % colors.length];
                                        return <g key={`${user.userId}-${day.date}`}>
                                            {messages > 0 && <circle cx={xFor(dayIndex)} cy={pad.top + innerHeight - (messages / maxMessages) * innerHeight} r="2.5" fill="#080A0C" stroke={color} strokeWidth="1.3"><title>{`${user.name}: ${messages} messaggi`}</title></circle>}
                                            {voiceHours > 0 && <circle cx={xFor(dayIndex)} cy={pad.top + innerHeight - (voiceHours / maxVoiceHours) * innerHeight} r="2.5" fill="#080A0C" stroke="#AEB5BB" strokeWidth="1.3"><title>{`${user.name}: ${voiceHours.toLocaleString("it-IT", { maximumFractionDigits: 1 })} ore vocali`}</title></circle>}
                                        </g>;
                                    })}
                                </g>)}
                                {days.map((day, index) => index % Math.max(1, Math.floor(days.length / 6)) === 0 ? <text key={day.date} x={xFor(index)} y={height - 10} textAnchor="middle" fill="#626970" fontSize="9">{new Date(`${day.date}T12:00:00`).toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit" })}</text> : null)}
                            </svg>
                        </div>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-neutral-500">
                        <span className="inline-flex items-center gap-1.5"><i className="w-5 border-t-2 border-[#E4C468]" /> Messaggi</span>
                        <span className="inline-flex items-center gap-1.5"><i className="w-5 border-t border-dashed border-[#9AA1A8]" /> Ore vocali</span>
                    </div>
                    <div className="border-t border-neutral-800 pt-4">
                        <div className="flex items-center justify-between gap-3 mb-3"><div><h3 className="text-sm font-bold text-neutral-200">Dettaglio attività</h3><p className="text-[11px] text-neutral-600 mt-1">Distribuzione per utente nel periodo selezionato.</p></div><span className="text-[10px] uppercase tracking-[0.15em] text-neutral-600">{chartUsers.length}/{periodUsers.length} visibili</span></div>
                        {matchingUsers.length === 0 ? <p className="text-xs text-neutral-500">Nessun utente corrisponde al filtro attuale.</p> : (
                            <div className="space-y-2.5">
                                {matchingUsers.map((user, index) => {
                                    const name = user.name;
                                    const messageWidth = totalMessages ? (user.messages / totalMessages) * 100 : 0;
                                    const voiceWidth = totalVoiceHours ? (user.voiceSeconds / 3600 / totalVoiceHours) * 100 : 0;
                                    return (
                                        <div key={user.userId} className="hermes-user-row grid grid-cols-[minmax(110px,1fr)_minmax(180px,2fr)_auto] items-center gap-3 text-xs rounded-xl px-3 py-2">
                                            <span className={classNames("min-w-0 font-semibold text-neutral-200 flex items-center gap-2", hiddenUsers.has(user.userId) && "opacity-45")} title={name}>
                                                <i className="w-2 h-2 rounded-full shrink-0" style={{ background: colors[index % colors.length] }} />
                                                <span className="truncate">{name}</span>
                                                <button
                                                    type="button"
                                                    title={hiddenUsers.has(user.userId) ? "Mostra nel grafico" : "Nascondi dal grafico"}
                                                    aria-label={hiddenUsers.has(user.userId) ? `Mostra ${name} nel grafico` : `Nascondi ${name} dal grafico`}
                                                    onClick={() => setHiddenUsers((current) => {
                                                        const next = new Set(current);
                                                        if (next.has(user.userId)) next.delete(user.userId);
                                                        else next.add(user.userId);
                                                        return next;
                                                    })}
                                                    className="shrink-0 rounded p-0.5 hover:bg-neutral-700"
                                                >
                                                    <img src="/assets/dashboard-icons/icon-eye.png" alt="" className={classNames("w-4 h-4 object-contain", hiddenUsers.has(user.userId) && "opacity-40")} />
                                                </button>
                                            </span>
                                            <div className="space-y-1">
                                                <div className="h-1.5 bg-neutral-950 rounded-full overflow-hidden"><div className="h-full rounded-full" style={{ width: `${messageWidth}%`, background: colors[index % colors.length] }} /></div>
                                                <div className="h-1.5 bg-neutral-950 rounded-full overflow-hidden"><div className="h-full bg-[#7D858C] rounded-full" style={{ width: `${voiceWidth}%` }} /></div>
                                            </div>
                                            <span className="text-right text-neutral-400 whitespace-nowrap">{user.messages.toLocaleString("it-IT")} · {(user.voiceSeconds / 3600).toLocaleString("it-IT", { maximumFractionDigits: 1 })}h</span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </>
            )}
        </section>
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

const TabTempleOnboarding: React.FC<{
    conf: GuildTempleOnboarding;
    channels: DiscordChannel[];
    roles: DiscordRole[];
    onChange: (patch: Partial<GuildTempleOnboarding>) => Promise<void>;
}> = ({ conf, channels, roles, onChange }) => {
    const templeNames: Record<string, string> = { rinascita: "Tempio della Rinascita", abisso: "Tempio degli Abissi", eclissi: "Tempio dell'Eclissi", folgori: "Tempio delle Folgori" };
    const updateTemple = (key: string, patch: any) => onChange({ temples: conf.temples.map((t) => t.key === key ? { ...t, ...patch } : t) });
    const toggleRole = (key: string, roleId: string) => {
        const t = conf.temples.find((x) => x.key === key); if (!t) return;
        const set = new Set(t.coLeaderRoleIds ?? []); set.has(roleId) ? set.delete(roleId) : set.add(roleId);
        updateTemple(key, { coLeaderRoleIds: [...set] });
    };
    const selectedApproval = new Set(conf.approvalRoleIds ?? []);
    const toggleApprovalRole = (id: string) => { const n = new Set(selectedApproval); n.has(id) ? n.delete(id) : n.add(id); onChange({ approvalRoleIds: [...n] }); };
    const selectedBlocked = new Set(conf.blockedInteractionRoleIds ?? []);
    const toggleBlockedRole = (id: string) => { const n = new Set(selectedBlocked); n.has(id) ? n.delete(id) : n.add(id); onChange({ blockedInteractionRoleIds: [...n] }); };
    return <div className="space-y-5 animate-fade-in">
        <div className="flex items-center justify-between gap-4"><div><h1 className="text-2xl font-black tracking-tight">Onboarding Templi</h1><p className="text-sm text-neutral-400 mt-1">Ingresso, equilibrio, approvazione dei co-capi e ruoli automatici.</p></div><label className="inline-flex items-center gap-2"><Toggle value={!!conf.enabled} onChange={(enabled) => onChange({ enabled })} /><span className="text-sm font-semibold">{conf.enabled ? "Attivo" : "Disattivato"}</span></label></div>
        <div className="bg-red-950/30 border border-red-900/60 rounded-2xl p-5 space-y-3">
            <h3 className="font-bold text-red-200">Ruoli bloccati dai nuovi arrivati</h3>
            <p className="text-xs text-red-200/70">Chi ha uno di questi ruoli NON può in nessun caso interagire con offerta modulo, scelta Tempio o approvazione — vale anche per Amministratori del server. Impostazione indipendente da tutto il resto (es. ruolo "pellegrino").</p>
            <div className="max-h-40 overflow-y-auto space-y-1">{roles.filter(r => !r.managed).map(r => <label key={r.id} className="flex items-center gap-2 text-xs p-1.5 rounded bg-neutral-950"><input type="checkbox" checked={selectedBlocked.has(r.id)} onChange={() => toggleBlockedRole(r.id)} />{r.name}</label>)}</div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 space-y-4"><h3 className="font-bold">Ingresso</h3>
                <Field label="Canale scelta Tempio"><select value={conf.selectionChannelId ?? ""} onChange={e => onChange({ selectionChannelId: e.target.value })} className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2.5 text-sm"><option value="">— seleziona —</option>{channels.map(c => <option key={c.id} value={c.id}>#{c.name}</option>)}</select></Field>
                <Field label="Messaggio scelta (4, 3 o 2 Templi)"><textarea rows={7} value={conf.selectionMessage ?? ""} onChange={e => onChange({ selectionMessage: e.target.value })} className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2.5 text-sm resize-none" /></Field>
                <Field label="Messaggio scelta obbligata (1 solo Tempio)"><textarea rows={5} value={conf.forcedSelectionMessage ?? ""} onChange={e => onChange({ forcedSelectionMessage: e.target.value })} className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2.5 text-sm resize-none" /></Field>
                <div className="text-[11px] text-neutral-500">Variabili: {"{USER}"}, {"{USERNAME}"}, {"{TEMPLE_DETAILS}"}, {"{MIN}"}. {"{TEMPLE_DETAILS}"} viene costruito automaticamente usando solo i Templi disponibili.</div>
            </div>
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 space-y-4"><h3 className="font-bold">Approvazione</h3>
                <Field label="Canale co-capi"><select value={conf.approvalChannelId ?? ""} onChange={e => onChange({ approvalChannelId: e.target.value })} className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2.5 text-sm"><option value="">— seleziona —</option>{channels.map(c => <option key={c.id} value={c.id}>#{c.name}</option>)}</select></Field>
                <Field label="Canale generale"><select value={conf.generalChannelId ?? ""} onChange={e => onChange({ generalChannelId: e.target.value })} className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2.5 text-sm"><option value="">— seleziona —</option>{channels.map(c => <option key={c.id} value={c.id}>#{c.name}</option>)}</select></Field>
                <Field label="Ruoli autorizzati globali"><div className="max-h-32 overflow-y-auto space-y-1">{roles.filter(r => !r.managed).map(r => <label key={r.id} className="flex items-center gap-2 text-xs p-1.5 rounded bg-neutral-950"><input type="checkbox" checked={selectedApproval.has(r.id)} onChange={() => toggleApprovalRole(r.id)} />{r.name}</label>)}</div></Field>
                <Field label="Messaggio: chiedi ai co-capi se inviare il modulo"><textarea rows={4} value={conf.moduleOfferMessage ?? ""} onChange={e => onChange({ moduleOfferMessage: e.target.value })} className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2.5 text-sm resize-none" /></Field>
                <div className="text-[11px] text-neutral-500">Variabili: {"{USER}"}, {"{USERNAME}"}. Il modulo viene inviato solo dopo <b>Invia modulo</b>.</div>
            </div>
        </div>
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5"><h3 className="font-bold mb-4">Automazioni post-approvazione</h3><div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <label className="flex items-center gap-2"><Toggle value={!!conf.assignTempleRole} onChange={assignTempleRole => onChange({ assignTempleRole })} /> Assegna ruolo Tempio</label>
            <label className="flex items-center gap-2"><Toggle value={!!conf.assignXpRole} onChange={assignXpRole => onChange({ assignXpRole })} /> Assegna ruolo soglia XP</label>
            <label className="flex items-center gap-2"><Toggle value={!!conf.fetchXpFromWolvesville} onChange={fetchXpFromWolvesville => onChange({ fetchXpFromWolvesville })} /> Recupera XP da Wolvesville</label>
            <label className="flex items-center gap-2"><Toggle value={!!conf.sendGeneralMessage} onChange={sendGeneralMessage => onChange({ sendGeneralMessage })} /> Messaggio generale</label>
            <label className="flex items-center gap-2"><Toggle value={!!conf.sendTempleMessage} onChange={sendTempleMessage => onChange({ sendTempleMessage })} /> Messaggio nel Tempio</label>
        </div><div className="grid md:grid-cols-2 gap-4 mt-4"><Field label="Messaggio generale"><textarea rows={3} value={conf.approvedGeneralMessage ?? ""} onChange={e => onChange({ approvedGeneralMessage: e.target.value })} className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2.5 text-sm" /></Field><Field label="Messaggio Tempio predefinito"><textarea rows={3} value={conf.approvedTempleMessage ?? ""} onChange={e => onChange({ approvedTempleMessage: e.target.value })} className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2.5 text-sm" /></Field></div></div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">{conf.temples.map(t => { const pop = conf.population?.find(p => p.key === t.key); return <div key={t.key} className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden"><div className="h-32 bg-neutral-950 flex items-center justify-between gap-4 p-4"><img src={t.assetUrl || `/assets/tempio-${t.key}.png`} className="h-full w-48 object-cover rounded-xl border border-neutral-800" /><div className="text-right"><h3 className="font-black">{templeNames[t.key] ?? t.key}</h3><div className="text-xs text-neutral-400 mt-1">{pop?.count ?? 0} membri effettivi</div><Toggle value={t.enabled !== false} onChange={enabled => updateTemple(t.key, { enabled })} /></div></div><div className="p-4 space-y-3"><Field label="Ruolo Tempio principale"><select value={t.roleId ?? ""} onChange={e => updateTemple(t.key, { roleId: e.target.value })} className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2.5 text-sm"><option value="">— seleziona ruolo —</option>{roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select></Field><Field label="Ruoli aggiuntivi del Tempio"><div className="max-h-32 overflow-y-auto space-y-1">{roles.filter(r => !r.managed && r.id !== t.roleId).map(r => <label key={r.id} className="flex items-center gap-2 text-xs p-1.5 rounded bg-neutral-950"><input type="checkbox" checked={(t.roleIds ?? []).includes(r.id)} onChange={() => { const set = new Set(t.roleIds ?? []); set.has(r.id) ? set.delete(r.id) : set.add(r.id); updateTemple(t.key, { roleIds: [...set] }); }} />{r.name}</label>)}</div></Field><Field label="Dei del Tempio (ruoli da menzionare)"><div className="max-h-24 overflow-y-auto space-y-1">{roles.filter(r => !r.managed).map(r => <label key={r.id} className="flex items-center gap-2 text-xs p-1.5 rounded bg-neutral-950"><input type="checkbox" checked={(t.godRoleIds ?? []).includes(r.id)} onChange={() => { const set = new Set(t.godRoleIds ?? []); set.has(r.id) ? set.delete(r.id) : set.add(r.id); updateTemple(t.key, { godRoleIds: [...set] }); }} />{r.name}</label>)}</div></Field><Field label="Descrizione nella scelta del Tempio"><textarea rows={5} value={t.selectionDescription ?? ""} onChange={e => updateTemple(t.key, { selectionDescription: e.target.value })} className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2.5 text-sm resize-none" /></Field><Field label="Canale Tempio"><select value={t.channelId ?? ""} onChange={e => updateTemple(t.key, { channelId: e.target.value })} className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2.5 text-sm"><option value="">— seleziona canale —</option>{channels.map(c => <option key={c.id} value={c.id}>#{c.name}</option>)}</select></Field><Field label="Ruoli co-capi del Tempio"><div className="max-h-24 overflow-y-auto space-y-1">{roles.filter(r => !r.managed).map(r => <label key={r.id} className="flex items-center gap-2 text-xs p-1.5 rounded bg-neutral-950"><input type="checkbox" checked={(t.coLeaderRoleIds ?? []).includes(r.id)} onChange={() => toggleRole(t.key, r.id)} />{r.name}</label>)}</div></Field><Field label="Messaggio specifico Tempio"><textarea rows={3} value={t.templeMessage ?? ""} onChange={e => updateTemple(t.key, { templeMessage: e.target.value })} className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2.5 text-sm resize-none" /></Field></div></div>; })}</div>
    </div>;
};

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

const TabAutoResponses: React.FC<{
    list: AutoResponse[];
    onSave: (response: AutoResponse) => void;
    onDelete: (id: string) => void;
}> = ({ list, onSave, onDelete }) => {
    const blank = (): AutoResponse => ({ id: uid(), guildId: "", trigger: "", response: "", isRegex: false, enabled: true, createdAt: new Date().toISOString() });
    const [draft, setDraft] = useState<AutoResponse | null>(null);
    return (
        <div className="space-y-5 animate-fade-in">
            <div className="flex items-center justify-between gap-4"><div><h1 className="text-2xl font-black tracking-tight">Autorisposte</h1><p className="text-sm text-neutral-400 mt-1">Risposte automatiche per parole o espressioni regolari.</p></div><button onClick={() => setDraft(blank())} className="px-4 py-2 bg-[#C9A227] text-[#1a1410] font-semibold rounded-xl text-sm inline-flex items-center gap-2"><Plus className="w-4 h-4" /> Nuova regola</button></div>
            {list.length === 0 ? <EmptyState icon={MessageSquare} title="Nessuna autorisposta" text="Crea una regola per rispondere automaticamente ai messaggi." /> : <div className="space-y-2.5">{list.map((item) => <div key={item.id} className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 flex items-center gap-3"><Toggle value={item.enabled} onChange={(enabled) => onSave({ ...item, enabled })} /><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><code className="text-sm text-emerald-300 truncate">{item.trigger}</code>{item.isRegex && <span className="text-[10px] uppercase text-[#E4C468]">Regex</span>}</div><div className="text-sm text-neutral-300 truncate mt-1">{item.response || "(risposta vuota)"}</div></div><button onClick={() => setDraft(item)} className="px-3 py-1.5 rounded-lg bg-neutral-800 text-xs text-neutral-200">Modifica</button><button onClick={() => onDelete(item.id)} className="p-2 text-rose-400" title="Elimina"><Trash2 className="w-4 h-4" /></button></div>)}</div>}
            {draft && <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"><div className="w-full max-w-xl bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-2xl"><h3 className="text-lg font-black mb-4">{list.some((item) => item.id === draft.id) ? "Modifica autorisposta" : "Nuova autorisposta"}</h3><Field label="Trigger"><input value={draft.trigger} onChange={(e) => setDraft({ ...draft, trigger: e.target.value })} placeholder="es. buongiorno" className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2.5 text-sm" /></Field><Field label="Risposta"><textarea rows={4} value={draft.response} onChange={(e) => setDraft({ ...draft, response: e.target.value })} placeholder="Scrivi la risposta..." className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2.5 text-sm resize-none" /></Field><div className="flex items-center justify-between gap-3 mt-3"><label className="inline-flex items-center gap-2 text-sm"><Toggle value={draft.isRegex} onChange={(isRegex) => setDraft({ ...draft, isRegex })} /> Regex</label><label className="inline-flex items-center gap-2 text-sm"><Toggle value={draft.enabled} onChange={(enabled) => setDraft({ ...draft, enabled })} /> Attiva</label></div><div className="mt-6 flex justify-end gap-2"><button onClick={() => setDraft(null)} className="px-4 py-2 rounded-xl bg-neutral-800 text-sm">Annulla</button><button disabled={!draft.trigger.trim() || !draft.response.trim()} onClick={() => { onSave(draft); setDraft(null); }} className="px-4 py-2 rounded-xl bg-[#C9A227] text-[#1a1410] text-sm font-semibold disabled:opacity-40">Salva</button></div></div></div>}
        </div>
    );
};

const TabAutorole: React.FC<{
    conf: GuildWelcomeLeave;
    roles: DiscordRole[];
    onChange: (patch: Partial<GuildWelcomeLeave>) => Promise<void>;
}> = ({ conf, roles, onChange }) => {
    const safeRoles = Array.isArray(roles) ? roles : [];
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
                    {safeRoles.filter((r) => r.name !== "@everyone").sort((a, b) => b.position - a.position).map((r) => {
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

const TabDaily: React.FC<{
    channels: DiscordChannel[];
    roles: DiscordRole[];
    conf: GuildDailyConfig | null;
    onSave: (patch: Partial<GuildDailyConfig>) => void;
    onRunTest: () => void;
    onCloseTest: () => void;
}> = ({ channels, roles, conf, onSave, onRunTest, onCloseTest }) => {
    if (!conf) return null;

    const safeRoles = Array.isArray(roles) ? roles : [];
    const safeChannels = Array.isArray(channels) ? channels : [];
    const hostSelectedRoles = new Set(conf.hostMentionRoleIds ?? conf.mentionRoleIds ?? []);
    const missionSelectedRoles = new Set(conf.missionsMentionRoleIds ?? conf.mentionRoleIds ?? []);
    const toggleHostRole = (roleId: string) => {
        const next = new Set(hostSelectedRoles);
        next.has(roleId) ? next.delete(roleId) : next.add(roleId);
        onSave({ hostMentionRoleIds: Array.from(next) });
    };
    const toggleMissionRole = (roleId: string) => {
        const next = new Set(missionSelectedRoles);
        next.has(roleId) ? next.delete(roleId) : next.add(roleId);
        onSave({ missionsMentionRoleIds: Array.from(next) });
    };

    return (
        <div className="space-y-5 animate-fade-in">
            <div className="flex items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black tracking-tight">Daily</h1>
                    <p className="text-sm text-neutral-400 mt-1">Avvia la daily con un messaggio host e raccogli le missioni tramite risposte nel canale dedicato.</p>
                </div>
                <label className="inline-flex items-center gap-2.5 px-3 py-2 rounded-xl bg-neutral-900 border border-neutral-800 cursor-pointer">
                    <Toggle value={!!conf.enabled} onChange={(v) => onSave({ enabled: v })} />
                    <span className="text-sm font-semibold">{conf.enabled ? "Attiva" : "Disattivata"}</span>
                </label>
            </div>

            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <h3 className="text-base font-bold text-neutral-100">Test rapido</h3>
                        <p className="text-xs text-neutral-400">Invia il messaggio host e il messaggio live delle missioni, poi chiudi il test quando vuoi.</p>
                    </div>
                </div>
                <div className="flex flex-wrap gap-3">
                    <button
                        type="button"
                        onClick={onRunTest}
                        className="px-4 py-2 rounded-xl bg-[#C9A227] hover:bg-[#8A6B1D] text-[#1a1410] font-semibold text-sm shadow-[0_8px_24px_-10px_#C9A227]"
                    >
                        ▶ Avvia test
                    </button>
                    <button
                        type="button"
                        onClick={onCloseTest}
                        className="px-4 py-2 rounded-xl bg-neutral-800 border border-neutral-700 hover:bg-neutral-700 text-neutral-100 font-semibold text-sm"
                    >
                        🧹 Chiudi messaggio live
                    </button>
                </div>
            </div>

            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5">
                <h3 className="text-sm font-bold text-neutral-100 mb-3">Ruoli da taggare nel messaggio host</h3>
                <p className="text-xs text-neutral-400 mb-3">Puoi usare <code className="text-emerald-300">{"{ROLE}"}</code> oppure <code className="text-emerald-300">{"{ROLES}"}</code> nel messaggio host per inserire automaticamente queste menzioni.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-[220px] overflow-auto pr-2">
                    {safeRoles.filter((r) => r.name !== "@everyone").sort((a, b) => b.position - a.position).map((r) => {
                        const isSelected = hostSelectedRoles.has(r.id);
                        return (
                            <button
                                key={`host-${r.id}`}
                                type="button"
                                onClick={() => toggleHostRole(r.id)}
                                className={classNames(
                                    "text-left px-3 py-2.5 rounded-xl border inline-flex items-center gap-3 transition-colors",
                                    isSelected ? "bg-[#C9A227]/10 border-[#C9A227]/40" : "bg-neutral-950 border-neutral-800 hover:bg-neutral-800"
                                )}
                            >
                                <span className="w-3.5 h-3.5 rounded-full shrink-0" style={{ background: `#${r.color.toString(16).padStart(6, "0")}`, opacity: r.color === 0 ? 0.5 : 1 }} />
                                <span className="truncate text-sm font-medium">{r.name}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5">
                <h3 className="text-sm font-bold text-neutral-100 mb-3">Ruoli da taggare nel messaggio delle missioni</h3>
                <p className="text-xs text-neutral-400 mb-3">Questi ruoli vengono aggiunti anche al messaggio live delle missioni, così la notifica arriva anche lì.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-[220px] overflow-auto pr-2">
                    {safeRoles.filter((r) => r.name !== "@everyone").sort((a, b) => b.position - a.position).map((r) => {
                        const isSelected = missionSelectedRoles.has(r.id);
                        return (
                            <button
                                key={`mission-${r.id}`}
                                type="button"
                                onClick={() => toggleMissionRole(r.id)}
                                className={classNames(
                                    "text-left px-3 py-2.5 rounded-xl border inline-flex items-center gap-3 transition-colors",
                                    isSelected ? "bg-emerald-500/10 border-emerald-500/40" : "bg-neutral-950 border-neutral-800 hover:bg-neutral-800"
                                )}
                            >
                                <span className="w-3.5 h-3.5 rounded-full shrink-0" style={{ background: `#${r.color.toString(16).padStart(6, "0")}`, opacity: r.color === 0 ? 0.5 : 1 }} />
                                <span className="truncate text-sm font-medium">{r.name}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 space-y-4">
                    <Field label="Canale host">
                        <select value={conf.hostChannelId ?? ""} onChange={(e) => onSave({ hostChannelId: e.target.value })} className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2.5 text-sm">
                            <option value="">— nessun canale —</option>
                            {safeChannels.map((channel) => (
                                <option key={channel.id} value={channel.id}>#{channel.name}</option>
                            ))}
                        </select>
                    </Field>

                    <Field label="Ora di partenza (Italia)">
                        <input type="time" value={conf.dailyTime ?? "20:00"} onChange={(e) => onSave({ dailyTime: e.target.value })} className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2.5 text-sm" />
                    </Field>

                    <Field label="Messaggio host">
                        <textarea rows={5} value={conf.hostMessage ?? ""} onChange={(e) => onSave({ hostMessage: e.target.value })} className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2.5 text-sm resize-none" placeholder="Scrivi il messaggio che va nel canale host..." />
                    </Field>
                </div>

                <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 space-y-4">
                    <Field label="Canale missioni">
                        <select value={conf.missionsChannelId ?? ""} onChange={(e) => onSave({ missionsChannelId: e.target.value })} className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2.5 text-sm">
                            <option value="">— nessun canale —</option>
                            {safeChannels.map((channel) => (
                                <option key={channel.id} value={channel.id}>#{channel.name}</option>
                            ))}
                        </select>
                    </Field>

                    <Field label="Prompt delle missioni">
                        <textarea rows={5} value={conf.missionsPrompt ?? ""} onChange={(e) => onSave({ missionsPrompt: e.target.value })} className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2.5 text-sm resize-none" placeholder="Es.: Rispondi a questo messaggio con la tua missione e il tuo nome..." />
                    </Field>
                </div>
            </div>

            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5">
                <h3 className="text-sm font-bold text-neutral-100 mb-3">Anteprima lista di oggi</h3>
                <div className="space-y-2 min-h-[120px]">
                    {(conf.participants ?? []).length === 0 ? (
                        <div className="text-sm text-neutral-400 italic">Nessuna missione inviata ancora.</div>
                    ) : (
                        (conf.participants ?? []).map((entry) => (
                            <div key={`${entry.userId}-${entry.addedAt}`} className="flex items-start gap-2 bg-neutral-950 border border-neutral-800 rounded-xl p-3">
                                <span className="text-emerald-300 font-semibold">@{entry.username}</span>
                                <span className="text-neutral-200">: {entry.text}</span>
                            </div>
                        ))
                    )}
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
        daysOfWeek: [],
        scheduledTime: new Date(Date.now() + 60_000).toISOString(),
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
                                value={toLocalDateTimeInput(m.scheduledTime)}
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
                    {m.isRecurring && (
                        <Field label="Giorni della settimana (opzionale)">
                            <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
                                {["Dom", "Lun", "Mar", "Mer", "Gio", "Ven", "Sab"].map((day, index) => {
                                    const selected = (m.daysOfWeek ?? []).includes(index);
                                    return <button key={day} type="button" onClick={() => setM({ ...m, daysOfWeek: selected ? (m.daysOfWeek ?? []).filter((value) => value !== index) : [...(m.daysOfWeek ?? []), index].sort() })} className={classNames("px-2 py-2 rounded-lg border text-xs font-semibold", selected ? "bg-[#C9A227] text-[#1a1410] border-[#C9A227]" : "bg-neutral-950 border-neutral-800 text-neutral-400 hover:bg-neutral-800")}>{day}</button>;
                                })}
                            </div>
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

            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5">
                <div className="flex items-center justify-between gap-4">
                    <div>
                        <h3 className="text-sm font-bold text-neutral-100">Entrata automatica in vocale</h3>
                        <p className="text-xs text-neutral-400 mt-1 max-w-xl">
                            Quando è attiva, Hermes entra da solo nel canale vocale e legge i messaggi scritti nella
                            chat testuale collegata al vocale in cui si trova l'utente — senza bisogno di prefissi.
                            Si applica solo se sotto <strong>non</strong> è impostato un "Canale testuale da leggere" fisso
                            (i due meccanismi sono alternativi, per non leggere due chat diverse insieme).
                            Se la disattivi, per farlo entrare usa il comando <code className="text-emerald-300">/entra</code>
                            {" "}(oppure i prefissi qui sotto). Puoi cambiare questo stato anche da Discord con{" "}
                            <code className="text-emerald-300">/entrata-automatica</code>, e farlo uscire con{" "}
                            <code className="text-emerald-300">/esci</code>.
                        </p>
                    </div>
                    <label className="inline-flex items-center gap-2.5 px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 cursor-pointer shrink-0">
                        <Toggle value={conf.ttsAutoJoinEnabled ?? true} onChange={(v) => onChange({ ttsAutoJoinEnabled: v })} />
                        <span className="text-sm font-semibold">{(conf.ttsAutoJoinEnabled ?? true) ? "Attiva" : "Disattiva"}</span>
                    </label>
                </div>
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
                            <option value="">— Nessuno (usa entrata automatica / prefissi) —</option>
                            {textChannels.map((c) => (
                                <option key={c.id} value={c.id}>#{c.name}</option>
                            ))}
                        </select>
                        {conf.ttsSourceChannelId && (conf.ttsAutoJoinEnabled ?? true) && (
                            <p className="text-xs text-amber-400/80 mt-1.5">
                                ⚠️ Con un canale fisso impostato, l'entrata automatica nella chat del vocale è disattivata di fatto per evitare letture da due fonti diverse.
                            </p>
                        )}
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
                    <Field label="Canali vocali dove non entra">
                        <div className="max-h-52 overflow-auto space-y-1.5 rounded-lg border border-neutral-800 bg-neutral-950 p-2">
                            {voiceChannels.length === 0 ? (
                                <p className="text-xs text-neutral-500 px-1 py-2">Nessun canale vocale disponibile.</p>
                            ) : voiceChannels.map((channel) => {
                                const blocked = (conf.ttsBlockedVoiceChannelIds ?? []).includes(channel.id);
                                return (
                                    <label key={channel.id} className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-neutral-800 cursor-pointer text-sm">
                                        <input
                                            type="checkbox"
                                            checked={blocked}
                                            onChange={() => {
                                                const current = new Set(conf.ttsBlockedVoiceChannelIds ?? []);
                                                if (blocked) current.delete(channel.id);
                                                else current.add(channel.id);
                                                onChange({ ttsBlockedVoiceChannelIds: Array.from(current) });
                                            }}
                                            className="accent-[#C9A227]"
                                        />
                                        <span className="text-neutral-400">🔊</span>
                                        <span className="truncate">{channel.name}</span>
                                    </label>
                                );
                            })}
                        </div>
                        <p className="text-[11px] text-neutral-500 mt-1.5">
                            Seleziona i canali in cui Hermes non deve entrare in automatico o via TTS.
                        </p>
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
                    <Field label="Canali da ignorare nei log">
                        <div className="max-h-52 overflow-auto space-y-1.5 rounded-lg border border-neutral-800 bg-neutral-950 p-2">
                            {channels.length === 0 ? (
                                <p className="text-xs text-neutral-500 px-1 py-2">Nessun canale testuale disponibile.</p>
                            ) : channels.map((channel) => {
                                const ignored = (conf.ignoredChannelIds ?? []).includes(channel.id);
                                return (
                                    <label key={channel.id} className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-neutral-800 cursor-pointer text-sm">
                                        <input
                                            type="checkbox"
                                            checked={ignored}
                                            onChange={() => {
                                                const current = new Set(conf.ignoredChannelIds ?? []);
                                                if (ignored) current.delete(channel.id);
                                                else current.add(channel.id);
                                                onChange({ ignoredChannelIds: Array.from(current) });
                                            }}
                                            className="accent-[#C9A227]"
                                        />
                                        <span className="text-neutral-400">#</span>
                                        <span className="truncate">{channel.name}</span>
                                    </label>
                                );
                            })}
                        </div>
                    </Field>
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
                                        {e.deletedAttachments && e.deletedAttachments.length > 0 && (
                                            <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
                                                {e.deletedAttachments.map((attachment) => (
                                                    <a key={attachment.url} href={attachment.url} target="_blank" rel="noreferrer">
                                                        <img src={attachment.url} alt={attachment.name} className="w-full aspect-video object-cover rounded-lg border border-rose-500/20" />
                                                    </a>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="ml-12 grid grid-cols-1 md:grid-cols-2 gap-2">
                                        <div className="p-3 rounded-lg bg-neutral-800 border border-neutral-700/50 text-sm whitespace-pre-wrap">
                                            <div className="text-[10px] uppercase font-bold text-neutral-500 mb-1">Prima</div>
                                            {e.oldContent || "(vuoto)"}
                                        </div>
                                        <div className="p-3 rounded-lg bg-amber-900/20 border border-amber-500/20 text-sm whitespace-pre-wrap">
                                            <div className="text-[10px] uppercase font-bold text-amber-400 mb-1">Dopo</div>
                                            <strong>{e.newContent || "(vuoto)"}</strong>
                                            {e.newAttachments && e.newAttachments.length > 0 && (
                                                <div className="mt-3 grid grid-cols-2 gap-2">
                                                    {e.newAttachments.map((attachment) => (
                                                        <a key={attachment.url} href={attachment.url} target="_blank" rel="noreferrer">
                                                            <img src={attachment.url} alt={attachment.name} className="w-full aspect-video object-cover rounded-lg border border-amber-500/20" />
                                                        </a>
                                                    ))}
                                                </div>
                                            )}
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

const DEFAULT_JOIN_REQUEST_TEMPLATE = "{ROLES} c'è una nuova recluta di nome **{USERNAME}**! 🐺";

const TabJoinRequests: React.FC<{
    conf: GuildJoinRequests;
    channels: DiscordChannel[];
    roles: DiscordRole[];
    history: JoinRequestEntry[];
    loading: boolean;
    onChange: (patch: Partial<GuildJoinRequests>) => Promise<void>;
    onRefresh: () => Promise<void>;
}> = ({ conf, channels, roles, history, loading, onChange, onRefresh }) => {
    const safeRoles = Array.isArray(roles) ? roles : [];
    const selectedRoles = new Set(conf.mentionRoleIds ?? []);
    const toggleRole = (id: string) => {
        const next = new Set(selectedRoles);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        onChange({ mentionRoleIds: Array.from(next) });
    };

    const template = conf.messageTemplate ?? DEFAULT_JOIN_REQUEST_TEMPLATE;
    const previewRoles = Array.from(selectedRoles)
        .map((id) => safeRoles.find((r) => r.id === id)?.name)
        .filter(Boolean)
        .map((n) => `@${n}`)
        .join(" ") || "@Co Capo";
    const preview = template.replace(/\{ROLES\}/g, previewRoles).replace(/\{USERNAME\}/g, "MarioRossi92");

    return (
        <div className="space-y-5 animate-fade-in">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-black tracking-tight">Richieste Clan</h1>
                    <p className="text-sm text-neutral-400 mt-1">
                        Quando qualcuno manda una richiesta d'ingresso al clan su Wolvesville, il bot avvisa in un
                        canale a scelta menzionando i ruoli scelti, con la scheda tecnica del richiedente.
                    </p>
                </div>
                <label className="inline-flex items-center gap-2.5 px-3 py-2 rounded-xl bg-neutral-900 border border-neutral-800 cursor-pointer">
                    <Toggle value={!!conf.enabled} onChange={(v) => onChange({ enabled: v })} />
                    <span className="text-sm font-semibold">{conf.enabled ? "Attivo" : "Disattivato"}</span>
                </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 space-y-4">
                    <h3 className="text-sm font-bold text-neutral-100 flex items-center gap-2">
                        <Inbox className="w-4 h-4 text-indigo-400" /> Configurazione
                    </h3>
                    <Field label="Canale Discord dove inviare la notifica">
                        <select
                            value={conf.channelId ?? ""}
                            onChange={(e) => onChange({ channelId: e.target.value })}
                            className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2.5 text-sm"
                        >
                            <option value="">— Nessun canale selezionato —</option>
                            {channels.map((c) => (
                                <option key={c.id} value={c.id}>#{c.name}</option>
                            ))}
                        </select>
                    </Field>
                    <Field label="Messaggio (variabili: {ROLES}, {USERNAME})">
                        <textarea
                            value={conf.messageTemplate ?? ""}
                            onChange={(e) => onChange({ messageTemplate: e.target.value })}
                            placeholder={DEFAULT_JOIN_REQUEST_TEMPLATE}
                            rows={3}
                            className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2.5 text-sm resize-none"
                        />
                    </Field>
                    <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800">
                        <div className="text-[10px] uppercase font-bold text-neutral-500 mb-1.5">Anteprima</div>
                        <div className="text-sm text-neutral-200 whitespace-pre-wrap">{preview}</div>
                    </div>
                </div>

                <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5">
                    <h3 className="text-sm font-bold text-neutral-100 mb-3 flex items-center gap-2">
                        <Tag className="w-4 h-4 text-indigo-400" /> Ruoli da menzionare (es. Co-Capo)
                    </h3>
                    <div className="grid grid-cols-1 gap-2 max-h-[280px] overflow-auto pr-2">
                        {safeRoles.filter((r) => r.name !== "@everyone").sort((a, b) => b.position - a.position).map((r) => {
                            const isSel = selectedRoles.has(r.id);
                            return (
                                <button
                                    key={r.id}
                                    onClick={() => toggleRole(r.id)}
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
                                        "w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0",
                                        isSel ? "bg-[#C9A227] border-[#C9A227] text-[#1a1410]" : "border-neutral-600"
                                    )}>
                                        {isSel && "✓"}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                    <div className="mt-3 text-xs text-neutral-500">
                        {selectedRoles.size} ruolo/i selezionato/i.
                    </div>
                </div>
            </div>

            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden">
                <div className="px-5 py-3 border-b border-neutral-800 flex items-center justify-between">
                    <h3 className="text-sm font-bold flex items-center gap-2">
                        <Inbox className="w-4 h-4 text-indigo-400" />
                        Ultime richieste notificate
                    </h3>
                    <button
                        onClick={onRefresh}
                        className="px-3 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-xs font-medium text-neutral-200 border border-neutral-700 inline-flex items-center gap-1.5"
                    >
                        <RefreshCw className={classNames("w-3.5 h-3.5", loading && "animate-spin")} /> Aggiorna
                    </button>
                </div>
                {history.length === 0 ? (
                    <EmptyState
                        compact
                        icon={Inbox}
                        title="Nessuna richiesta ancora rilevata"
                        text="Appena qualcuno manderà una richiesta d'ingresso al clan su Wolvesville, comparirà qui e (se attivo) verrà notificata nel canale scelto."
                    />
                ) : (
                    <div className="divide-y divide-neutral-800 max-h-[520px] overflow-y-auto">
                        {history.map((h) => (
                            <div key={h.id} className="p-4 flex items-center gap-3 flex-wrap">
                                <UserPlus className="w-4 h-4 text-emerald-400 shrink-0" />
                                <span className="font-semibold text-sm truncate">{h.playerUsername}</span>
                                {h.notificationChannelId ? (
                                    <span className="text-[11px] text-emerald-400/80">notificato</span>
                                ) : (
                                    <span className="text-[11px] text-neutral-500">nessun canale configurato al momento</span>
                                )}
                                <span className="flex-1" />
                                <span className="text-[11px] text-neutral-500 shrink-0">
                                    {new Date(h.eventTime).toLocaleString("it-IT")}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

const TabProfileCard: React.FC<{
    conf: GuildProfileCardConfig;
    onChange: (patch: Partial<GuildProfileCardConfig>) => Promise<void>;
}> = ({ conf, onChange }) => {
    const card = conf.card ?? DEFAULT_PROFILE_CARD;
    
    return (
        <div className="space-y-5 animate-fade-in">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-black tracking-tight">Profile Card</h1>
                    <p className="text-sm text-neutral-400 mt-1">
                        Personalizza l'aspetto della scheda profilo che appare quando cerchi un giocatore Wolvesville.
                    </p>
                </div>
            </div>

            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5">
                <h3 className="text-sm font-bold text-neutral-100 mb-4 flex items-center gap-2">
                    <SlidersHorizontal className="w-4 h-4 text-indigo-400" /> Editor Canvas
                </h3>
                <CanvasEditor
                    card={card}
                    onChange={(newCard) => onChange({ card: newCard })}
                    type="profile"
                />
            </div>

            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5">
                <h3 className="text-sm font-bold text-neutral-100 mb-3">Variabili disponibili</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    {[
                        ["{username}", "Username del giocatore (es. Noctura)"],
                        ["{level}", "Livello (es. 35)"],
                        ["{clan}", "Nome del clan (es. Nessun clan)"],
                        ["{description}", "Descrizione / Bio del giocatore"],
                        ["{games}", "Numero di partite giocate"],
                        ["{wins}", "Numero di vittorie totali"],
                        ["{village_wins}", "Vittorie come villaggio"],
                        ["{wolf_wins}", "Vittorie come lupo"],
                        ["{winrate}", "Percentuale di vittoria"],
                        ["{roses_received}", "Rose ricevute"],
                        ["{roses_sent}", "Rose inviate"],
                    ].map(([variable, description]) => (
                        <div key={variable} className="flex gap-2">
                            <code className="font-mono text-[11px] bg-neutral-950 px-2 py-1 rounded border border-neutral-800 text-[#E4C468] whitespace-nowrap">
                                {variable}
                            </code>
                            <span className="text-neutral-400">{description}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

const MONTH_NAMES_IT = [
    "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
    "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre",
];
const DAYS_IN_MONTH_IT = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function daysUntilNextBirthday(day: number, month: number): number {
    const now = new Date();
    const candidate = new Date(now.getFullYear(), month - 1, day, 0, 0, 0);
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (candidate.getTime() < today.getTime()) candidate.setFullYear(now.getFullYear() + 1);
    return Math.round((candidate.getTime() - today.getTime()) / 86_400_000);
}

const TabBirthday: React.FC<{
    conf: GuildBirthdayConfig;
    channels: DiscordChannel[];
    roles: DiscordRole[];
    members: DiscordMember[];
    onChange: (patch: Partial<GuildBirthdayConfig>) => Promise<void>;
    onAddEntry: (entry: { userId: string; username: string; day: number; month: number }) => Promise<void>;
    onRemoveEntry: (userId: string) => Promise<void>;
}> = ({ conf, channels, roles, members, onChange, onAddEntry, onRemoveEntry }) => {
    const [pickUserId, setPickUserId] = useState("");
    const [pickDay, setPickDay] = useState<number>(1);
    const [pickMonth, setPickMonth] = useState<number>(1);
    const [search, setSearch] = useState("");

    const safeRoles = Array.isArray(roles) ? roles : [];
    const selectedRoles = new Set(conf.mentionRoleIds ?? []);
    const toggleRole = (id: string) => {
        const next = new Set(selectedRoles);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        onChange({ mentionRoleIds: Array.from(next) });
    };

    const card = conf.card ?? DEFAULT_BIRTHDAY_CARD;
    const template = conf.messageTemplate ?? DEFAULT_BIRTHDAY_MESSAGE_TEMPLATE;
    const preview = template.replaceAll("{USERNAME}", "MarioRossi92").replaceAll("{SERVER_NAME}", "Celestial Elysium");

    const sortedBirthdays = [...(conf.birthdays || [])].sort(
        (a, b) => daysUntilNextBirthday(a.day, a.month) - daysUntilNextBirthday(b.day, b.month)
    );

    const registeredIds = new Set((conf.birthdays || []).map((b) => b.userId));
    const filteredMembers = members.filter(
        (m) =>
            !search ||
            m.displayName.toLowerCase().includes(search.toLowerCase()) ||
            m.username.toLowerCase().includes(search.toLowerCase())
    );

    const maxDayForMonth = DAYS_IN_MONTH_IT[pickMonth - 1];

    const handleAdd = async () => {
        if (!pickUserId) return;
        const member = members.find((m) => m.id === pickUserId);
        if (!member) return;
        if (pickDay > maxDayForMonth) return;
        await onAddEntry({ userId: member.id, username: member.displayName, day: pickDay, month: pickMonth });
        setPickUserId("");
        setSearch("");
    };

    return (
        <div className="space-y-5 animate-fade-in">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-black tracking-tight">Compleanni</h1>
                    <p className="text-sm text-neutral-400 mt-1">
                        Il bot mantiene un'unica lista sempre aggiornata nel canale scelto, e ogni giorno a
                        mezzanotte (ora italiana) augura buon compleanno con un banner personalizzato.
                    </p>
                </div>
                <label className="inline-flex items-center gap-2.5 px-3 py-2 rounded-xl bg-neutral-900 border border-neutral-800 cursor-pointer">
                    <Toggle value={!!conf.enabled} onChange={(v) => onChange({ enabled: v })} />
                    <span className="text-sm font-semibold">{conf.enabled ? "Attivo" : "Disattivato"}</span>
                </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 space-y-4">
                    <h3 className="text-sm font-bold text-neutral-100 flex items-center gap-2">
                        <Cake className="w-4 h-4 text-indigo-400" /> Configurazione
                    </h3>
                    <Field label="Canale (lista compleanni + auguri di mezzanotte)">
                        <select
                            value={conf.channelId ?? ""}
                            onChange={(e) => onChange({ channelId: e.target.value })}
                            className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2.5 text-sm"
                        >
                            <option value="">— Nessun canale selezionato —</option>
                            {channels.map((c) => (
                                <option key={c.id} value={c.id}>#{c.name}</option>
                            ))}
                        </select>
                    </Field>
                    <Field label="Dicitura auguri di mezzanotte (variabili: {USERNAME}, {SERVER_NAME}, {DATE})">
                        <textarea
                            value={conf.messageTemplate ?? ""}
                            onChange={(e) => onChange({ messageTemplate: e.target.value })}
                            placeholder={DEFAULT_BIRTHDAY_MESSAGE_TEMPLATE}
                            rows={3}
                            className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2.5 text-sm resize-none"
                        />
                    </Field>
                    <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800">
                        <div className="text-[10px] uppercase font-bold text-neutral-500 mb-1.5">Anteprima messaggio</div>
                        <div className="text-sm text-neutral-200 whitespace-pre-wrap">{preview}</div>
                    </div>
                </div>

                <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 space-y-3">
                    <h3 className="text-sm font-bold text-neutral-100 flex items-center gap-2">
                        <UserPlus className="w-4 h-4 text-indigo-400" /> Aggiungi compleanno
                    </h3>
                    <p className="text-xs text-neutral-500">
                        Utile per importare in autonomia i compleanni che già conosci. In futuro i membri
                        potranno aggiungersi da soli con <code className="text-[#E4C468]">/add compleanno</code>.
                    </p>
                    <input
                        value={search}
                        onChange={(e) => { setSearch(e.target.value); setPickUserId(""); }}
                        placeholder="Cerca membro per nome..."
                        className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2.5 text-sm"
                    />
                    {search && (
                        <div className="max-h-40 overflow-auto space-y-1 rounded-lg border border-neutral-800 bg-neutral-950 p-1.5">
                            {filteredMembers.slice(0, 30).map((m) => (
                                <button
                                    key={m.id}
                                    onClick={() => { setPickUserId(m.id); setSearch(m.displayName); }}
                                    className={classNames(
                                        "w-full text-left px-2.5 py-1.5 rounded-md text-sm flex items-center gap-2",
                                        pickUserId === m.id ? "bg-[#5DADE2]/20 text-[#5DADE2]" : "hover:bg-neutral-800 text-neutral-200"
                                    )}
                                >
                                    <img src={m.avatarUrl} alt="" className="w-5 h-5 rounded-full" />
                                    <span className="truncate">{m.displayName}</span>
                                    {registeredIds.has(m.id) && (
                                        <span className="ml-auto text-[10px] text-emerald-400">già registrato</span>
                                    )}
                                </button>
                            ))}
                            {filteredMembers.length === 0 && (
                                <div className="text-xs text-neutral-500 px-2 py-1.5">Nessun membro trovato</div>
                            )}
                        </div>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                        <Field label="Giorno">
                            <input
                                type="number"
                                min={1}
                                max={maxDayForMonth}
                                value={pickDay}
                                onChange={(e) => setPickDay(Math.max(1, Math.min(maxDayForMonth, parseInt(e.target.value) || 1)))}
                                className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2.5 text-sm"
                            />
                        </Field>
                        <Field label="Mese">
                            <select
                                value={pickMonth}
                                onChange={(e) => setPickMonth(parseInt(e.target.value))}
                                className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2.5 text-sm"
                            >
                                {MONTH_NAMES_IT.map((name, idx) => (
                                    <option key={name} value={idx + 1}>{name}</option>
                                ))}
                            </select>
                        </Field>
                    </div>
                    <button
                        onClick={handleAdd}
                        disabled={!pickUserId}
                        className={classNames(
                            "w-full py-2.5 rounded-lg text-sm font-semibold transition-colors",
                            pickUserId ? "bg-[#5DADE2] text-[#0a1a26] hover:bg-[#79bfe8]" : "bg-neutral-800 text-neutral-500 cursor-not-allowed"
                        )}
                    >
                        + Aggiungi compleanno
                    </button>
                </div>
            </div>

            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5">
                <h3 className="text-sm font-bold text-neutral-100 mb-3 flex items-center gap-2">
                    <Tag className="w-4 h-4 text-indigo-400" /> Ruoli da menzionare negli auguri
                </h3>
                <p className="text-xs text-neutral-500 mb-3">
                    Questi ruoli vengono taggati insieme al messaggio di auguri a mezzanotte, così la
                    notizia del compleanno arriva a tutti (es. ruolo "Membri").
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[280px] overflow-auto pr-2">
                    {safeRoles.filter((r) => r.name !== "@everyone").sort((a, b) => b.position - a.position).map((r) => {
                        const isSel = selectedRoles.has(r.id);
                        return (
                            <button
                                key={r.id}
                                onClick={() => toggleRole(r.id)}
                                className={classNames(
                                    "text-left px-3 py-2.5 rounded-xl border inline-flex items-center gap-3 transition-colors",
                                    isSel ? "bg-[#5DADE2]/10 border-[#5DADE2]/40" : "bg-neutral-950 border-neutral-800 hover:bg-neutral-800"
                                )}
                            >
                                <span
                                    className="w-3.5 h-3.5 rounded-full shrink-0"
                                    style={{ background: `#${r.color.toString(16).padStart(6, "0")}`, opacity: r.color === 0 ? 0.5 : 1 }}
                                />
                                <span className="truncate text-sm font-medium">{r.name}</span>
                                <span className="flex-1" />
                                <span className={classNames(
                                    "w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0",
                                    isSel ? "bg-[#5DADE2] border-[#5DADE2] text-[#0a1a26]" : "border-neutral-600"
                                )}>
                                    {isSel && "✓"}
                                </span>
                            </button>
                        );
                    })}
                </div>
                <div className="mt-3 text-xs text-neutral-500">
                    {selectedRoles.size} ruolo/i selezionato/i.
                </div>
            </div>

            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5">
                <h3 className="text-sm font-bold text-neutral-100 mb-3 flex items-center gap-2">
                    <List className="w-4 h-4 text-indigo-400" /> Compleanni registrati ({sortedBirthdays.length})
                </h3>
                {sortedBirthdays.length === 0 ? (
                    <div className="text-sm text-neutral-500 py-4 text-center">Nessun compleanno registrato ancora.</div>
                ) : (
                    <div className="space-y-1.5 max-h-[360px] overflow-auto pr-2">
                        {sortedBirthdays.map((b) => {
                            const remaining = daysUntilNextBirthday(b.day, b.month);
                            const when = remaining === 0 ? "🎉 Oggi!" : remaining === 1 ? "domani" : `tra ${remaining} giorni`;
                            return (
                                <div key={b.userId} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-neutral-950 border border-neutral-800">
                                    <Cake className="w-4 h-4 text-[#5DADE2] shrink-0" />
                                    <span className="text-sm font-medium truncate">{b.username}</span>
                                    <span className="text-xs text-neutral-500 shrink-0">
                                        {b.day} {MONTH_NAMES_IT[b.month - 1]} — {when}
                                    </span>
                                    <span className="flex-1" />
                                    <button
                                        onClick={() => onRemoveEntry(b.userId)}
                                        className="p-1.5 rounded-md hover:bg-red-500/10 text-neutral-500 hover:text-red-400 transition-colors shrink-0"
                                        title="Rimuovi"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5">
                <h3 className="text-sm font-bold text-neutral-100 mb-4 flex items-center gap-2">
                    <SlidersHorizontal className="w-4 h-4 text-indigo-400" /> Editor Canvas — Banner di mezzanotte
                </h3>
                <CanvasEditor
                    card={card}
                    onChange={(newCard) => onChange({ card: newCard })}
                    type="birthday"
                />
            </div>

            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5">
                <h3 className="text-sm font-bold text-neutral-100 mb-3">Variabili disponibili nel canvas</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    {[
                        ["{USERNAME}", "Nickname del festeggiato"],
                        ["{SERVER_NAME}", "Nome del server"],
                        ["{DATE}", "Data completa (es. 22 Agosto)"],
                        ["{DAY}", "Solo il giorno (es. 22)"],
                        ["{MONTH}", "Solo il mese (es. Agosto)"],
                    ].map(([variable, description]) => (
                        <div key={variable} className="flex gap-2">
                            <code className="font-mono text-[11px] bg-neutral-950 px-2 py-1 rounded border border-neutral-800 text-[#5DADE2] whitespace-nowrap">
                                {variable}
                            </code>
                            <span className="text-neutral-400">{description}</span>
                        </div>
                    ))}
                </div>
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
    // Le entry salvate prima del tracciamento gemme non hanno `currency`: le trattiamo come oro.
    const currencyOf = (d: { currency?: "gold" | "gems" }) => d.currency ?? "gold";
    const totalGoldDonated = donations.reduce((s, d) => (currencyOf(d) === "gold" ? s + (d.amount || 0) : s), 0);
    const totalGemsDonated = donations.reduce((s, d) => (currencyOf(d) === "gems" ? s + (d.amount || 0) : s), 0);

    const donorMap = new Map<
        string,
        { username: string; totalGold: number; totalGems: number; count: number; lastTime: string }
    >();
    for (const d of donations) {
        const key = d.playerId || d.playerUsername;
        const cur =
            donorMap.get(key) || { username: d.playerUsername, totalGold: 0, totalGems: 0, count: 0, lastTime: d.eventTime };
        if (currencyOf(d) === "gems") {
            cur.totalGems += d.amount || 0;
        } else {
            cur.totalGold += d.amount || 0;
        }
        cur.count += 1;
        if (new Date(d.eventTime).getTime() > new Date(cur.lastTime).getTime()) cur.lastTime = d.eventTime;
        donorMap.set(key, cur);
    }
    const leaderboard = Array.from(donorMap.values()).sort((a, b) => b.totalGold - a.totalGold);

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

            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <Stat label="Membri" value={String(members.length)} color="indigo" />
                <Stat label="Co-leader" value={String(coLeaders)} color="amber" />
                <Stat label="Donazioni" value={String(donations.length)} color="emerald" />
                <Stat label="Totale oro donato" value={totalGoldDonated.toLocaleString("it-IT")} color="yellow" />
                <Stat label="Totale gemme donate" value={totalGemsDonated.toLocaleString("it-IT")} color="cyan" />
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
                                    <th className="px-4 py-2.5 font-semibold">Gemme</th>
                                    <th className="px-4 py-2.5 font-semibold">Volte</th>
                                    <th className="px-4 py-2.5 font-semibold">Ultima</th>
                                </tr>
                            </thead>
                            <tbody>
                                {leaderboard.map((r, i) => (
                                    <tr key={r.username + i} className="border-b border-neutral-800/60 last:border-0 hover:bg-neutral-900/60">
                                        <td className="px-4 py-2.5 font-black text-neutral-500">{i + 1}</td>
                                        <td className="px-4 py-2.5 font-semibold">{r.username}</td>
                                        <td className="px-4 py-2.5 text-amber-300 font-bold">{r.totalGold.toLocaleString("it-IT")}</td>
                                        <td className="px-4 py-2.5 text-cyan-300 font-bold">{r.totalGems.toLocaleString("it-IT")}</td>
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
                        {donations.map((d) => {
                            const isGems = d.currency === "gems";
                            return (
                                <div key={d.id} className="p-4 flex items-center gap-3 flex-wrap">
                                    <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shrink-0">
                                        Donazione
                                    </span>
                                    <span className="font-semibold text-sm truncate">{d.playerUsername}</span>
                                    <span className={classNames("font-bold text-sm", isGems ? "text-cyan-300" : "text-amber-300")}>
                                        {d.amount.toLocaleString("it-IT")} {isGems ? "gemme" : "monete"}
                                    </span>
                                    {d.comment && (
                                        <span className="text-sm text-neutral-400 italic truncate max-w-xs">
                                            "{d.comment}"
                                        </span>
                                    )}
                                    <span className="flex-1" />
                                    <span className="text-[11px] text-neutral-500 shrink-0">
                                        {new Date(d.eventTime).toLocaleString("it-IT")}
                                    </span>
                                </div>
                            );
                        })}
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
