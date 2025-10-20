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


// 선택지(드롭다운)
const EVENT_CHOICES = [
  "",
  "시그 미공포",
  "시그 기본포카",
  "해외 팝업",
  "시그 미공포(해외)",
  "팬미 입장특전",
  "팬미 추가특전",
  "굿즈 특전",
];
const VENDOR_CHOICES = [
  "",
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

// --- GitHub 커밋 유틸리티 (UTF-8 Base64 안전 인코딩) ---
const toBase64Utf8 = (str: string) => {
  const bytes = new TextEncoder().encode(str);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  // btoa는 Latin1만 허용 → UTF-8 바이트 시퀀스로 변환한 뒤 인코딩
  return btoa(bin);
};

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
  const [detailMode, setDetailMode] = useState<"view"|"edit"|"create"|null>(null);
  const [myChecks, setMyChecks] = useState<Record<string, boolean>>({});
  const [adminOpen, setAdminOpen] = useState(isAdmin);
  const [gh, setGh] = useState({ owner: "gumming6-6", repo: "bogummy", branch: "main", token: "" });
  const [isCommitting, setIsCommitting] = useState(false);

  // catalog.json 커밋 (관리자 패널 버튼 전용)
  const commitCatalogJson = async () => {
    try {
      if (!gh.owner || !gh.repo || !gh.branch || !gh.token) {
        alert("owner/repo/branch/토큰을 모두 입력하세요.");
        return;
      }
      setIsCommitting(true);
      const path = "public/catalog.json";
      // 1) 현재 sha 조회 (있으면 업데이트, 없으면 생성)
      let sha: string | undefined;
      const metaRes = await fetch(`https://api.github.com/repos/${gh.owner}/${gh.repo}/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(gh.branch)}`, {
        headers: { Authorization: `token ${gh.token}`, Accept: "application/vnd.github+json" },
      });
      if (metaRes.ok) {
        const meta = await metaRes.json();
        if (meta && meta.sha) sha = meta.sha;
      }

      // 2) catalog 내용 만들기 (배포 포맷은 배열/또는 {items:[]} 둘 다 호환되지만 배열로 저장)
      const payloadItems = items.map((it) => ({
        id: it.id,
        title: it.title,
        event: it.event,
        vendor: it.vendor,
        notes: it.notes,
        purchaseDate: it.purchaseDate,
        year: it.year,
        imageUrl: it.imageUrl,
        have: !!it.have,
      }));
      const jsonText = JSON.stringify(payloadItems, null, 2);
      const contentB64 = toBase64Utf8(jsonText);

      // 3) PUT contents API
      const putRes = await fetch(`https://api.github.com/repos/${gh.owner}/${gh.repo}/contents/${encodeURIComponent(path)}`, {
        method: "PUT",
        headers: { Authorization: `token ${gh.token}`, "Content-Type": "application/json", Accept: "application/vnd.github+json" },
        body: JSON.stringify({
          message: "chore: update catalog.json via admin panel",
          content: contentB64,
          branch: gh.branch,
          sha,
        }),
      });

      if (!putRes.ok) {
        const errText = await putRes.text();
        console.error(errText);
        alert("커밋 실패: " + putRes.status + "
" + errText);
        return;
      }
      alert("catalog.json 커밋 완료!
1~2분 후 공유 링크에 반영됩니다.");
    } catch (e:any) {
      console.error(e);
      alert("커밋 중 오류: " + (e?.message || e));
    } finally {
      setIsCommitting(false);
    }
  };

  useEffect(()=>{ document.title = "BOGUMMY PHOTOCARD" }, []);

  const shareKey = React.useMemo(() => `pokaShareChecks-${srcParam || 'local'}`,[srcParam]);
  useEffect(()=>{ try { const raw = localStorage.getItem(shareKey); if (raw) setMyChecks(JSON.parse(raw)); } catch {} },[shareKey]);
  useEffect(()=>{ try { localStorage.setItem(shareKey, JSON.stringify(myChecks)); } catch {} },[myChecks, shareKey]);

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

  // 화면에 렌더된 카드 순서를 1차원으로 펼친 목록(연도 그룹 순서 + 날짜 오름차순)
  const viewList = React.useMemo(() => {
    const out: any[] = [];
    orderedYears.forEach((y) => {
      const arr = grouped[y] || [];
      arr.forEach((c) => out.push(c));
    });
    return out;
  }, [orderedYears, grouped]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b border-slate-200">
        <div className="mx-auto max-w-6xl px-4 py-3 flex flex-wrap items-center gap-2">
          <div className="text-2xl font-extrabold">BOGUMMY PHOTOCARD LIST❣️</div>
          {!shareMode && (
            <div className="flex flex-wrap items-center gap-2 ml-auto">
              <button className="bg-blue-600 text-white px-3 py-2 rounded-lg text-sm flex items-center gap-1 hover:bg-blue-700" onClick={() => {
                const blank = { id: `${Date.now().toString(36)}-new`, title: "", event: "", vendor: "", notes: "", purchaseDate: "", year: "", imageUrl: "", have: false };
                setDetail(blank);
                setDetailMode("create");
              }}><Plus size={14}/> 새 항목</button>
              <label className="bg-slate-700 text-white px-3 py-2 rounded-lg text-sm flex items-center gap-1 hover:bg-slate-800 cursor-pointer"><Upload size={14}/> 다중 이미지 추가<input type="file" multiple className="hidden"/></label>
              <button className="bg-amber-500 text-white px-3 py-2 rounded-lg text-sm flex items-center gap-1 hover:bg-amber-600"><LinkIcon size={14}/> JSON 주소로 공유(src)</button>
              <button onClick={()=>setAdminOpen(v=>!v)} className="bg-purple-600 text-white px-3 py-2 rounded-lg text-sm flex items-center gap-1 hover:bg-purple-700">관리자 패널 {adminOpen?"닫기":"열기"}</button>
            </div>
          )}
        </div>

        {/* 관리자 패널 (이전과 동일 UI 복구) */}
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
                <button onClick={commitCatalogJson} disabled={isCommitting} className={`px-3 py-2 rounded-xl text-white ${isCommitting ? 'bg-emerald-400 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700'}`}>{isCommitting ? '커밋 중…' : 'catalog.json 커밋'}</button>
                <button className="px-3 py-2 rounded-xl bg-amber-500 text-white hover:bg-amber-600 inline-flex items-center gap-2"><LinkIcon size={16}/> JSON 주소로 공유(src)</button>
                <div className="text-xs text-slate-600">커밋 후 1~2분 후 반영됩니다.</div>
              </div>
            </div>
          </div>
        )}
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        {/* 필터 */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <div className="flex items-center border rounded-lg px-2 bg-white w-full md:w-80">
            <Search size={18} className="text-slate-400" />
            <input
              type="text"
              placeholder="검색: 제목/이벤트/구매처/연도/메모"
              value={filter.search}
              onChange={(e)=>setFilter({...filter, search:e.target.value})}
              className="w-full px-2 py-1 outline-none text-sm bg-transparent"
            />
          </div>
          <select
            value={filter.event}
            onChange={(e)=>setFilter({...filter, event:e.target.value})}
            className="border rounded-lg px-2 py-1 text-sm"
          >
            {eventOptions.map((v)=>(<option key={v}>{v}</option>))}
          </select>
          <select
            value={filter.year}
            onChange={(e)=>setFilter({...filter, year:e.target.value})}
            className="border rounded-lg px-2 py-1 text-sm"
          >
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
                <article
                  key={card.id || i}
                  className="relative bg-white shadow rounded-xl p-2 border border-slate-200 cursor-pointer"
                  onClick={()=>{ setDetail(card); setDetailMode("view"); }}
                >
                  <div className="w-full rounded-xl border border-slate-200 overflow-hidden aspect-[2/3] bg-white">
                    {card.imageUrl ? (
                      <img src={card.imageUrl} alt={card.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full grid place-items-center text-slate-300"><ImageIcon/></div>
                    )}
                  </div>
                  <div className="mt-2 text-sm font-medium text-slate-800 truncate" title={card.title}>{card.title || "(제목 없음)"}</div>
                  <div className="text-xs text-slate-500 truncate">{card.event || "-"} · {card.year || "-"}</div>
                  <label
                    className="mt-1 flex items-center gap-1 text-xs text-slate-600 select-none"
                    onClick={(e)=>e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      checked={shareMode ? !!myChecks[card.id] : !!card.have}
                      onChange={(e)=>{
                        const checked = e.currentTarget.checked;
                        if (shareMode) setMyChecks(prev=>({ ...prev, [card.id]: checked }));
                        else setItems(prev=>prev.map(c=>c.id===card.id?{...c, have: checked}:c));
                      }}
                    /> 보유
                  </label>
                  {!shareMode && (
                    <div className="absolute right-2 top-2 flex gap-1">
                      <button
                        title="수정"
                        className="p-1 rounded bg-white/80 hover:bg-white shadow"
                        onClick={(e)=>{e.stopPropagation(); setDetail(card); setDetailMode("edit");}}
                      ><Pencil size={14}/></button>
                      <button
                        title="삭제"
                        className="p-1 rounded bg-white/80 hover:bg-white shadow"
                        onClick={(e)=>{e.stopPropagation(); if(window.confirm("삭제하시겠습니까?")) setItems(prev=>prev.filter(c=>c.id!==card.id));}}
                      ><Trash2 size={14}/></button>
                    </div>
                  )}
                </article>
              ))}
            </div>
          </section>
        ))}

        {items.length === 0 && !loadError && (
          <div className="text-center text-slate-400">카드가 없습니다.</div>
        )}
              {/* 상세/수정/등록 모달 */}
        {detail && (
          <DetailModal
            mode={detailMode}
            shareMode={shareMode}
            card={detail}
            list={viewList}
            onClose={()=>{ setDetail(null); setDetailMode(null); }}
            onPrev={(id:string)=>{
              const idx = viewList.findIndex(c=>c.id===id);
              if (idx>0) { setDetail(viewList[idx-1]); setDetailMode(shareMode?"view":detailMode); }
            }}
            onNext={(id:string)=>{
              const idx = viewList.findIndex(c=>c.id===id);
              if (idx>=0 && idx<viewList.length-1) { setDetail(viewList[idx+1]); setDetailMode(shareMode?"view":detailMode); }
            }}
            onToggleHave={(id:string, checked:boolean)=>{
              if (shareMode) setMyChecks(prev=>({ ...prev, [id]: checked }));
              else setItems(prev=>prev.map(c=>c.id===id?{...c, have: checked}:c));
            }}
            onSave={(draft:any)=>{
              if (draft.__delete) {
                setItems(prev=>prev.filter(c=>c.id!==draft.id));
                setDetail(null); setDetailMode(null);
                return;
              }
              const next = { ...draft, year: draft.year || yearFrom(draft.purchaseDate) };
              if (detailMode === "create") setItems(prev=>[...prev, next]);
              else setItems(prev=>prev.map(c=>c.id===next.id? next : c));
              setDetail(null); setDetailMode(null);
            }}
          />
        )}
      </main>
    </div>
  );
}

function DetailModal({ mode, shareMode, card, list, onClose, onPrev, onNext, onToggleHave, onSave }: any){
  const idx = React.useMemo(()=> list.findIndex((c:any)=>c.id===card.id), [list, card]);
  const canPrev = idx>0; const canNext = idx>=0 && idx<list.length-1;
  const isViewOnly = shareMode || mode === "view";
  const [draft, setDraft] = useState<any>(card);
  useEffect(()=>{ setDraft(card); }, [card]);

  const fileRef = useRef<HTMLInputElement|null>(null);
  const openFile = ()=>{ if(!isViewOnly) fileRef.current?.click(); };
  const onFileChange: React.ChangeEventHandler<HTMLInputElement> = (e)=>{
    const f = e.target.files?.[0]; if(!f) return;
    const r = new FileReader();
    r.onload = ()=> setDraft((d:any)=>({ ...d, imageUrl: String(r.result||"") }));
    r.readAsDataURL(f);
  };

  const handleDateChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const val = e.target.value;
    const y = val ? new Date(val).getFullYear().toString() : draft.year;
    setDraft({ ...draft, purchaseDate: val, year: y });
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm grid place-items-center p-3 z-[200]" onClick={onClose}>
      <div className={`bg-white rounded-2xl w-[90vw] ${isViewOnly ? 'max-w-[300px]' : 'max-w-[360px]'} shadow-xl p-3 relative`} onClick={(e)=>e.stopPropagation()}>
        <button className="absolute right-2 top-2 p-1 rounded hover:bg-slate-100" onClick={onClose}><X size={18}/></button>
        <div className="relative rounded-xl border overflow-hidden aspect-[2/3] bg-white grid place-items-center mb-2" onClick={openFile}>
          {(draft.imageUrl || card.imageUrl) ? (<img src={draft.imageUrl || card.imageUrl} className="w-full h-full object-cover"/>) : (<div className="text-slate-300"><ImageIcon/></div>)}
          {canPrev && (<button className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/80 hover:bg-white shadow" onClick={()=>onPrev(card.id)}><ChevronLeft/></button>)}
          {canNext && (<button className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/80 hover:bg-white shadow" onClick={()=>onNext(card.id)}><ChevronRight/></button>)}
          {!isViewOnly && (<input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFileChange} />)}
        </div>
        {isViewOnly ? (
          <div className="space-y-1 text-sm">
            <div><b>제목</b> {card.title || "(제목 없음)"}</div>
            <div><b>구매 날짜</b> {card.purchaseDate || "-"}</div>
            <div><b>이벤트</b> {card.event || "-"}</div>
            <div><b>구매처</b> {card.vendor || "-"}</div>
            <div><b>연도</b> {card.year || "-"}</div>
            <div><b>비고</b> {card.notes || "-"}</div>
            <label className="mt-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={!!card.have} onChange={(e)=>onToggleHave(card.id, e.currentTarget.checked)} /> 보유</label>
            <div className="flex justify-end pt-2"><button className="px-3 py-1.5 rounded bg-slate-100 hover:bg-slate-200" onClick={onClose}>닫기</button></div>
          </div>
        ) : (
          <div className="space-y-2 text-sm">
            <label className="block">제목<input value={draft.title||""} onChange={(e)=>setDraft({...draft,title:e.target.value})} className="w-full border rounded px-2 py-1 mt-1"/></label>
            <label className="block">구매 날짜<input type="date" value={draft.purchaseDate||""} onChange={handleDateChange} className="w-full border rounded px-2 py-1 mt-1"/></label>
            <label className="block">이벤트<select value={draft.event||""} onChange={(e)=>setDraft({...draft,event:e.target.value})} className="w-full border rounded px-2 py-1 mt-1">{EVENT_CHOICES.map(v => (<option key={v} value={v}>{v || "(선택)"}</option>))}</select></label>
            <label className="block">구매처<select value={draft.vendor||""} onChange={(e)=>setDraft({...draft,vendor:e.target.value})} className="w-full border rounded px-2 py-1 mt-1">{VENDOR_CHOICES.map(v => (<option key={v} value={v}>{v || "(선택)"}</option>))}</select></label>
            <label className="block">연도<input value={draft.year||""} onChange={(e)=>setDraft({...draft,year:e.target.value})} className="w-full border rounded px-2 py-1 mt-1"/></label>
            <label className="block">비고<textarea value={draft.notes||""} onChange={(e)=>setDraft({...draft,notes:e.target.value})} rows={3} className="w-full border rounded px-2 py-1 mt-1"/></label>
            <label className="mt-1 flex items-center gap-2 text-sm"><input type="checkbox" checked={!!draft.have} onChange={(e)=>setDraft({...draft,have:e.currentTarget.checked})} /> 보유</label>
            <div className="flex justify-end gap-2 pt-2 border-t mt-2">
              <button className="px-3 py-1.5 rounded bg-slate-100 hover:bg-slate-200" onClick={onClose}>닫기</button>
              <button className="px-3 py-1.5 rounded bg-emerald-600 text-white hover:bg-emerald-700" onClick={()=>onSave(draft)}>저장</button>
              <button className="px-3 py-1.5 rounded bg-rose-600 text-white hover:bg-rose-700" onClick={()=>{ if(window.confirm('삭제하시겠습니까?')) onSave({ ...draft, __delete: true }); }}>삭제</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
