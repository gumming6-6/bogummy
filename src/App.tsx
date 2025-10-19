import React, { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Upload, Download, List, Grid as GridIcon, Search, Image as ImageIcon, X } from "lucide-react";

// ===================== 유틸 =====================
const STORAGE_KEY = "pokaList-v1";
const SHARE_CHECK_KEY_PREFIX = "pokaShareChecks-";

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
function newId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
// --- Unicode-safe Base64 helpers (for 공유 링크) ---
function btoaUnicode(str: string) {
  return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, p1) => String.fromCharCode(parseInt(p1, 16))));
}
function atobUnicode(b64: string) {
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

// 옵션 데이터
const EVENT_OPTIONS = [
  "시그 미공포",
  "시그 기본포카",
  "해외 팝업",
  "시그 미공포(해외)",
  "팬미 입장특전",
  "팬미 추가특전",
  "굿즈 특전",
];
const VENDOR_OPTIONS = [
  "TBL샵",
  "YG SELECT",
  "Ktown4u",
  "WITHMUU",
  "알라딘",
  "메이크스타",
  "대만",
  "태국",
  "일본",
  "현장",
  "YES24",
];

// ===================== 메인 =====================
export default function PokaListApp() {
  // URL 파라미터
  const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const srcParam = params.get("src");
  const sharedParam = params.get("catalog");
  const isEdit = params.get("edit") === "1";
  const isAdmin = params.get("admin") === "1";
  const sourceMode = !!srcParam; // 외부 JSON 연결
  const shareMode = (!!sharedParam || sourceMode) && !isEdit && !isAdmin; // 편집/관리자면 공유모드 해제

  // 타이틀 토스트 (작은 피드백)
  const [toast, setToast] = useState<{show:boolean;text:string}>({show:false, text:""});
  useEffect(() => { if (!toast.show) return; const t = setTimeout(()=>setToast({show:false,text:""}), 1400); return ()=>clearTimeout(t); }, [toast.show]);

  // 공유 메타 & 목록(공유 모드)
  const [shareMeta, setShareMeta] = useState({ id: "", title: "공유 카탈로그", note: "" });
  const [catalog, setCatalog] = useState<Item[]>([]);
  const [myChecks, setMyChecks] = useState<Record<string, boolean>>({});

  // 로컬 목록(일반/편집/관리자)
  const [items, setItems] = useState<Item[]>(() => {
    if (shareMode) return [];
    try { const raw = localStorage.getItem(STORAGE_KEY); if (raw) { const arr = JSON.parse(raw) as Item[]; return (arr||[]).map((it)=>({ ...it, year: it.year || (it.purchaseDate ? yearOf(it.purchaseDate) : "") })); } } catch {}
    return [];
  });

  const [view, setView] = useState<"gallery"|"table">("gallery");
  const [adminOpen, setAdminOpen] = useState<boolean>(isAdmin);
  const [query, setQuery] = useState("");
  const [thumbSize, setThumbSize] = useState(160);

  // ===== 공유 초기화: catalog 스냅샷 =====
  useEffect(() => {
    if (!shareMode || !sharedParam || sourceMode) return;
    try {
      const decodedStr = atobUnicode(decodeURIComponent(sharedParam!));
      const decoded = JSON.parse(decodedStr);
      const { v, id, title, note, items: list } = decoded || {};
      if (v !== 1 || !Array.isArray(list)) throw new Error("bad");
      const fixed: Item[] = list.map((it: Item) => ({ ...it, year: it.year || (it.purchaseDate ? yearOf(it.purchaseDate) : "") }));
      setShareMeta({ id: id || "catalog", title: title || "공유 카탈로그", note: note || "" });
      setCatalog(fixed);
      const saved = localStorage.getItem(SHARE_CHECK_KEY_PREFIX + (id || "catalog"));
      setMyChecks(saved ? JSON.parse(saved) : {});
    } catch { alert("공유 링크가 올바르지 않습니다."); }
  }, [shareMode, sharedParam, sourceMode]);

  // ===== 외부 JSON(src) 불러오기 =====
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
        const fixed: Item[] = list.map((it: Item) => ({ ...it, year: it.year || (it.purchaseDate ? yearOf(it.purchaseDate) : "") }));
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

  // ===== 편집/관리자 모드에서 src 기반으로 로컬 편집 허용 =====
  useEffect(() => {
    if (!(isEdit || isAdmin)) return;
    if (!srcParam) return;
    (async () => {
      try {
        const res = await fetch(srcParam, { cache: 'no-cache' });
        if (!res.ok) throw new Error('fetch failed');
        const data = await res.json();
        const { v, items: list } = data || {};
        if (v !== 1 || !Array.isArray(list)) throw new Error('bad format');
        const fixed: Item[] = list.map((it: Item) => ({ ...it, year: it.year || (it.purchaseDate ? yearOf(it.purchaseDate) : "") }));
        setItems(fixed);
      } catch (e) { console.warn('[PokaList] 편집/관리자 모드 src import 실패', e); }
    })();
  }, [isEdit, isAdmin, srcParam]);

  // 로컬 자동 저장
  useEffect(() => { if (!shareMode) try { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); } catch {} }, [items, shareMode]);

  // 공유 체크 저장
  useEffect(() => {
    if (!shareMode) return;
    const key = sourceMode ? (srcParam || "src") : (shareMeta.id || "catalog");
    try { localStorage.setItem(SHARE_CHECK_KEY_PREFIX + key, JSON.stringify(myChecks)); } catch {}
  }, [myChecks, shareMode, shareMeta.id, sourceMode, srcParam]);

  // ===== 목록 소스 =====
  const baseList: Item[] = shareMode ? catalog.map((it) => ({ ...it, have: !!myChecks[it.id] })) : items;

  // ===== 필터/검색 =====
  const filtered: Item[] = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return baseList;
    return baseList.filter((it) => {
      const hay = (`${it.title} ${it.event} ${it.vendor} ${it.year} ${it.notes} ${it.purchaseDate}`).toLowerCase().replaceAll("\n", " ");
      return hay.includes(q);
    });
  }, [baseList, query]);

  // ===== 상세 모달 =====
  const [detail, setDetail] = useState<Item | null>(null);
  const flatList = filtered;
  const currentIndex = detail ? flatList.findIndex((x) => x.id === detail.id) : -1;
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < flatList.length - 1;
  const goPrev = () => { if (hasPrev) setDetail(flatList[currentIndex - 1]); };
  const goNext = () => { if (hasNext) setDetail(flatList[currentIndex + 1]); };

  // ===== 보유 토글 =====
  function toggleHave(it: Item, checked: boolean) {
    if (shareMode) setMyChecks((prev) => ({ ...prev, [it.id]: checked }));
    else {
      setItems((prev) => prev.map((p) => (p.id === it.id ? { ...p, have: checked } : p)));
    }
    setDetail((d) => (d && d.id === it.id ? { ...d, have: checked } : d));
  }

  // ===================== 렌더 =====================
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* 상단 대제목 (공유 모드에선 숨김) */}
{!shareMode && (
  <div className="bg-white text-center py-3 border-b border-slate-200">
    <div className="mx-auto max-w-6xl px-4">
      <div className="text-2xl md:text-3xl font-extrabold tracking-wide">BOGUMMY PHOTOCARD LIST❣️</div>
    </div>
  </div>
)}

      {/* 상단 툴바 (요청사항 반영) */}
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b border-slate-200">
        <div className="mx-auto max-w-6xl px-4 py-3 flex flex-wrap items-center gap-3">
          {shareMode ? (
            // 공유 모드: 제목/부제 숨김 + 안내 문구만 표시
            <div className="text-sm text-slate-600">보유 체크 현황은 이 브라우저에만 저장됩니다.</div>
          ) : (
            // 일반/편집/관리자 모드: 기존 헤더 유지(간단형)
            <h1 className="text-xl font-bold">포카리스트 체크{isEdit ? " · 편집 모드" : (isAdmin ? " · 관리자 모드" : "")}</h1>
          )}

          {/* 우측: 보기 토글 아이콘은 항상 보이게 유지 */}
          <div className="flex items-center gap-2 ml-auto">
            <button onClick={() => setView("gallery")} className={`p-2 rounded-lg ${view === "gallery" ? "bg-slate-200" : "hover:bg-slate-100"}`} title="갤러리 보기"><GridIcon size={18} /></button>
            <button onClick={() => setView("table")} className={`p-2 rounded-lg ${view === "table" ? "bg-slate-200" : "hover:bg-slate-100"}`} title="표 보기"><List size={18} /></button>
          </div>
        </div>
      </header>

      {/* 검색/크기 조절 */}
      <div className="mx-auto max-w-6xl px-4 py-4">
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <div className="relative">
            <Search className="absolute left-2 top-2.5" size={18} />
            <input className="pl-8 pr-3 py-2 rounded-xl border border-slate-300 bg-white min-w-[260px]" placeholder="검색: 제목/이벤트/구매처/연도/메모/날짜" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-600">이미지 너비 {thumbSize}px</span>
            <input type="range" min={140} max={360} value={thumbSize} onChange={(e) => setThumbSize(Number(e.target.value))} />
          </div>
        </div>

        {/* 목록 */}
        <div className="mt-4">
          {filtered.length === 0 && (
            <div className="text-center text-slate-500 py-16">{shareMode ? "공유된 목록이 비어있어요." : "아직 항목이 없습니다."}</div>
          )}

          {/* 갤러리 뷰 */}
          {view === "gallery" && (
            <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${thumbSize}px, 1fr))` }}>
              {filtered.map((it) => (
                <div key={it.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
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
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 테이블 뷰 */}
          {view === "table" && (
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
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((it) => (
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
                      <td className="p-2">{it.notes}</td>
                      <td className="p-2"><input type="checkbox" checked={!!it.have} onChange={(e)=>toggleHave(it, e.target.checked)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* 상세 보기 모달 */}
      {detail && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm grid place-items-center p-4" onClick={() => setDetail(null)}>
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl" onClick={(e)=>e.stopPropagation()}>
            <div className="flex items-center justify-between p-3 border-b">
              <div className="font-semibold">상세 정보</div>
              <button className="p-1 rounded hover:bg-slate-100" onClick={()=>setDetail(null)}><X size={18} /></button>
            </div>
            <div className="p-3 space-y-2">
              <div className="w-full rounded-xl border overflow-hidden aspect-[2/3] bg-slate-50 grid place-items-center">
                {(detail.imageDataUrl || detail.imageUrl) ? (
                  <img src={(detail.imageDataUrl || detail.imageUrl)!} alt={detail.title || "포카"} className="w-full h-full object-cover" />
                ) : (<ImageIcon className="text-slate-300" />)}
              </div>
              <div className="text-sm"><b>제목</b> {detail.title || "(제목 없음)"}</div>
              <div className="text-sm"><b>구매 날짜</b> {detail.purchaseDate || "-"}</div>
              <div className="text-sm"><b>이벤트</b> {detail.event || "-"}</div>
              <div className="text-sm"><b>구매처</b> {detail.vendor || "-"}</div>
              <div className="text-sm"><b>연도</b> {detail.year || "-"}</div>
              {detail.notes && <div className="text-sm whitespace-pre-wrap"><b>비고</b> {detail.notes}</div>}
              <label className="mt-2 inline-flex items-center gap-2 text-sm select-none cursor-pointer">
                <input type="checkbox" checked={!!detail.have} onChange={(e)=>toggleHave(detail, e.target.checked)} /> 보유
              </label>
            </div>
            <div className="p-3 flex justify-between border-t">
              <button className="px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-40" onClick={goPrev} disabled={!hasPrev}>이전</button>
              <button className="px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-40" onClick={goNext} disabled={!hasNext}>다음</button>
            </div>
          </div>
        </div>
      )}

      {/* 토스트 */}
      {toast.show && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 px-3 py-2 rounded-lg bg-black text-white text-sm shadow">
          {toast.text}
        </div>
      )}
    </div>
  );
}
