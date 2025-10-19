import React, { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Upload, List, Grid as GridIcon, Search, Image as ImageIcon, X, Link as LinkIcon, ChevronLeft, ChevronRight, Pencil, Trash2 } from "lucide-react";

/** 복원 + 보강 버전 (안정화)
 * 1) 공유: 카드 하단 보유 체크, 모달 동기화, 브라우저 로컬 저장
 * 2) 관리자: 새 항목(1개만), 카드별 수정/삭제, 다중 이미지 추가, GitHub 커밋(409 자동재시도)
 * 3) 모달: 이전/다음 버튼을 이미지 좌/우 플로팅으로 배치
 * 4) 정렬: 연도 오름차순(2023→…), 동일 날짜는 등록 순서대로 오른쪽 추가
 */

// ---------- 유틸 ----------
const STORAGE_KEY = "pokaList-admin-local"; // 관리자 임시 저장(로컬)
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
const safeB64 = (str: string) => btoa(unescape(encodeURIComponent(str)));
const yearFrom = (d?: string) => {
  if (!d) return "";
  const t = new Date(d);
  return isNaN(t.getTime()) ? "" : String(t.getFullYear());
};

export default function PokaListApp() {
  // ------ URL 파라미터 ------
  const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const srcRaw = params.get("src") || "";
  let srcParam = srcRaw; try { srcParam = decodeURIComponent(srcRaw); } catch {}
  const isEdit = params.get("edit") === "1";
  const isAdmin = params.get("admin") === "1";
  const sourceMode = !!srcParam; // 외부 JSON 사용 여부
  const shareMode = sourceMode && !isEdit && !isAdmin; // 공유 보기 전용
  useEffect(() => { document.title = "BOGUMMY PHOTOCARD"; }, []);

  // ------ 상태 ------
  const [view, setView] = useState<"gallery"|"table">("gallery");
  const [items, setItems] = useState<any[]>([]);
  const [loadError, setLoadError] = useState("");
  const [filter, setFilter] = useState({ event: "전체", year: "전체", search: "" });
  const idxRef = useRef(0);

  // 공유 모드 보유 체크(브라우저별 저장)
  const shareKey = useMemo(() => `pokaShareChecks:${srcParam||"local"}`, [srcParam]);
  const [myChecks, setMyChecks] = useState<Record<string, boolean>>({});
  useEffect(() => { try { const v = localStorage.getItem(shareKey); if (v) setMyChecks(JSON.parse(v)); } catch {} }, [shareKey]);
  useEffect(() => { try { localStorage.setItem(shareKey, JSON.stringify(myChecks)); } catch {} }, [shareKey, myChecks]);

  // 관리자 패널
  const [adminOpen, setAdminOpen] = useState<boolean>(isAdmin);
  const [gh, setGh] = useState({ owner: "gumming6-6", repo: "bogummy", branch: "main", token: "" });

  // 상세 모달
  const [detail, setDetail] = useState<any|null>(null);

  // 상세 모달용 이미지 파일 입력 ref + 선택 핸들러(이미지 클릭으로 선택)
  const detailFileRef = useRef<HTMLInputElement | null>(null);
  const onDetailImageSelect = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const f = files[0];
    const url = URL.createObjectURL(f);
    setDetail((d:any) => d ? { ...d, imageUrl: url, __file: f } : d);
  };

  // ------ 데이터 로드 ------
  useEffect(() => {
    let aborted = false;
    (async () => {
      try {
        setLoadError("");
        // 1) 외부 JSON 사용
        if (sourceMode) {
          const r = await fetch(srcParam, { cache: "no-cache" });
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          const data = await r.json();
          const raw: any[] = Array.isArray(data) ? data : (Array.isArray(data?.items) ? data.items : []);
          const normalized = raw.map((it: any, i: number) => ({
            id: it.id || `${Date.now().toString(36)}-${i}`,
            title: it.title || it.name || "",
            event: it.event || "",
            vendor: it.vendor || it.buyer || "",
            notes: it.notes || it.memo || "",
            purchaseDate: it.purchaseDate || it.date || "",
            year: it.year || yearFrom(it.purchaseDate || it.date),
            imageUrl: it.image || it.imageUrl || it.imageDataUrl || "",
            have: !!it.have,
            __idx: i,
          }));
          if (!aborted) setItems(normalized);
          return;
        }
        // 2) 로컬 임시 저장 불러오기(관리자/편집)
        const v = localStorage.getItem(STORAGE_KEY);
        if (v) {
          const arr = JSON.parse(v);
          if (!aborted) setItems(arr);
        }
      } catch (e) {
        console.error(e);
        if (!aborted) setLoadError("src JSON을 불러오지 못했습니다. URL과 CORS 설정(GitHub Pages 권장)을 확인해주세요.");
      }
    })();
    return () => { aborted = true; };
  }, [sourceMode, srcParam]);

  // 관리자/편집 시 로컬 임시 저장
  useEffect(() => {
    if (!(isAdmin || isEdit)) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); } catch {}
  }, [items, isAdmin, isEdit]);

  // ------ 필터링/그룹/정렬 ------
  const filtered = useMemo(() => {
    const q = filter.search.trim().toLowerCase();
    return items.filter((c) => {
      const matchEvent = filter.event === "전체" || c.event === filter.event;
      const matchYear = filter.year === "전체" || c.year === filter.year;
      const hay = `${c.title} ${c.event} ${c.vendor} ${c.notes} ${c.purchaseDate}`.toLowerCase().replaceAll("\n", " ");
      const matchSearch = !q || hay.includes(q);
      return matchEvent && matchYear && matchSearch;
    });
  }, [items, filter]);

  const grouped = useMemo(() => {
    const map: Record<string, any[]> = {};
    filtered.forEach((c, i) => { const y = c.year || "연도 미지정"; (map[y] ||= []).push({ ...c, __i: i }); });
    Object.keys(map).forEach((y) => map[y].sort(byDateAsc));
    return map;
  }, [filtered]);

  const orderedYearKeys = useMemo(() => {
    const keys = Object.keys(grouped);
    const known = keys.filter((k) => k !== "연도 미지정").map((k) => Number(k)).filter((n)=>!isNaN(n)).sort((a,b)=>a-b).map(String);
    return [...known, ...(keys.includes("연도 미지정") ? ["연도 미지정"] : [])];
  }, [grouped]);

  // ------ 옵션 ------
  const eventOptions = useMemo(() => ["전체", ...Array.from(new Set(items.map((c) => c.event).filter(Boolean)))], [items]);
  const yearOptions = useMemo(() => ["전체", ...Array.from(new Set(items.map((c) => c.year).filter(Boolean))).sort((a:any,b:any)=>Number(a)-Number(b))], [items]);

  // ------ 보유 토글 ------
  function toggleHave(it: any, checked: boolean) {
    if (shareMode) {
      setMyChecks((prev) => ({ ...prev, [it.id]: checked }));
      setDetail((d) => (d && d.id === it.id ? { ...d, have: checked } : d));
    } else {
      setItems((prev) => prev.map((p) => (p.id === it.id ? { ...p, have: checked } : p)));
      setDetail((d) => (d && d.id === it.id ? { ...d, have: checked } : d));
    }
  }

  // ------ 새 항목 ------
  function addNewItem() {
    const it = {
      id: `${Date.now().toString(36)}-${idxRef.current++}`,
      title: "",
      event: "",
      vendor: "",
      notes: "",
      purchaseDate: "",
      year: "",
      imageUrl: "",
      have: false,
      __idx: idxRef.current,
    };
    setItems((prev)=>[...prev, it]);
    setDetail(it); // 즉시 편집 모달 열기
  }

  // 다중 이미지 추가 → 각 파일을 새 항목으로
  function handleMultiAdd(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);
    let lastItem: any | null = null;
    setItems((prev) => {
      const next = [...prev];
      files.forEach((f) => {
        const url = URL.createObjectURL(f);
        const it = {
          id: `${Date.now().toString(36)}-${idxRef.current++}`,
          title: "",
          event: "",
          vendor: "",
          notes: "",
          purchaseDate: "",
          year: "",
          imageUrl: url,
          __file: f,
          have: false,
          __idx: idxRef.current,
        };
        next.push(it);
        lastItem = it;
      });
      return next;
    });
    if (lastItem) setDetail(lastItem);
  }

  // 카드 삭제
  function removeItem(id: string) {
    if (!confirm("정말 삭제할까요?")) return;
    setItems((prev) => prev.filter((x) => x.id !== id));
    setDetail((d) => (d && d.id === id ? null : d));
  }

  // 공유 링크 만들기
  function createSrcShareLink() {
    const base = typeof window !== 'undefined' ? window.location.origin + window.location.pathname : '';
    const src = srcParam || `${base}catalog.json`;
    const url = `${base}?src=${encodeURIComponent(src)}`;
    navigator.clipboard?.writeText(url).then(()=>alert('공유 링크를 클립보드에 복사했어요!'));
  }

  // ------ GitHub API (409 자동 재시도) ------
  async function ghApi(path: string, contentB64: string, message: string) {
    const { owner, repo, branch, token } = gh;
    if (!owner || !repo || !branch || !token) { alert("GitHub 정보와 토큰을 입력하세요."); return; }
    const base = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
    const fetchSha = async () => {
      const r = await fetch(`${base}?ref=${encodeURIComponent(branch)}`, { headers: { Authorization: `token ${token}` } });
      if (r.status === 200) { const j = await r.json(); return j.sha as string; }
      return undefined;
    };
    const putOnce = async (sha?: string) => fetch(base, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `token ${token}` },
      body: JSON.stringify({ message, content: contentB64, branch, sha })
    });
    let sha = await fetchSha();
    let res = await putOnce(sha);
    if (res.status === 409) { sha = await fetchSha(); res = await putOnce(sha); }
    if (!res.ok) { let d=""; try{ const j=await res.json(); d=j?.message||"";}catch{} throw new Error(`GitHub API ${res.status}${d?`: ${d}`:""}`); }
    return res.json();
  }

  async function adminUploadImages(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    try {
      for (const f of Array.from(fileList)) {
        const buf = await f.arrayBuffer();
        const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
        const name = `public/images/${Date.now()}_${f.name}`;
        await ghApi(name, b64, `upload image ${f.name}`);
      }
      alert("이미지 커밋 완료");
    } catch (e:any) { alert(`이미지 업로드 실패: ${e?.message || e}`); }
  }

  async function adminCommitCatalog() {
    try {
      const payload = { v: 1, title: "BOGUMMY", items: items.map(({__i, __idx, __file, ...rest}) => rest) };
      const b64 = safeB64(JSON.stringify(payload, null, 2));
      await ghApi("public/catalog.json", b64, "update catalog.json");
      alert("catalog.json 커밋 완료 (1~2분 후 반영)");
    } catch (e:any) { alert(`카탈로그 커밋 실패: ${e?.message || e}`); }
  }

  // ------ 렌더 ------
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* 상단 헤더 */}
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b border-slate-200">
        <div className="mx-auto max-w-6xl px-4 py-3 flex flex-wrap items-center gap-3">
          <div className="text-2xl md:text-3xl font-extrabold tracking-wide whitespace-nowrap">BOGUMMY PHOTOCARD LIST❣️</div>
          <div className="flex items-center gap-2 ml-auto">
            <button onClick={() => setView("gallery")} className={`p-2 rounded-lg ${view === "gallery" ? "bg-slate-200" : "hover:bg-slate-100"}`} title="갤러리 보기"><GridIcon size={18} /></button>
            <button onClick={() => setView("table")} className={`p-2 rounded-lg ${view === "table" ? "bg-slate-200" : "hover:bg-slate-100"}`} title="표 보기"><List size={18} /></button>
            {shareMode ? (
              <div className="text-sm text-slate-600 ml-2 truncate">보유 체크 현황은 이 브라우저에만 저장됩니다.</div>
            ) : (
              <>
                <button onClick={addNewItem} className="flex items-center gap-1 bg-blue-600 text-white px-3 py-2 rounded-lg text-sm hover:bg-blue-700"><Plus size={14} /> 새 항목</button>
                <label className="flex items-center gap-1 bg-slate-700 text-white px-3 py-2 rounded-lg text-sm hover:bg-slate-800 cursor-pointer">
                  <Upload size={14} /> 다중 이미지 추가
                  <input type="file" accept="image/*" multiple className="hidden" onChange={(e)=>handleMultiAdd(e.target.files)} />
                </label>
                <button onClick={() => createSrcShareLink()} className="flex items-center gap-1 bg-amber-500 text-white px-3 py-2 rounded-lg text-sm hover:bg-amber-600"><LinkIcon size={14}/> JSON 주소로 공유(src)</button>
                <button onClick={() => setAdminOpen(v=>!v)} className="flex items-center gap-1 bg-purple-600 text-white px-3 py-2 rounded-lg text-sm hover:bg-purple-700">관리자 패널 {adminOpen?"닫기":"열기"}</button>
              </>
            )}
          </div>
        </div>

        {/* 필터 바 */}
        <div className="mx-auto max-w-6xl px-4 pb-3 flex flex-wrap items-center gap-3 justify-between">
          <div className="flex items-center gap-2 w-full md:w-auto">
            <div className="flex items-center border rounded-lg px-2 bg-white w-full md:w-80">
              <Search size={18} className="text-slate-400" />
              <input type="text" placeholder="검색: 제목/이벤트/구매처/연도/메모" value={filter.search} onChange={(e)=>setFilter({...filter, search:e.target.value})} className="w-full px-2 py-1 outline-none text-sm bg-transparent" />
            </div>
            <select value={filter.event} onChange={(e)=>setFilter({...filter, event:e.target.value})} className="border rounded-lg px-2 py-1 text-sm">
              {eventOptions.map((e)=>(<option key={e}>{e}</option>))}
            </select>
            <select value={filter.year} onChange={(e)=>setFilter({...filter, year:e.target.value})} className="border rounded-lg px-2 py-1 text-sm">
              {yearOptions.map((y)=>(<option key={y}>{y}</option>))}
            </select>
          </div>
        </div>

        {/* 관리자 패널 */}
        {!shareMode && adminOpen && (
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
      </header>

      {/* 본문: 연도별 그룹 (오름차순) */}
      <main className="mx-auto max-w-6xl px-4 py-8">
        {loadError && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 border border-red-200 text-sm">{loadError}</div>
        )}

        {orderedYearKeys.map((year) => (
          <section key={year} className="mb-8">
            <h2 className="text-lg font-semibold mb-3 border-b border-slate-300 pb-1">{year}</h2>
            <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(160px, 1fr))` }}>
              {grouped[year]?.map((card, i) => {
                const have = shareMode ? !!myChecks[card.id] : !!card.have;
                return (
                  <article key={card.id || i} className="bg-white shadow rounded-xl p-2 border border-slate-200">
                    <div className="relative">
                      <div className="w-full rounded-xl border border-slate-200 overflow-hidden aspect-[2/3] bg-white cursor-pointer" onClick={()=>setDetail(card)}>
                        {card.imageUrl ? (
                          <img src={card.imageUrl} alt={card.title} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full grid place-items-center text-slate-300"><ImageIcon/></div>
                        )}
                      </div>
                      {!shareMode && (
                        <div className="absolute top-2 right-2 flex gap-1">
                          <button className="p-1.5 rounded bg-white/90 hover:bg-white shadow" title="수정" onClick={(e)=>{e.stopPropagation(); setDetail(card);}}>
                            <Pencil size={14}/>
                          </button>
                          <button className="p-1.5 rounded bg-white/90 hover:bg-white shadow" title="삭제" onClick={(e)=>{e.stopPropagation(); removeItem(card.id);}}>
                            <Trash2 size={14}/>
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="mt-2 text-sm font-medium text-slate-800 truncate" title={card.title}>{card.title || "(제목 없음)"}</div>
                    <div className="text-xs text-slate-500 truncate">{card.event || "-"} · {card.year || "-"}</div>
                    <label className="mt-1 inline-flex items-center gap-2 text-xs select-none">
                      <input type="checkbox" checked={have} onChange={(e)=>toggleHave(card, e.target.checked)} onClick={(e)=>e.stopPropagation()} /> 보유
                    </label>
                  </article>
                );
              })}
            </div>
          </section>
        ))}

        {items.length === 0 && !loadError && (
          <div className="text-center text-slate-400">카드가 없습니다.</div>
        )}
      </main>

      {/* 상세 모달 */}
      {detail && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm grid place-items-center p-4" onClick={()=>setDetail(null)}>
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl" onClick={(e)=>e.stopPropagation()}>
            <div className="flex items-center justify-between p-3 border-b">
              <div className="font-semibold">상세 정보</div>
              <button className="p-1 rounded hover:bg-slate-100" onClick={()=>setDetail(null)}><X size={18} /></button>
            </div>
            <div className="p-3 space-y-3">
              <div className="relative rounded-xl border overflow-hidden aspect-[2/3] bg-slate-50 grid place-items-center cursor-pointer" onClick={()=>detailFileRef.current?.click()}>
                {detail.imageUrl ? (
                  <img src={detail.imageUrl} alt={detail.title} className="w-full h-full object-cover" />
                ) : (<div className="text-slate-400 text-sm">이미지 선택</div>)}
                <button className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/80 hover:bg-white shadow" onClick={(e) => { e.stopPropagation(); const flat = orderedYearKeys.flatMap((y)=>grouped[y]||[]); const i = flat.findIndex((x)=>x.id===detail.id); if (i>0) setDetail(flat[i-1]); }}><ChevronLeft size={18}/></button>
                <button className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/80 hover:bg-white shadow" onClick={(e) => { e.stopPropagation(); const flat = orderedYearKeys.flatMap((y)=>grouped[y]||[]); const i = flat.findIndex((x)=>x.id===detail.id); if (i>=0 && i<flat.length-1) setDetail(flat[i+1]); }}><ChevronRight size={18}/></button>
                <input ref={detailFileRef} type="file" accept="image/*" className="hidden" onChange={(e)=>onDetailImageSelect(e.target.files)} />
              </div>

              {(!shareMode) ? (
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <label className="col-span-2">제목<input className="mt-1 w-full border rounded px-2 py-1" value={detail.title||""} onChange={(e)=>setDetail({...detail, title:e.target.value})}/></label>
                  <label>구매 날짜<input type="date" className="mt-1 w-full border rounded px-2 py-1" value={detail.purchaseDate||""} onChange={(e)=>setDetail({...detail, purchaseDate:e.target.value, year: yearFrom(e.target.value)})}/></label>
                  <label>이벤트<input className="mt-1 w-full border rounded px-2 py-1" value={detail.event||""} onChange={(e)=>setDetail({...detail, event:e.target.value})}/></label>
                  <label>구매처<input className="mt-1 w-full border rounded px-2 py-1" value={detail.vendor||""} onChange={(e)=>setDetail({...detail, vendor:e.target.value})}/></label>
                  <label>연도<input className="mt-1 w-full border rounded px-2 py-1" value={detail.year||""} disabled /></label>
                  <label className="col-span-2">비고<textarea className="mt-1 w-full border rounded px-2 py-1" rows={3} value={detail.notes||""} onChange={(e)=>setDetail({...detail, notes:e.target.value})}/></label>
                </div>
              ) : (
                <div className="text-sm space-y-1">
                  <div><b>제목</b> {detail.title || "(제목 없음)"}</div>
                  <div><b>구매 날짜</b> {detail.purchaseDate || "-"}</div>
                  <div><b>이벤트</b> {detail.event || "-"}</div>
                  <div><b>구매처</b> {detail.vendor || "-"}</div>
                  <div><b>연도</b> {detail.year || "-"}</div>
                  {detail.notes && <div className="whitespace-pre-wrap"><b>비고</b> {detail.notes}</div>}
                </div>
              )}

              <label className="inline-flex items-center gap-2 text-sm select-none cursor-pointer">
                <input type="checkbox" checked={shareMode ? !!myChecks[detail.id] : !!detail.have} onChange={(e)=>toggleHave(detail, e.target.checked)} /> 보유
              </label>

              {!shareMode && (
                <div className="flex gap-2 justify-end">
                  <button className="px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200" onClick={()=>setDetail(null)}>닫기</button>
                  <button className="px-3 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700" onClick={()=>{
                    setItems((prev)=>prev.map((p)=>p.id===detail.id? {...p, ...detail}: p));
                    alert("저장 완료");
                  }}>저장</button>
                  <button className="px-3 py-2 rounded-lg bg-rose-600 text-white hover:bg-rose-700" onClick={()=>removeItem(detail.id)}>삭제</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
