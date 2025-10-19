import React, { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Upload, Download, List, Grid as GridIcon, Search, Image as ImageIcon, X, Share2, Copy, Link as LinkIcon, ChevronLeft, ChevronRight } from "lucide-react";

/**
 * ✅ 복원 버전
 * - 공유용: 상단 큰 제목 유지, 툴바 문구는 "보유 체크 현황은 이 브라우저에만 저장됩니다." + 보기 아이콘만 표시
 * - 관리자용: 다중 이미지 추가 / JSON 주소로 공유 / 이미지 업로드(commit) / catalog.json 커밋 등 관리자 패널 복구
 * - 연도 그룹: 2023 → 2024 → 2025 ... 오름차순 (연도 미지정은 맨 뒤)
 * - 썸네일 클릭 시 상세 모달(이전/다음) 복원
 */

// ---------- 유틸 ----------
const STORAGE_KEY = "pokaList-admin-local"; // 관리자 편집 중 로컬 임시 저장
const byDateAsc = (a: any, b: any) => {
  const da = a.date || a.purchaseDate || "";
  const db = b.date || b.purchaseDate || "";
  if (!da && !db) return 0;
  if (!da) return 1;
  if (!db) return -1;
  const diff = da.localeCompare(db);
  if (diff !== 0) return diff;
  // 같은 날짜면 등록 순서대로 오른쪽으로 붙도록 index 비교
  return (a.__idx ?? 0) - (b.__idx ?? 0);
};
const safeB64 = (str: string) => btoa(unescape(encodeURIComponent(str)));

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
  const [loadError, setLoadError] = useState<string>("");
  const [filter, setFilter] = useState({ year: "전체", event: "전체", search: "" });
  const idxRef = useRef(0);

  // 관리자 패널
  const [adminOpen, setAdminOpen] = useState<boolean>(isAdmin);
  const [gh, setGh] = useState({ owner: "gumming6-6", repo: "bogummy", branch: "main", token: "" });

  // 상세 모달
  const [detail, setDetail] = useState<any | null>(null);

  // ------ 데이터 로드 ------
  useEffect(() => {
    if (!sourceMode) return;
    let aborted = false;
    (async () => {
      try {
        setLoadError("");
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
          year: it.year || (it.purchaseDate ? String(new Date(it.purchaseDate).getFullYear()) : (it.date ? String(new Date(it.date).getFullYear()) : "")),
          imageUrl: it.image || it.imageUrl || (it.imageDataUrl ? it.imageDataUrl : ""),
          have: !!it.have,
          __idx: i,
        }));
        if (!aborted) setItems(normalized);
      } catch (e) {
        console.error(e);
        if (!aborted) setLoadError("src JSON을 불러오지 못했습니다. URL과 CORS 설정(GitHub Pages 권장)을 확인해주세요.");
      }
    })();
    return () => { aborted = true; };
  }, [sourceMode, srcParam]);

  // 관리자/편집 모드에서 로컬 임시 저장
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

  const years = useMemo(() => {
    const ys = [...new Set(filtered.map((c) => c.year).filter(Boolean))]
      .map((y) => Number(y))
      .filter((n) => !isNaN(n))
      .sort((a, b) => a - b); // 오름차순 2023→
    return ys.map(String);
  }, [filtered]);

  const grouped = useMemo(() => {
    const map: Record<string, any[]> = {};
    filtered.forEach((c) => { const y = c.year || "연도 미지정"; (map[y] ||= []).push(c); });
    Object.keys(map).forEach((y) => map[y].sort(byDateAsc));
    return map;
  }, [filtered]);

  const orderedYearKeys = useMemo(() => {
    const keys = Object.keys(grouped);
    const known = keys.filter((k) => k !== "연도 미지정").map((k) => Number(k)).filter((n)=>!isNaN(n)).sort((a,b)=>a-b).map(String);
    return [...known, ...(keys.includes("연도 미지정") ? ["연도 미지정"] : [])];
  }, [grouped]);

  // ------ 이벤트/연도 옵션 ------
  const eventOptions = useMemo(() => ["전체", ...Array.from(new Set(items.map((c) => c.event).filter(Boolean)))], [items]);
  const yearOptions = useMemo(() => ["전체", ...Array.from(new Set(items.map((c) => c.year).filter(Boolean))).sort((a:any,b:any)=>Number(a)-Number(b))], [items]);

  // ------ 관리자 기능: 다중 이미지 추가(로컬) ------
  function handleMultiAdd(files: FileList | null) {
    if (!files) return;
    const arr: any[] = [];
    Array.from(files).forEach((f) => {
      const url = URL.createObjectURL(f);
      arr.push({
        id: `${Date.now().toString(36)}-${idxRef.current++}`,
        title: f.name.replace(/\.[^.]+$/, ""),
        event: "",
        vendor: "",
        notes: "",
        purchaseDate: "",
        year: "",
        imageUrl: url,
        have: false,
        __idx: idxRef.current,
        __file: f, // 업로드용 보관
      });
    });
    setItems((prev) => [...prev, ...arr]);
  }

  // ------ 관리자 기능: 공유 링크 만들기(src) ------
  function createSrcShareLink(custom?: string) {
    const url = custom || srcParam;
    if (!url) { alert("현재 페이지는 src가 없어 링크를 만들 수 없습니다."); return; }
    const base = window.location.origin + window.location.pathname;
    const link = `${base}?src=${encodeURIComponent(url)}`;
    if ((navigator as any).clipboard?.writeText) (navigator as any).clipboard.writeText(link).then(()=>alert("src 링크를 복사했습니다."));
    else prompt("아래 링크를 복사하세요", link);
  }

  // ------ 관리자 기능: GitHub 커밋 (이미지 업로드/카탈로그) ------
  async function ghApi(path: string, contentB64: string, message: string) {
    const { owner, repo, branch, token } = gh;
    if (!owner || !repo || !branch || !token) { alert("GitHub 정보와 토큰을 입력하세요."); return; }
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
    // sha 조회(있으면 업데이트)
    let sha: string | undefined;
    const head = await fetch(`${url}?ref=${branch}`, { headers: { Authorization: `token ${token}` } });
    if (head.status === 200) { const j = await head.json(); sha = j.sha; }
    const res = await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `token ${token}` },
      body: JSON.stringify({ message, content: contentB64, branch, sha })
    });
    if (!res.ok) throw new Error(`GitHub API ${res.status}`);
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
    } catch (e:any) {
      alert(`이미지 업로드 실패: ${e?.message || e}`);
    }
  }

  async function adminCommitCatalog() {
    try {
      const payload = { v: 1, title: "BOGUMMY", note: "", items: items.map(({__file, __idx, ...rest}) => rest) };
      const b64 = safeB64(JSON.stringify(payload, null, 2));
      await ghApi("public/catalog.json", b64, "update catalog.json");
      alert("catalog.json 커밋 완료 (1~2분 후 반영)");
    } catch (e:any) { alert(`카탈로그 커밋 실패: ${e?.message || e}`); }
  }

  // ------ 상세 모달 내 보유 토글 ------
  function toggleHave(it: any, checked: boolean) {
    setItems((prev) => prev.map((p) => (p.id === it.id ? { ...p, have: checked } : p)));
    setDetail((d) => (d && d.id === it.id ? { ...d, have: checked } : d));
  }

  // ------ 렌더 ------
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* 상단 헤더: 큰 제목 항상 표시 */}
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b border-slate-200">
        <div className="mx-auto max-w-6xl px-4 py-3 flex flex-wrap items-center gap-3">
          <div className="text-2xl md:text-3xl font-extrabold tracking-wide whitespace-nowrap">BOGUMMY PHOTOCARD LIST❣️</div>

          {/* 우측: 보기 아이콘 + 안내/관리자 버튼 */}
          <div className="flex items-center gap-2 ml-auto">
            <button onClick={() => setView("gallery")} className={`p-2 rounded-lg ${view === "gallery" ? "bg-slate-200" : "hover:bg-slate-100"}`} title="갤러리 보기"><GridIcon size={18} /></button>
            <button onClick={() => setView("table")} className={`p-2 rounded-lg ${view === "table" ? "bg-slate-200" : "hover:bg-slate-100"}`} title="표 보기"><List size={18} /></button>
            {shareMode ? (
              <div className="text-sm text-slate-600 ml-2 truncate">보유 체크 현황은 이 브라우저에만 저장됩니다.</div>
            ) : (
              <>
                <label className="flex items-center gap-1 bg-blue-600 text-white px-3 py-2 rounded-lg text-sm hover:bg-blue-700 cursor-pointer">
                  <Plus size={14} /> 다중 이미지 추가
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

        {/* 관리자 패널 (관리자/편집 모드에서만) */}
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
              {grouped[year]?.map((card, i) => (
                <article key={card.id || i} className="bg-white shadow rounded-xl p-2 border border-slate-200">
                  <div className="w-full rounded-xl border border-slate-200 overflow-hidden aspect-[2/3] bg-white cursor-pointer" onClick={()=>setDetail(card)}>
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
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm grid place-items-center p-4" onClick={()=>setDetail(null)}>
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl" onClick={(e)=>e.stopPropagation()}>
            <div className="flex items-center justify-between p-3 border-b">
              <div className="font-semibold">상세 정보</div>
              <button className="p-1 rounded hover:bg-slate-100" onClick={()=>setDetail(null)}><X size={18} /></button>
            </div>
            <div className="p-3 space-y-2">
              <div className="w-full rounded-xl border overflow-hidden aspect-[2/3] bg-slate-50 grid place-items-center">
                {detail.imageUrl ? (
                  <img src={detail.imageUrl} alt={detail.title} className="w-full h-full object-cover" />
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
              <button className="px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200" onClick={()=>{
                // 이전 항목
                const flat = orderedYearKeys.flatMap((y)=>grouped[y]||[]);
                const i = flat.findIndex((x)=>x.id===detail.id);
                if (i>0) setDetail(flat[i-1]);
              }}><ChevronLeft size={18}/> 이전</button>
              <button className="px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200" onClick={()=>{
                // 다음 항목
                const flat = orderedYearKeys.flatMap((y)=>grouped[y]||[]);
                const i = flat.findIndex((x)=>x.id===detail.id);
                if (i>=0 && i<flat.length-1) setDetail(flat[i+1]);
              }}>다음 <ChevronRight size={18}/></button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
