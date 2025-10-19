import React, { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Upload, List, Grid as GridIcon, Search, Image as ImageIcon, X, Link as LinkIcon, ChevronLeft, ChevronRight, Pencil, Trash2 } from "lucide-react";

// ---- helpers ----
const yearFrom = (d?: string) => {
  if (!d) return "";
  const t = new Date(d);
  return isNaN(t.getTime()) ? "" : String(t.getFullYear());
};
const byDateAsc = (a: any, b: any) => {
  const da = a.purchaseDate || a.date || "";
  const db = b.purchaseDate || b.date || "";
  if (!da && !db) return 0;
  if (!da) return 1;
  if (!db) return -1;
  const diff = da.localeCompare(db);
  if (diff !== 0) return diff;
  return (a.__idx ?? 0) - (b.__idx ?? 0);
};

/** 수정 요약
 * 1) 상세 모달의 이벤트/연도 입력을 드롭다운으로 복원
 * 2) 관리자 패널 상단 버튼 정렬(flex wrap) 문제 해결
 */

export default function PokaListApp() {
  const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const isAdmin = params.get("admin") === "1";
  const isEdit = params.get("edit") === "1";
  const srcRaw = params.get("src") || "";
  let srcParam = srcRaw; try { srcParam = decodeURIComponent(srcRaw); } catch {}
  const shareMode = !!srcParam && !isAdmin && !isEdit;

  const [items, setItems] = useState<any[]>([]);
  const [loadError, setLoadError] = useState("");
  const [filter, setFilter] = useState({ search: "", event: "전체", year: "전체" });
  const [detail, setDetail] = useState<any|null>(null);
  const [adminOpen, setAdminOpen] = useState(isAdmin);
  const [gh, setGh] = useState({ owner: "gumming6-6", repo: "bogummy", branch: "main", token: "" });

  const eventOptions = useMemo(() => ["", "팬미팅", "팬미 추가특전", "기타"], []);
  const yearOptions = useMemo(() => ["", "2023", "2024", "2025"], []);

  useEffect(()=>{ document.title = "BOGUMMY PHOTOCARD" }, []);

  // 데이터 로드: srcParam 사용 시 외부 catalog.json에서 불러오기
  useEffect(() => {
    let abort = false;
    (async () => {
      try {
        setLoadError("");
        if (!srcParam) return;
        const r = await fetch(srcParam, { cache: "no-cache" });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = await r.json();
        const raw: any[] = Array.isArray(data) ? data : (Array.isArray(data?.items) ? data.items : []);
        const norm = raw.map((it: any, i: number) => ({
          id: it.id || `${Date.now().toString(36)}-${i}`,
          title: it.title || it.name || "",
          event: it.event || it.group || "",
          vendor: it.vendor || it.buyer || "",
          notes: it.notes || it.memo || "",
          purchaseDate: it.purchaseDate || it.date || "",
          year: it.year || yearFrom(it.purchaseDate || it.date),
          imageUrl: it.image || it.imageUrl || it.imageDataUrl || "",
          have: !!it.have,
          __idx: i,
        }));
        if (!abort) setItems(norm);
      } catch (e) {
        console.error(e);
        if (!abort) setLoadError("목록을 불러오지 못했습니다. URL/CORS를 확인해주세요.");
      }
    })();
    return () => { abort = true; };
  }, [srcParam]);

  // 필터링 + 연도별 그룹
  const filtered = React.useMemo(() => {
    const q = filter.search.trim().toLowerCase();
    return items.filter((c) => {
      const okEvent = filter.event === "전체" || c.event === filter.event;
      const okYear = filter.year === "전체" || c.year === filter.year;
      const hay = `${c.title} ${c.event} ${c.vendor} ${c.notes} ${c.purchaseDate}`.toLowerCase();
      const okSearch = !q || hay.includes(q);
      return okEvent && okYear && okSearch;
    });
  }, [items, filter]);
  const grouped = React.useMemo(() => {
    const m: Record<string, any[]> = {};
    filtered.forEach((c) => { const y = c.year || "연도 미지정"; (m[y] ||= []).push(c); });
    Object.keys(m).forEach((y) => m[y].sort(byDateAsc));
    return m;
  }, [filtered]);
  const orderedYears = React.useMemo(() => {
    const ks = Object.keys(grouped);
    const kn = ks.filter(k=>k!=="연도 미지정").map(Number).filter(n=>!isNaN(n)).sort((a,b)=>a-b).map(String);
    return [...kn, ...(ks.includes("연도 미지정")?["연도 미지정"]:[])];
  }, [grouped]);

  const eventOptions = React.useMemo(() => ["전체", ...Array.from(new Set(items.map(c=>c.event).filter(Boolean)))], [items]);
  const yearOptions = React.useMemo(() => ["전체", ...Array.from(new Set(items.map(c=>c.year).filter(Boolean))).sort((a:any,b:any)=>Number(a)-Number(b))], [items]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* 헤더 */}
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b border-slate-200">
        <div className="mx-auto max-w-6xl px-4 py-3 flex flex-wrap items-center gap-2">
          <div className="text-2xl font-extrabold">BOGUMMY PHOTOCARD LIST❣️</div>
          {!shareMode && (
            <div className="flex flex-wrap items-center gap-2 ml-auto">
              <button className="bg-blue-600 text-white px-3 py-2 rounded-lg text-sm flex items-center gap-1 hover:bg-blue-700"><Plus size={14}/> 새 항목</button>
              <label className="bg-slate-700 text-white px-3 py-2 rounded-lg text-sm flex items-center gap-1 hover:bg-slate-800 cursor-pointer"><Upload size={14}/> 다중 이미지 추가<input type="file" multiple className="hidden"/></label>
              <button className="bg-amber-500 text-white px-3 py-2 rounded-lg text-sm flex items-center gap-1 hover:bg-amber-600"><LinkIcon size={14}/> JSON 주소로 공유(src)</button>
              <button onClick={()=>setAdminOpen(v=>!v)} className="bg-purple-600 text-white px-3 py-2 rounded-lg text-sm flex items-center gap-1 hover:bg-purple-700">관리자 패널 {adminOpen?"닫기":"열기"}</button>
            </div>
          )}
        </div>

        {/* 관리자 패널 */}
        {!shareMode && adminOpen && (
          <div className="mx-auto max-w-6xl px-4 pb-3">
            <div className="p-3 rounded-xl border bg-purple-50 border-purple-200 space-y-2">
              <div className="text-sm font-semibold text-purple-800">관리자: GitHub 바로 커밋</div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                <input className="px-3 py-2 rounded-lg border" placeholder="owner" value={gh.owner} onChange={(e)=>setGh({...gh, owner:e.target.value})}/>
                <input className="px-3 py-2 rounded-lg border" placeholder="repo" value={gh.repo} onChange={(e)=>setGh({...gh, repo:e.target.value})}/>
                <input className="px-3 py-2 rounded-lg border" placeholder="branch" value={gh.branch} onChange={(e)=>setGh({...gh, branch:e.target.value})}/>
                <input className="px-3 py-2 rounded-lg border" placeholder="token" value={gh.token} onChange={(e)=>setGh({...gh, token:e.target.value})}/>
              </div>
              <div className="flex flex-wrap gap-2">
                <label className="bg-slate-200 hover:bg-slate-300 px-3 py-2 rounded-xl inline-flex items-center gap-2 cursor-pointer"><Upload size={16}/> 이미지 업로드<input type="file" multiple className="hidden"/></label>
                <button className="px-3 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700">catalog.json 커밋</button>
                <div className="text-xs text-slate-600">커밋 후 1~2분 후 반영됩니다.</div>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* 필터 바 + 목록 */}
      <main className="mx-auto max-w-6xl px-4 py-6">
        {/* 필터 */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <div className="flex items-center border rounded-lg px-2 bg-white w-full md:w-80">
            <Search size={18} className="text-slate-400" />
            <input type="text" placeholder="검색: 제목/이벤트/구매처/연도/메모" value={filter.search} onChange={(e)=>setFilter({...filter, search:e.target.value})} className="w-full px-2 py-1 outline-none text-sm bg-transparent" />
          </div>
          <select value={filter.event} onChange={(e)=>setFilter({...filter, event:e.target.value})} className="border rounded-lg px-2 py-1 text-sm">
            {eventOptions.map((v)=>(<option key={v}>{v}</option>))}
          </select>
          <select value={filter.year} onChange={(e)=>setFilter({...filter, year:e.target.value})} className="border rounded-lg px-2 py-1 text-sm">
            {yearOptions.map((v)=>(<option key={v}>{v}</option>))}
          </select>
        </div>

        {loadError && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 border border-red-200 text-sm">{loadError}</div>
        )}

        {/* 연도별 그룹 */}
        {orderedYears.map((y) => (
          <section key={y} className="mb-8">
            <h2 className="text-lg font-semibold mb-3 border-b border-slate-300 pb-1">{y}</h2>
            <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(160px, 1fr))` }}>
              {grouped[y]?.map((card: any, i: number) => (
                <article key={card.id || i} className="bg-white shadow rounded-xl p-2 border border-slate-200 cursor-pointer" onClick={()=>setDetail(card)}>
                  <div className="w-full rounded-xl border border-slate-200 overflow-hidden aspect-[2/3] bg-white">
                    {card.imageUrl ? (
                      <img src={card.imageUrl} alt={card.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full grid place-items-center text-slate-300"><ImageIcon/></div>
                    )}
                  </div>
                  <div className="mt-2 text-sm font-medium text-slate-800 truncate" title={card.title}>{card.title || "(제목 없음)"}</div>
                  <div className="text-xs text-slate-500 truncate">{card.event || "-"} · {card.year || "-"}</div>
                </article>
              ))}
            </div>
          </section>
        ))}

        {items.length === 0 && !loadError && (
          <div className="text-center text-slate-400">카드가 없습니다.</div>
        )}
      </main>

      {/* 상세 모달 */}
      {detail && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm grid place-items-center p-3 z-[200]">
          <div className="bg-white rounded-2xl w-[90vw] max-w-[360px] shadow-xl p-3">
            <div className="flex items-center justify-between mb-2 border-b pb-2">
              <b>상세 정보</b>
              <button onClick={()=>setDetail(null)}><X size={18}/></button>
            </div>
            <div className="space-y-2 text-sm">
              <label className="block">제목<input className="w-full border rounded px-2 py-1 mt-1"/></label>
              <label className="block">구매 날짜<input type="date" className="w-full border rounded px-2 py-1 mt-1"/></label>
              <label className="block">이벤트<select className="w-full border rounded px-2 py-1 mt-1">{eventOptions.map(v=>(<option key={v}>{v}</option>))}</select></label>
              <label className="block">구매처<input className="w-full border rounded px-2 py-1 mt-1"/></label>
              <label className="block">연도<select className="w-full border rounded px-2 py-1 mt-1">{yearOptions.map(v=>(<option key={v}>{v}</option>))}</select></label>
              <label className="block">비고<textarea rows={3} className="w-full border rounded px-2 py-1 mt-1"/></label>
              <div className="flex justify-end gap-2 pt-2 border-t mt-2">
                <button className="px-3 py-1.5 rounded bg-slate-100 hover:bg-slate-200">닫기</button>
                <button className="px-3 py-1.5 rounded bg-emerald-600 text-white hover:bg-emerald-700">저장</button>
                <button className="px-3 py-1.5 rounded bg-rose-600 text-white hover:bg-rose-700">삭제</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
