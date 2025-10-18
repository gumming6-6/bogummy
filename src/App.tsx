import React, { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Upload, Download, List, Grid as GridIcon, Search, Image as ImageIcon, X } from "lucide-react";

// (생략된 코드 동일)

// ===================== 렌더 =====================
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* 상단 대제목 */}
      <div className="bg-white text-center py-3 border-b border-slate-200">
        <div className="mx-auto max-w-6xl px-4">
          <div className="text-2xl md:text-3xl font-extrabold tracking-wide">BOGUMMY PHOTOCARD LIST❣️</div>
        </div>
      </div>

      {/* 상단 툴바 */}
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b border-slate-200">
        <div className="mx-auto max-w-6xl px-4 py-3 flex flex-wrap items-center gap-3">
          {!shareMode && (<h1 className="text-xl font-bold">포카리스트 체크{isEdit ? " · 편집 모드" : (isAdmin ? " · 관리자 모드" : "")}</h1>)}

          <div className="flex items-center gap-2 ml-auto">
            <div className="flex items-center gap-2">
              <button onClick={() => setView("gallery")} className={`p-2 rounded-lg ${view === "gallery" ? "bg-slate-200" : "hover:bg-slate-100"}`} title="갤러리 보기"><GridIcon size={18} /></button>
              <button onClick={() => setView("table")} className={`p-2 rounded-lg ${view === "table" ? "bg-slate-200" : "hover:bg-slate-100"}`} title="표 보기"><List size={18} /></button>
            </div>
          </div>
        </div>
        {shareMode && (
          <div className="mx-auto max-w-6xl px-4 pb-3 text-sm text-slate-600">보유 체크 현황은 이 브라우저에만 저장됩니다.</div>
        )}
      </header>

      {/* 나머지 코드 동일 */}
}
function toISODate(d: any) {
  if (!d) return "";
  const dt = new Date(d);
  return isNaN(dt as any) ? "" : dt.toISOString().slice(0, 10);
}
function startOfWeek(date: any) {
  const d = new Date(date);
  const day = (d.getDay() + 6) % 7; // 월=0, 일=6
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}
function yyyymm(date: any) {
  const d = new Date(date);
  if (isNaN(d as any)) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function yearOf(date: any) {
  const d = new Date(date);
  return isNaN(d as any) ? "" : String(d.getFullYear());
}
function buildYearOptions(start = 2023, end = 2040) {
  const arr: string[] = [];
  for (let y = start; y <= end; y++) arr.push(String(y));
  return arr;
}

// --- Unicode-safe Base64 helpers (for 공유 링크) ---
function btoaUnicode(str: string) {
  // UTF-8 -> binary -> base64
  return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, p1) => String.fromCharCode(parseInt(p1, 16))));
}
function atobUnicode(b64: string) {
  // base64 -> binary -> UTF-8
  return decodeURIComponent(Array.prototype.map.call(atob(b64), (c: string) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
}

// ===================== 타입 =====================
interface Item {
  id: string;
  title: string;
  purchaseDate: string; // YYYY-MM-DD
  event: string;
  vendor: string;
  year: string; // 자동 계산(편집 불가)
  notes: string;
  have: boolean;
  imageDataUrl?: string; // base64
  imageUrl?: string; // 외부 URL (옵션 A: src 모드)
}

// ===================== 샘플 데이터 =====================
const SAMPLE_ITEMS: Item[] = [
  {
    id: newId(),
    title: "KL 팬미팅 세트 포카",
    purchaseDate: toISODate("2025-09-15"),
    event: "Be With You KL",
    vendor: "현장",
    year: "2025",
    notes: "현장 구매",
    have: true,
    imageDataUrl: "",
  },
  {
    id: newId(),
    title: "굿보이 스페셜 카드",
    purchaseDate: toISODate("2025-08-21"),
    event: "굿보이 블루레이 1차",
    vendor: "Ktown4u",
    year: "2025",
    notes: "증정품",
    have: false,
    imageDataUrl: "",
  },
  {
    id: newId(),
    title: "맥도날드 콜라보 포카",
    purchaseDate: toISODate("2025-07-10"),
    event: "콜라보",
    vendor: "YES24",
    year: "2025",
    notes: "사이즈 소형",
    have: true,
    imageDataUrl: "",
  },
];

// 이미지 리사이즈(최대 1200px) 후 dataURL 반환
// (미사용) 필요 시 리사이즈 유틸
async function resizeImageToDataURL(file: File, maxSize = 2000) {
  const reader = new FileReader();
  const load = new Promise((resolve) => {
    reader.onload = () => resolve(reader.result as string);
  });
  reader.readAsDataURL(file);
  const dataUrl = (await load) as string;

  const img = document.createElement("img");
  await new Promise((res) => {
    img.onload = res as any;
    img.src = dataUrl;
  });
  const { width, height } = img;
  const scale = Math.min(1, maxSize / Math.max(width, height));
  const w = Math.round(width * scale);
  const h = Math.round(height * scale);

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  canvas.width = w;
  canvas.height = h;
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", 0.92);
}

// ===================== 메인 =====================
export default function PokaListApp() {
  // 토스트(간단 피드백)
  const [toast, setToast] = useState<{show: boolean; text: string}>({ show: false, text: '' });
  useEffect(() => {
    if (!toast.show) return;
    const t = setTimeout(() => setToast({ show: false, text: '' }), 1400);
    return () => clearTimeout(t);
  }, [toast.show]);
  // 공유 모드 감지
  const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const sharedParam = params.get("catalog");
  const srcParam = params.get("src");
  const isEdit = params.get("edit") === "1"; // 편집 모드 강제
  const isAdmin = params.get("admin") === "1"; // 관리자 패널 노출
  const sourceMode = !!srcParam; // 옵션 A: 외부 JSON을 읽는 모드
  // edit/admin이면 공유모드 강제 해제
  const shareMode = ( !!sharedParam || sourceMode ) && !isEdit && !isAdmin;

  // GH Pages 기본 주소로 들어왔을 때 자동으로 catalog.json을 불러오도록 처리
  // (?src= 또는 ?catalog= 파라미터가 없으면 같은 경로의 catalog.json 존재 여부를 HEAD로 확인 후 리다이렉트)
  useEffect(() => {
    if (typeof window === "undefined") return;
    // edit/admin인 경우 자동 로드 우회 (보기 전용으로 강제 전환하지 않음)
    if (isEdit || isAdmin) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("src") || params.get("catalog")) return; // 이미 공유 모드면 패스

    const baseURL = window.location.href.endsWith("/") ? window.location.href : window.location.href + "/";
    const guess = new URL("catalog.json", baseURL).toString();
    (async () => {
      try {
        const res = await fetch(guess, { method: "HEAD", cache: "no-cache" });
        if (res.ok) {
          const base = window.location.origin + window.location.pathname;
          const link = `${base}?src=${encodeURIComponent(guess)}`;
          window.location.replace(link);
        }
      } catch { /* ignore */ }
    })();
  }, []);

  // 공유 메타 & 목록(공유 모드)
  const [shareMeta, setShareMeta] = useState({ id: "", title: "공유 카탈로그", note: "" });
  const [catalog, setCatalog] = useState<Item[]>([]);
  const [myChecks, setMyChecks] = useState<Record<string, boolean>>({});

  // 로컬 목록(일반 모드)
  const [items, setItems] = useState<Item[]>(() => {
    if (shareMode) return [];
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const arr = JSON.parse(raw) as Item[];
        return (arr || []).map((it) => ({
          ...it,
          year: it.year || (it.purchaseDate ? yearOf(it.purchaseDate) : ""),
        }));
      }
    } catch {}
    return [];
  });

  // 뷰/필터/그룹
  const [view, setView] = useState<"gallery" | "table">("gallery");
  // 관리자 패널 상태
  const [adminOpen, setAdminOpen] = useState<boolean>(isAdmin);
  const [gh, setGh] = useState<{owner:string; repo:string; branch:string; token:string}>(() => ({ owner: "gumming6-6", repo: "bogummy", branch: "main", token: "" }));
  const [query, setQuery] = useState("");
  const [groupBy, setGroupBy] = useState<"none" | "year" | "event" | "date" | "week" | "month">("year");
  const [eventFilter, setEventFilter] = useState<string>("all");
  const [yearFilter, setYearFilter] = useState<string>("all");
  const YEAR_OPTIONS = useMemo(() => buildYearOptions(2023, 2040), []);
  const [thumbSize, setThumbSize] = useState(160);

  // 폼 상태(연도 자동/읽기전용)
  const emptyForm: Item = {
    id: "",
    title: "",
    purchaseDate: toISODate(new Date()),
    event: "",
    vendor: "",
    year: yearOf(new Date()),
    notes: "",
    have: false,
    imageDataUrl: "",
  } as Item;
  const [form, setForm] = useState<Item>(emptyForm);
  const [openForm, setOpenForm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // 상세 보기 모달
  const [detail, setDetail] = useState<Item | null>(null);

  // ===== 공유 모드 초기화 (catalog 스냅샷) =====
  useEffect(() => {
    if (!shareMode || !sharedParam || sourceMode) return;
    try {
      const decodedStr = atobUnicode(decodeURIComponent(sharedParam!));
      const decoded = JSON.parse(decodedStr);
      const { v, id, title, note, items: list } = decoded || {};
      if (v !== 1 || !Array.isArray(list)) throw new Error("bad");
      const fixed: Item[] = list.map((it: Item) => ({
        ...it,
        year: it.year || (it.purchaseDate ? yearOf(it.purchaseDate) : ""),
      }));
      setShareMeta({ id: id || "catalog", title: title || "공유 카탈로그", note: note || "" });
      setCatalog(fixed);
      const saved = localStorage.getItem(SHARE_CHECK_KEY_PREFIX + (id || "catalog"));
      setMyChecks(saved ? JSON.parse(saved) : {});
    } catch {
      alert("공유 링크가 올바르지 않습니다.");
    }
  }, [shareMode, sharedParam, sourceMode]);

  // ===== 옵션 A: src 모드 초기화 (외부 JSON fetch) =====
  useEffect(() => {
    if (!sourceMode || !srcParam) return;
    let aborted = false;
    (async () => {
      try {
        const res = await fetch(srcParam, { cache: 'no-cache' });
        if (!res.ok) throw new Error('fetch failed');
        const data = await res.json();
        const { v, title, note, items: list } = data || {};
        if (v !== 1 || !Array.isArray(list)) throw new Error('bad format');
        const fixed: Item[] = list.map((it: Item) => ({
          ...it,
          year: it.year || (it.purchaseDate ? yearOf(it.purchaseDate) : ""),
        }));
        if (aborted) return;
        setShareMeta({ id: srcParam, title: title || "공유 카탈로그", note: note || "" });
        setCatalog(fixed);
        const saved = localStorage.getItem(SHARE_CHECK_KEY_PREFIX + srcParam);
        setMyChecks(saved ? JSON.parse(saved) : {});
      } catch (e) {
        alert("src JSON을 불러오지 못했습니다. URL과 CORS 설정(GitHub Pages 권장)을 확인해주세요.");
      }
    })();
    return () => { aborted = true; };
  }, [sourceMode, srcParam]);

  // ===== 편집/관리자 모드에서도 src가 있으면 한 번 로컬로 불러와서 편집 가능하게 =====
  useEffect(() => {
    if (!(isEdit || isAdmin)) return;
    if (!srcParam) return; // src 없으면 패스
    (async () => {
      try {
        const res = await fetch(srcParam, { cache: 'no-cache' });
        if (!res.ok) throw new Error('fetch failed');
        const data = await res.json();
        const { v, items: list } = data || {};
        if (v !== 1 || !Array.isArray(list)) throw new Error('bad format');
        const fixed: Item[] = list.map((it: Item) => ({
          ...it,
          year: it.year || (it.purchaseDate ? yearOf(it.purchaseDate) : ""),
        }));
        setItems(fixed);
      } catch (e) {
        console.warn('[PokaList] 편집/관리자 모드 src import 실패', e);
      }
    })();
  }, [isEdit, isAdmin, srcParam]);

  // 로컬 자동 저장
  useEffect(() => {
    if (shareMode) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); } catch {}
  }, [items, shareMode]);

  // 공유 체크 저장
  useEffect(() => {
    if (!shareMode) return;
    const key = sourceMode ? (srcParam || "src") : (shareMeta.id || "catalog");
    try { localStorage.setItem(SHARE_CHECK_KEY_PREFIX + key, JSON.stringify(myChecks)); } catch {}
  }, [myChecks, shareMode, shareMeta.id, sourceMode, srcParam]);

  // ===== 목록/필터 =====
  const baseList: Item[] = shareMode ? catalog.map((it) => ({ ...it, have: !!myChecks[it.id] })) : items;

  const filtered: Item[] = useMemo(() => {
    const q = query.trim().toLowerCase();
    return baseList.filter((it) => {
      if (eventFilter !== "all" && it.event !== eventFilter) return false;
      if (yearFilter !== "all" && it.year !== yearFilter) return false;
      if (!q) return true;
      const hay = (`${it.title} ${it.event} ${it.vendor} ${it.year} ${it.notes} ${it.purchaseDate}`)
        .toLowerCase()
        .replaceAll("\n", " ");
      return hay.includes(q);
    });
  }, [baseList, query, eventFilter, yearFilter]);

  const grouped = useMemo(() => {
    // 구매 날짜 오름차순(이른 날짜 먼저), 없으면 뒤로. 동일 날짜는 등록 순서 유지(안정 정렬 가정)
    const byDateAsc = (a: Item, b: Item) => {
      const da = a.purchaseDate || "";
      const db = b.purchaseDate || "";
      if (!da && !db) return 0; // 동일 취급 → 기존 순서 유지
      if (!da) return 1;        // 날짜 없는 건 뒤로
      if (!db) return -1;
      const diff = da.localeCompare(db);
      return diff; // 동일 날짜면 0 반환 → 입력 순서 유지
    };

    const map = new Map<string, Item[]>();
    const add = (key: string, v: Item) => {
      const arr = map.get(key) || [];
      arr.push(v);
      map.set(key, arr);
    };

    for (const it of filtered) {
      let key = "기타";
      if (groupBy === "none") key = "전체";
      else if (groupBy === "year") key = it.year?.trim() || "(연도 미지정)";
      else if (groupBy === "event") key = it.event?.trim() || "(이벤트 미지정)";
      else if (groupBy === "date") key = it.purchaseDate || "(날짜 없음)";
      else if (groupBy === "week") {
        if (it.purchaseDate) {
          const w = startOfWeek(it.purchaseDate);
          key = `${toISODate(w)}~${toISODate(new Date(w.getFullYear(), w.getMonth(), w.getDate() + 6))}`;
        } else key = "(날짜 없음)";
      } else if (groupBy === "month") key = it.purchaseDate ? yyyymm(it.purchaseDate) : "(날짜 없음)";
      add(key, it);
    }

    // 각 그룹 내부 정렬
    for (const [k, arr] of map.entries()) { arr.sort(byDateAsc); map.set(k, arr); }

    // 그룹 키 정렬
    const entries = Array.from(map.entries());
    if (groupBy === "year") {
      entries.sort((a, b) => (a[0] || "").localeCompare(b[0] || "", undefined, { numeric: true }));
    } else { entries.sort((a, b) => (a[0] || "").localeCompare(b[0] || "")); }
    return entries;
  }, [filtered, groupBy]);

  // 상세 모달: 현재 화면 기준 평탄화 목록/인덱스
  const flatList = useMemo(() => grouped.flatMap(([, arr]) => arr), [grouped]);
  const currentIndex = detail ? flatList.findIndex((x) => x.id === detail.id) : -1;
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < flatList.length - 1;
  const goPrev = () => { if (hasPrev) setDetail(flatList[currentIndex - 1]); };
  const goNext = () => { if (hasNext) setDetail(flatList[currentIndex + 1]); };

  // ===== CRUD =====
  function openNew() {
    setForm({ ...emptyForm, id: "", purchaseDate: toISODate(new Date()), year: yearOf(new Date()) });
    setOpenForm(true);
  }
  function openEdit(it: Item) {
    if (shareMode) return;
    setForm({ ...it });
    setOpenForm(true);
  }
  function saveForm() {
    if (!form.purchaseDate) { alert("구매 날짜를 입력해주세요"); return; }
    if (!form.year) { alert("연도를 확인해주세요"); return; }
    if (form.id) {
      setItems((prev) => prev.map((p) => (p.id === form.id ? { ...form } : p)));
    } else {
      // 동일 날짜일 때는 등록 순서대로 오른쪽(뒤쪽)에 붙도록, 새 항목을 배열 끝에 추가
      setItems((prev) => [...prev, { ...form, id: newId() }]);
    }
    setOpenForm(false);
  }
  function removeItem(id: string, title?: string) {
    if (shareMode) return;
    try { console.debug('[PokaList] remove click', { id, title }); } catch {}
    const ok = safeConfirm(`정말 삭제할까요?${title ? ' - ' + title : ''}`);
    if (!ok) return;
    setItems((prev) => {
      const before = prev.length;
      const next = prev.filter((p) => p.id !== id);
      try { console.debug('[PokaList] removed', { before, after: next.length }); } catch {}
      return next;
    });
    setDetail((d) => (d && d.id === id ? null : d));
    setToast({ show: true, text: '삭제했어요.' });
  }

  async function handleImagePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    // ✅ 원본 품질 유지: 리사이즈 없이 원본 DataURL 저장
    const reader = new FileReader();
    const dataUrl: string = await new Promise((resolve) => {
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    });
    setForm((f) => ({ ...f, imageDataUrl: dataUrl }));
  }

  async function handleMultiAdd(e: React.ChangeEvent<HTMLInputElement>) {
    if (shareMode) return;
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const date = prompt("모든 항목에 적용할 구매 날짜를 YYYY-MM-DD로 입력해주세요", toISODate(new Date()));
    const event = prompt("이벤트(예: 시그 기본포카)", "");
    const vendor = prompt("구매처(예: YES24 / 현장 / Ktown4u 등)", "");
    const derivedYear = yearOf(date || new Date());

    const created: Item[] = [];
    for (const f of files) {
      // ✅ 원본 품질 유지: 리사이즈 없이 원본 DataURL 저장
      const reader = new FileReader();
      const dataUrl: string = await new Promise((resolve) => {
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(f);
      });
      created.push({
        id: newId(),
        title: f.name.replace(/\.[^.]+$/, ""),
        purchaseDate: toISODate(date || new Date()),
        event: event || "",
        vendor: vendor || "",
        year: derivedYear,
        notes: "",
        have: false,
        imageDataUrl: dataUrl,
      });
    }
    // 동일 날짜에 기존 항목이 있다면, 새로 추가된 것들이 오른쪽(뒤쪽)에 오도록 끝에 붙인다
    setItems((prev) => [...prev, ...created]);
    e.target.value = "";
  }

  // ===== 공유 링크(이미지 제외) =====
  function createShareLink() {
    const normalized = items.map((d) => ({
      id: d.id || newId(),
      title: d.title || "",
      purchaseDate: d.purchaseDate || "",
      event: d.event || "",
      vendor: d.vendor || "",
      year: d.year || (d.purchaseDate ? yearOf(d.purchaseDate) : ""),
      notes: d.notes || "",
    }));
    const payload = { v: 1, id: newId(), title: "포카 카탈로그", note: "작성자가 공유한 포카 종류 목록(이미지는 공유되지 않음).", items: normalized };
    const encoded = encodeURIComponent(btoaUnicode(JSON.stringify(payload)));
    const base = window.location.origin + window.location.pathname;
    return `${base}?catalog=${encoded}`;
  }

  function exportJson(includeImages = true) {
    if (shareMode) return;
    const data = includeImages ? items : items.map(({ imageDataUrl, ...rest }) => rest);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = includeImages ? "poka_export_with_images.json" : "poka_export.json"; a.click();
    URL.revokeObjectURL(url);
  }
  function importJson(file: File) {
    if (shareMode) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string);
        if (!Array.isArray(data)) throw new Error("형식 오류");
        const cleaned: Item[] = data.map((d: any) => ({ id: d.id || newId(), ...d, year: d.year || (d.purchaseDate ? yearOf(d.purchaseDate) : "") }));
        setItems(cleaned);
      } catch (e) { alert("JSON 파일을 확인해주세요"); }
    };
    reader.readAsText(file);
  }
  function clearAll() {
    if (shareMode) return;
    if (!confirm("모든 데이터를 지울까요? (백업 권장)")) return;
    setItems([]);
  }
  // ===== GitHub API (관리자: 바로 커밋) =====
  const ghHeaders = useMemo(() => ({
    Authorization: gh.token ? `Bearer ${gh.token}` : undefined,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  }), [gh.token]);

  async function ghGetSha(path: string): Promise<string|undefined> {
    try {
      const url = `https://api.github.com/repos/${gh.owner}/${gh.repo}/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(gh.branch)}`;
      const res = await fetch(url, { headers: ghHeaders as any });
      if (!res.ok) return undefined;
      const json = await res.json();
      return json?.sha as string | undefined;
    } catch { return undefined; }
  }
  async function ghPutContent(path: string, contentBase64: string, message: string) {
    if (!gh.token) { alert("토큰을 입력해주세요 (repo 권한 필요)"); return; }
    const sha = await ghGetSha(path);
    const url = `https://api.github.com/repos/${gh.owner}/${gh.repo}/contents/${encodeURIComponent(path)}`;
    const body = { message, content: contentBase64, branch: gh.branch, sha } as any;
    const res = await fetch(url, { method: "PUT", headers: { ...(ghHeaders as any), "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) { const t = await res.text(); throw new Error(`GitHub 커밋 실패: ${res.status} ${t}`); }
    return res.json();
  }
  async function adminUploadImages(files: FileList | null) {
    if (!files || !files.length) return;
    try {
      for (const f of Array.from(files)) {
        // 파일을 base64로
        const buf = await f.arrayBuffer();
        let binary = ""; const bytes = new Uint8Array(buf);
        for (let i=0;i<bytes.length;i++) binary += String.fromCharCode(bytes[i]);
        const b64 = btoa(binary);
        const path = `public/images/${f.name}`;
        await ghPutContent(path, b64, `upload image ${f.name}`);
      }
      alert("이미지 업로드/커밋 완료!");
    } catch (e:any) { alert(e?.message || "업로드 실패"); }
  }
  async function adminCommitCatalog() {
    try {
      const normalized: Item[] = [];
      for (const d of items) {
        const base: Item = {
          id: d.id || newId(),
          title: d.title || "",
          purchaseDate: d.purchaseDate || "",
          event: d.event || "",
          vendor: d.vendor || "",
          year: d.year || (d.purchaseDate ? yearOf(d.purchaseDate) : ""),
          notes: d.notes || "",
          have: !!d.have,
        } as Item;

        // dataURL만 있고 imageUrl이 없으면, 파일로 커밋 후 imageUrl 채움
        if (d.imageDataUrl && !d.imageUrl) {
          const fname = `poka_${base.id}.jpg`;
          const b64 = (d.imageDataUrl.includes(',') ? d.imageDataUrl.split(',')[1] : d.imageDataUrl);
          const path = `public/images/${fname}`;
          await ghPutContent(path, b64, `upload image ${fname}`);
          base.imageUrl = `images/${fname}`;
        } else if (d.imageUrl) {
          base.imageUrl = d.imageUrl;
        }
        normalized.push(base);
      }

      const payload = { v: 1, title: "포카 카탈로그", note: "", items: normalized };
      const contentB64 = btoaUnicode(JSON.stringify(payload, null, 2));
      await ghPutContent("public/catalog.json", contentB64, "update catalog.json from admin panel");
      alert("catalog.json 커밋 완료! 1~2분 후 공유 링크에 반영됩니다.");
    } catch (e:any) { alert(e?.message || "catalog 커밋 실패"); }
  }

  // confirm 대체(미리보기 등 환경에서 window.confirm 차단 대비)
  function safeConfirm(message: string) {
    try {
      if (typeof window !== "undefined" && typeof window.confirm === "function") return window.confirm(message);
    } catch {}
    // confirm이 불가한 환경이라면 안전하게 진행하도록 true 반환 (사용자 요청 기반 액션이므로)
    return true;
  }
  function loadSamples() {
    if (shareMode) return;
    if (!confirm("샘플 데이터를 불러옵니다. 현재 데이터는 덮어쓰기 됩니다.")) return;
    setItems(SAMPLE_ITEMS);
  }

  // 보유 토글
  function toggleHave(it: Item, checked: boolean) {
    if (shareMode) setMyChecks((prev) => ({ ...prev, [it.id]: checked }));
    else setItems((prev) => prev.map((p) => (p.id === it.id ? { ...p, have: checked } : p)));
    setDetail((d) => (d && d.id === it.id ? { ...d, have: checked } : d));
  }

  // ===== (간단) 자체 테스트 =====
  useEffect(() => {
    try {
      const ids = new Set(Array.from({ length: 100 }, () => newId()));
      console.assert(ids.size === 100, "newId unique");
      console.assert(toISODate("2025-10-07") === "2025-10-07", "toISODate ok");
      console.assert(yyyymm("2025-10-07") === "2025-10", "yyyymm ok");
      const wk = startOfWeek("2025-10-07");
      console.assert(toISODate(wk) === "2025-10-06", "week start Monday");
      console.assert(yearOf("2024-12-31") === "2024", "yearOf ok");
      console.assert(VENDOR_OPTIONS.includes("YES24") && VENDOR_OPTIONS.includes("현장"), "vendor options ok");
      // 동일 날짜 정렬 안정성(등록 순 유지) 테스트
      const t: Item[] = [
        { id: "a", title: "A", purchaseDate: "2025-08-01", event: "", vendor: "", year: "2025", notes: "", have: false },
        { id: "b", title: "B", purchaseDate: "2025-08-01", event: "", vendor: "", year: "2025", notes: "", have: false },
        { id: "c", title: "C", purchaseDate: "2025-08-02", event: "", vendor: "", year: "2025", notes: "", have: false },
      ];
      const cmp = (a: Item, b: Item) => {
        const da = a.purchaseDate || ""; const db = b.purchaseDate || ""; if (!da && !db) return 0; if (!da) return 1; if (!db) return -1; return da.localeCompare(db);
      };
      const t2 = [...t].sort(cmp);
      console.assert(t2[0].id === "a" && t2[1].id === "b" && t2[2].id === "c", "stable same-date order");
      // Base64 Unicode 라운드트립 테스트
      const kor = "한글 테스트 ❤️ & イメージ";
      const round = atobUnicode(btoaUnicode(kor));
      console.assert(round === kor, "btoaUnicode/atobUnicode roundtrip");
      const payload = { v: 1, title: "포카 카탈로그", note: "메모", items: [{ id: "x", title: "제목", event: "시그 기본포카", vendor: "현장", purchaseDate: "2025-10-07", year: "2025", notes: "메모", have: false }] };
      const encoded = encodeURIComponent(btoaUnicode(JSON.stringify(payload)));
      const decoded = JSON.parse(atobUnicode(decodeURIComponent(encoded)));
      console.assert(decoded.v === 1 && decoded.items.length === 1, "share payload encode/decode");
      console.log("[PokaList] self-tests passed");
      // 삭제 동작 테스트
      const del = (arr: Item[], id: string) => arr.filter((p) => p.id !== id);
      const d2 = del(t, "b");
      console.assert(d2.length === 2 && !d2.some((x) => x.id === "b"), "delete logic ok");
    } catch (e) {
      console.warn("[PokaList] self-tests error", e);
    }
  }, []);

  // ===================== 렌더 =====================
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* 상단 대제목 */}
      <div className="bg-white text-center py-3 border-b border-slate-200">
        <div className="mx-auto max-w-6xl px-4">
          <div className="text-2xl md:text-3xl font-extrabold tracking-wide">BOGUMMY PHOTOCARD LIST❣️</div>
        </div>
      </div>

      {/* 상단 툴바 */}
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b border-slate-200">
        <div className="mx-auto max-w-6xl px-4 py-3 flex flex-wrap items-center gap-3">
          {!shareMode && (<h1 className="text-xl font-bold">포카리스트 체크{isEdit ? " · 편집 모드" : (isAdmin ? " · 관리자 모드" : "")}</h1>)}

          <div className="flex items-center gap-2 ml-auto">
            {!shareMode && (
              <>
                <button onClick={openNew} className="inline-flex items-center gap-1 rounded-xl px-3 py-2 bg-blue-600 text-white hover:bg-blue-700 shadow"><Plus size={16} /> 새 항목</button>
                <label className="inline-flex items-center gap-2 rounded-xl px-3 py-2 bg-slate-200 hover:bg-slate-300 cursor-pointer">
                  <Upload size={16} /> 다중 이미지 추가
                  <input type="file" accept="image/*" multiple className="hidden" onChange={handleMultiAdd} />
                </label>
              </>
            )}

            <div className="h-6 w-px bg-slate-300" />

            <div className="flex items-center gap-2">
              <button onClick={() => setView("gallery")} className={`p-2 rounded-lg ${view === "gallery" ? "bg-slate-200" : "hover:bg-slate-100"}`} title="갤러리 보기"><GridIcon size={18} /></button>
              <button onClick={() => setView("table")} className={`p-2 rounded-lg ${view === "table" ? "bg-slate-200" : "hover:bg-slate-100"}`} title="표 보기"><List size={18} /></button>
            </div>

            <div className="h-6 w-px bg-slate-300" />

            {!shareMode && (
              <div className="flex items-center gap-2">
                <button onClick={() => exportJson(true)} className="px-3 py-2 rounded-xl bg-slate-900 text-white hover:bg-black inline-flex items-center gap-2"><Download size={16} /> JSON 내보내기(이미지 포함)</button>
                <button onClick={() => exportJson(false)} className="px-3 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 inline-flex items-center gap-2"><Download size={16} /> JSON 내보내기(텍스트만)</button>
                <label className="px-3 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 inline-flex items-center gap-2 cursor-pointer">
                  <Upload size={16} /> JSON 가져오기
                  <input type="file" accept="application/json" className="hidden" onChange={(e) => e.target.files?.[0] && importJson(e.target.files[0])} />
                </label>
                <button
                  onClick={() => {
                    const link = createShareLink();
                    const notice = `공유 링크를 클립보드에 복사했어요!
친구에게 보내서 각자 보유 체크를 할 수 있습니다. (이미지 미포함)`;
                    if ((navigator as any).clipboard?.writeText) {
                      (navigator as any).clipboard.writeText(link).then(() => alert(notice)).catch(() => {
                        alert(`${notice}

복사가 실패했어요. 아래 링크를 직접 복사해주세요:
${link}`);
                      });
                    } else { alert(`${notice}

아래 링크를 복사해주세요:
${link}`); }
                  }}
                  className="px-3 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700"
                >공유 링크(스냅샷) 생성</button>
                <button
                  onClick={() => {
                    const url = prompt('불러올 JSON 주소(src)를 입력하세요 (예: https://yourname.github.io/repo/catalog.json)');
                    if (!url) return;
                    const base = window.location.origin + window.location.pathname;
                    const link = `${base}?src=${encodeURIComponent(url)}`;
                    if ((navigator as any).clipboard?.writeText) {
                      (navigator as any).clipboard.writeText(link).then(() => alert('src 링크를 복사했어요! 이 링크는 원본 JSON이 업데이트되면 자동 반영됩니다.')).catch(() => {
                        alert(`아래 링크를 복사해주세요:
${link}`);
                      });
                    } else {
                      alert(`아래 링크를 복사해주세요:
${link}`);
                    }
                  }}
                  className="px-3 py-2 rounded-xl bg-amber-500 text-white hover:bg-amber-600"
                >JSON 주소로 공유(src)</button>
              </div>
            )}

            {isAdmin && (
              <>
                <div className="h-6 w-px bg-slate-300" />
                <button onClick={() => setAdminOpen((v)=>!v)} className="px-3 py-2 rounded-xl bg-purple-600 text-white hover:bg-purple-700">관리자 패널 {adminOpen ? '닫기' : '열기'}</button>
              </>
            )}

            {!shareMode && (<>
              <div className="h-6 w-px bg-slate-300" />
              <span className="text-xs text-slate-500">모드: {isAdmin ? '관리자' : (isEdit ? '편집' : '로컬')}</span>
            </>)}
          </div>
        </div>
        {adminOpen && (
          <div className="mx-auto max-w-6xl px-4 pb-3">
            <div className="p-3 rounded-xl border bg-purple-50 border-purple-200 space-y-2">
              <div className="text-sm font-semibold text-purple-800">관리자: GitHub 바로 커밋</div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                <input className="px-3 py-2 rounded-lg border" placeholder="owner (예: gumming6-6)" value={gh.owner} onChange={(e)=>setGh({...gh, owner:e.target.value})} />
                <input className="px-3 py-2 rounded-lg border" placeholder="repo (예: bogummy)" value={gh.repo} onChange={(e)=>setGh({...gh, repo:e.target.value})} />
                <input className="px-3 py-2 rounded-lg border" placeholder="branch (예: main)" value={gh.branch} onChange={(e)=>setGh({...gh, branch:e.target.value})} />
                <input className="px-3 py-2 rounded-lg border" placeholder="GitHub 토큰 (repo 권한)" value={gh.token} onChange={(e)=>setGh({...gh, token:e.target.value})} />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="px-3 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 inline-flex items-center gap-2 cursor-pointer">
                  <Upload size={16}/> 이미지 업로드(commit to public/images/)
                  <input type="file" multiple className="hidden" onChange={(e)=>adminUploadImages(e.target.files)} />
                </label>
                <button onClick={adminCommitCatalog} className="px-3 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700">catalog.json 커밋</button>
                <div className="text-xs text-slate-600">커밋 후 1~2분 후 공유 링크에 반영됩니다.</div>
              </div>
            </div>
          </div>
        )}
        
          </div>
        )}
      </header>

      {/* 검색/필터/그룹/크기 */}
      <div className="mx-auto max-w-6xl px-4 py-4">
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <div className="relative">
            <Search className="absolute left-2 top-2.5" size={18} />
            <input className="pl-8 pr-3 py-2 rounded-xl border border-slate-300 bg-white min-w-[260px]" placeholder="검색: 제목/이벤트/구매처/연도/메모/날짜" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>

          <select value={eventFilter} onChange={(e) => setEventFilter(e.target.value)} className="px-3 py-2 rounded-xl border border-slate-300 bg-white">
            <option value="all">이벤트: 전체</option>
            {EVENT_OPTIONS.map((opt) => (<option key={opt} value={opt}>{opt}</option>))}
          </select>

          <select value={yearFilter} onChange={(e) => setYearFilter(e.target.value)} className="px-3 py-2 rounded-xl border border-slate-300 bg-white">
            <option value="all">연도: 전체</option>
            {YEAR_OPTIONS.map((y) => (<option key={y} value={y}>{y}</option>))}
          </select>

          <select value={groupBy} onChange={(e) => setGroupBy(e.target.value as any)} className="px-3 py-2 rounded-xl border border-slate-300 bg-white">
            <option value="year">그룹: 연도</option>
            <option value="event">그룹: 이벤트</option>
            <option value="date">그룹: 구매 날짜(일)</option>
            <option value="week">그룹: 구매 날짜(주)</option>
            <option value="month">그룹: 구매 날짜(월)</option>
            <option value="none">그룹 없음</option>
          </select>

          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-600">이미지 너비 {thumbSize}px</span>
            <input type="range" min={140} max={360} value={thumbSize} onChange={(e) => setThumbSize(Number(e.target.value))} />
          </div>
        </div>

        {/* 목록 */}
        <div className="mt-4">
          {grouped.length === 0 && (
            <div className="text-center text-slate-500 py-16">{shareMode ? "공유된 목록이 비어있어요." : "아직 항목이 없습니다. 상단의 새 항목 또는 다중 이미지 추가를 눌러 시작해보세요!"}</div>
          )}

          {grouped.map(([key, arr]) => (
            <section key={key} className="mb-10">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-lg font-semibold">{key} <span className="text-slate-400 text-sm">({arr.length})</span></h2>
              </div>

              {view === "gallery" ? (
                <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${thumbSize}px, 1fr))` }}>
                  {arr.map((it) => (
                    <div key={it.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                      {/* 사진 컨테이너: 2:3 비율 */}
                      <div className="w-full p-3">
                        <div className="w-full bg-white rounded-xl border border-slate-200 overflow-hidden aspect-[2/3] cursor-pointer" onClick={() => setDetail(it)}>
                          {(it.imageDataUrl || it.imageUrl) ? (
                            <img src={(it.imageDataUrl || it.imageUrl)!} alt={it.title || "포카"} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full grid place-items-center bg-slate-50 text-slate-300"><ImageIcon /></div>
                          )}
                        </div>
                      </div>

                      <div className="px-3 pb-3 space-y-1">
                        <div className="font-medium text-sm truncate" title={it.title || it.event || "포카"}>{it.title || it.event || "(제목 없음)"}</div>
                        <div className="text-xs text-slate-500 truncate">{it.event || "-"} · {it.vendor || "-"}</div>
                        <div className="text-xs text-slate-500 flex items-center gap-2">
                          <span>{it.purchaseDate || "-"} · {it.year || "-"}</span>
                          <label className="ml-auto flex items-center gap-1 text-[11px] select-none cursor-pointer">
                            <input type="checkbox" checked={!!it.have} onChange={(e) => toggleHave(it, e.target.checked)} /> 보유
                          </label>
                        </div>
                        {it.notes && <div className="text-xs text-slate-600">{it.notes}</div>}
                        <div className="pt-1 flex items-center gap-2">
                          {!shareMode && <button onClick={() => openEdit(it)} className="px-2 py-1 text-xs rounded-lg bg-slate-100 hover:bg-slate-200">수정</button>}
                          {!shareMode && <button type="button" onClick={(e) => { e.stopPropagation(); removeItem(it.id, it.title); }} className="px-2 py-1 text-xs rounded-lg bg-red-100 text-red-700 hover:bg-red-200 pointer-events-auto">삭제</button>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="overflow-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50">
                      <tr className="text-left">
                        <th className="p-2">썸네일</th>
                        <th className="p-2">제목</th>
                        <th className="p-2">구매 날짜</th>
                        <th className="p-2">이벤트</th>
                        <th className="p-2">구매처</th>
                        <th className="p-2">연도</th>
                        <th className="p-2">비고</th>
                        <th className="p-2">보유</th>
                        {!shareMode && <th className="p-2">작업</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {arr.map((it) => (
                        <tr key={it.id} className="border-t border-slate-200">
                          <td className="p-2">
                            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden cursor-pointer" style={{ width: thumbSize }} onClick={() => setDetail(it)}>
                              <div className="aspect-[2/3] w-full">
                                {(it.imageDataUrl || it.imageUrl) ? (
                            <img src={(it.imageDataUrl || it.imageUrl)!} alt={it.title || "포카"} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full grid place-items-center bg-slate-50 text-slate-300"><ImageIcon /></div>
                          )}
                              </div>
                            </div>
                          </td>
                          <td className="p-2 max-w-[240px]"><div className="truncate" title={it.title}>{it.title}</div></td>
                          <td className="p-2 whitespace-nowrap">{it.purchaseDate}</td>
                          <td className="p-2">{it.event}</td>
                          <td className="p-2">{it.vendor}</td>
                          <td className="p-2">{it.year}</td>
                          <td className="p-