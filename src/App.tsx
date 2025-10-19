import React, { useEffect, useState } from "react";
import { Plus, Upload, List, Grid as GridIcon, Search } from "lucide-react";

export default function PokaListApp() {
  const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const srcParam = params.get("src");
  const isEdit = params.get("edit") === "1";
  const isAdmin = params.get("admin") === "1";
  const sourceMode = !!srcParam;
  const shareMode = sourceMode && !isEdit && !isAdmin;
  useEffect(() => {
    document.title = "BOGUMMY PHOTOCARD";
  }, []);

  const [view, setView] = useState("gallery");
  const [cards, setCards] = useState<any[]>([]);
  const [filter, setFilter] = useState({ year: "전체", event: "전체", search: "" });
  const [loadError, setLoadError] = useState<string>("");

  // srcParam(catalog.json) 불러오고 스키마 정규화
  useEffect(() => {
    if (!srcParam) return;
    let aborted = false;
    (async () => {
      try {
        setLoadError("");
        const res = await fetch(srcParam, { cache: "no-cache" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        // 지원 스키마: ①배열 루트 ②{v,title,note,items:[...]}
        const raw = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];
        const normalized = raw.map((it: any) => ({
          title: it.title || it.name || "",
          event: it.event || "",
          year: it.year || (it.purchaseDate ? String(new Date(it.purchaseDate).getFullYear()) : ""),
          image: it.image || it.imageUrl || it.imageDataUrl || "",
          memo: it.notes || it.memo || "",
          buyer: it.vendor || it.buyer || "",
          date: it.purchaseDate || it.date || "",
        }));
        if (!aborted) setCards(normalized);
      } catch (e:any) {
        console.error("catalog load failed", e);
        if (!aborted) {
          setLoadError("src JSON을 불러오지 못했습니다. URL과 CORS 설정을 확인해주세요.");
          setCards([]);
        }
      }
    })();
    return () => { aborted = true; };
  }, [srcParam]);

  const filtered = cards.filter((c) => {
    const matchEvent = filter.event === "전체" || c.event === filter.event;
    const matchYear = filter.year === "전체" || c.year === filter.year;
    const matchSearch =
      !filter.search ||
      [c.title, c.event, c.memo, c.buyer, c.date].some((f) =>
        (f || "").toLowerCase().includes(filter.search.toLowerCase())
      );
    return matchEvent && matchYear && matchSearch;
  });

  const grouped = filtered.reduce((acc, cur) => {
    const y = cur.year || "연도 미지정";
    acc[y] = acc[y] || [];
    acc[y].push(cur);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b border-slate-200">
        <div className="mx-auto max-w-6xl px-4 py-3 flex flex-wrap items-center gap-3 justify-between">
          <div className="text-2xl md:text-3xl font-extrabold tracking-wide whitespace-nowrap">
            BOGUMMY PHOTOCARD LIST❣️
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setView("gallery")} className={`p-2 rounded-lg ${view === "gallery" ? "bg-slate-200" : "hover:bg-slate-100"}`} title="갤러리 보기"><GridIcon size={18} /></button>
            <button onClick={() => setView("table")} className={`p-2 rounded-lg ${view === "table" ? "bg-slate-200" : "hover:bg-slate-100"}`} title="표 보기"><List size={18} /></button>
            {shareMode ? (
              <div className="text-sm text-slate-600 ml-2 truncate">보유 체크 현황은 이 브라우저에만 저장됩니다.</div>
            ) : (
              <>
                <button className="flex items-center gap-1 bg-blue-600 text-white px-3 py-1 rounded-lg text-sm hover:bg-blue-700">
                  <Plus size={14} /> 새 항목
                </button>
                <button className="flex items-center gap-1 bg-gray-200 px-3 py-1 rounded-lg text-sm hover:bg-gray-300">
                  <Upload size={14} /> 이미지 업로드(commit)
                </button>
              </>
            )}
          </div>
        </div>
        {/* 필터 바 복원 */}
        <div className="mx-auto max-w-6xl px-4 pb-3 flex flex-wrap items-center gap-3 justify-between">
          <div className="flex items-center gap-2 w-full md:w-auto">
            <div className="flex items-center border rounded-lg px-2 bg-white w-full md:w-80">
              <Search size={18} className="text-slate-400" />
              <input
                type="text"
                placeholder="검색: 제목/이벤트/구매처/연도/메모"
                value={filter.search}
                onChange={(e) => setFilter({ ...filter, search: e.target.value })}
                className="w-full px-2 py-1 outline-none text-sm bg-transparent"
              />
            </div>
            <select value={filter.event} onChange={(e) => setFilter({ ...filter, event: e.target.value })} className="border rounded-lg px-2 py-1 text-sm">
              <option>전체</option>
              {[...new Set(cards.map((c) => c.event).filter(Boolean))].map((e) => (
                <option key={e}>{e}</option>
              ))}
            </select>
            <select value={filter.year} onChange={(e) => setFilter({ ...filter, year: e.target.value })} className="border rounded-lg px-2 py-1 text-sm">
              <option>전체</option>
              {[...new Set(cards.map((c) => c.year).filter(Boolean))].map((y) => (
                <option key={y}>{y}</option>
              ))}
            </select>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        {loadError && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 border border-red-200 text-sm">
            {loadError}
          </div>
        )}
        {Object.keys(grouped)
          .sort((a, b) => (b === "연도 미지정" ? -1 : b.localeCompare(a)))
          .map((year) => (
            <div key={year} className="mb-8">
              <h2 className="text-lg font-semibold mb-3 border-b border-slate-300 pb-1">{year}</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {grouped[year].map((card, i) => (
                  <div key={i} className="bg-white shadow rounded-xl p-2">
                    <img src={card.image} alt={card.title} className="w-full rounded-lg object-cover" />
                    <div className="mt-2 text-sm font-medium text-slate-800">{card.title}</div>
                    <div className="text-xs text-slate-500">{card.event} · {card.year}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        {cards.length === 0 && (
          <div className="text-center text-slate-400">카드가 없습니다.</div>
        )}
      </main>
    </div>
  );
}
