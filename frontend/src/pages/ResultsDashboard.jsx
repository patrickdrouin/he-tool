/*
 * Results dashboard — SciTradUM fork addition (see CLAUDE.md).
 *
 * Built from scratch to replace the Marot-viewer-based /results page for
 * day-to-day use: KPI summary, filterable charts, per-system/annotator
 * stats, IAA, and a searchable/sortable error table with per-row context.
 * The original page (public/viewer.js + IaaSection) is kept at /results —
 * this lives at /results/dashboard so both remain reachable.
 *
 * Licensed under the GNU GPL v3, consistent with the rest of
 * Human Evaluation Tool.
 */

import { Fragment, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";

import Spinner from "../components/Spinner";
import { useEvaluations } from "../features/evaluations/useEvaluations";
import { getEvaluationIaa, getEvaluationResults } from "../services/apiEvaluations";
import { getEvaluationDashboard, exportEvaluationXml } from "../services/apiAdmin";

import "../assets/resultsDashboard.css";

const CATEGORY_GROUP_COLORS = {
  Accuracy: "var(--rd-cat-accuracy)",
  "Linguist conventions": "var(--rd-cat-linguistic)",
  Terminology: "var(--rd-cat-terminology)",
  Style: "var(--rd-cat-style)",
  Locale: "var(--rd-cat-locale)",
  "Audience appropriateness": "var(--rd-cat-audience)",
  SourceError: "var(--rd-cat-source)",
};

const CATEGORY_GROUP_LABEL_FR = {
  Accuracy: "Précision",
  "Linguist conventions": "Conventions linguistiques",
  Terminology: "Terminologie",
  Style: "Style",
  Locale: "Régionalisme",
  "Audience appropriateness": "Adéquation au public",
  SourceError: "Erreur source",
};

const CATEGORY_GROUP_ORDER = Object.keys(CATEGORY_GROUP_COLORS);

const SEVERITY_ORDER = ["critical", "major", "minor"];
const SEVERITY_LABEL_FR = { critical: "Critique", major: "Majeure", minor: "Mineure" };
const SEVERITY_WEIGHT = { critical: 3, major: 2, minor: 1, "not-judgeable": 0, "no-error": 0 };
const SEVERITY_CSS_CLASS = { critical: "rd-badge-critical", major: "rd-badge-major", minor: "rd-badge-minor" };

const PAGE_SIZE = 40;

const EMPTY_FILTERS = {
  document: "all",
  system: "all",
  annotator: "all",
  category: "all",
  severity: "all",
  search: "",
};

function downloadTsv(rows, filename) {
  const blob = new Blob([rows.join("")], { type: "text/tab-separated-values" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function fmt(val, digits = 2) {
  if (val === null || val === undefined) return "—";
  return val.toFixed(digits);
}

function highlightWords(text, start, end) {
  if (!text) return "—";
  // Matches the word-index convention markings are stored with: whitespace
  // collapsed and trimmed before splitting (see MarkingItem.jsx), so start/end
  // line up with the same words the annotator selected, whatever the raw
  // spacing in the stored text looks like.
  const words = text.trim().replace(/\s+/g, " ").split(" ");
  return words.map((w, i) => (
    <span key={i} className={i >= start && i <= end ? "rd-highlight" : undefined}>
      {w}
      {i < words.length - 1 ? " " : ""}
    </span>
  ));
}

function BarList({ data, colorFor, emptyLabel }) {
  if (data.length === 0) {
    return <p className="rd-panel-empty">{emptyLabel}</p>;
  }
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div>
      {data.map((d) => (
        <div className="rd-bar-row" key={d.key}>
          <span className="rd-bar-label" title={d.label}>
            <span className="rd-bar-dot" style={{ background: colorFor(d) }} />
            {d.label}
          </span>
          <span className="rd-bar-track">
            <span
              className="rd-bar-fill"
              style={{ width: `${(d.value / max) * 100}%`, background: colorFor(d) }}
            />
          </span>
          <span className="rd-bar-value">{d.value}</span>
        </div>
      ))}
    </div>
  );
}

function SeverityBadge({ severity }) {
  const label = SEVERITY_LABEL_FR[severity];
  if (!label) {
    return <span className="rd-badge rd-badge-source">{severity}</span>;
  }
  return <span className={`rd-badge ${SEVERITY_CSS_CLASS[severity]}`}>{label}</span>;
}

function SortableTh({ label, sortKey, sort, onSort }) {
  const active = sort.key === sortKey;
  return (
    <th>
      <button type="button" onClick={() => onSort(sortKey)}>
        {label}
        {active ? (sort.dir === "asc" ? " ▲" : " ▼") : ""}
      </button>
    </th>
  );
}

function IaaPanel({ evaluationId }) {
  const { data: iaa, isLoading } = useQuery({
    queryKey: ["evaluationIaa", evaluationId],
    queryFn: () => getEvaluationIaa({ id: evaluationId }),
    enabled: !!evaluationId,
  });

  return (
    <div className="rd-panel" style={{ marginBottom: "1.25rem" }}>
      <div className="rd-panel-title">Accord inter-annotateurs</div>
      {isLoading ? (
        <Spinner />
      ) : !iaa || iaa.annotators.length < 2 ? (
        <p className="rd-panel-empty">
          Au moins deux annotateur·ice·s sont nécessaires pour calculer l'accord.
        </p>
      ) : (
        <div className="rd-table-wrap">
          <table className="rd-stat-table">
            <thead>
              <tr>
                <th>Annotateur A</th>
                <th>Annotateur B</th>
                <th>Segments partagés</th>
                <th>Pearson r</th>
                <th>Spearman ρ</th>
              </tr>
            </thead>
            <tbody>
              {iaa.correlations.map((c, i) => (
                <tr key={i}>
                  <td>{c.annotator_a}</td>
                  <td>{c.annotator_b}</td>
                  <td>{c.n_segments}</td>
                  <td>{fmt(c.pearson, 3)}</td>
                  <td>{fmt(c.spearman, 3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function ResultsDashboardPage() {
  const [evaluationIndex, setEvaluationIndex] = useState(0);
  const [isExportingXml, setIsExportingXml] = useState(false);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [sort, setSort] = useState({ key: "severity", dir: "desc" });
  const [page, setPage] = useState(0);
  const [expanded, setExpanded] = useState(() => new Set());

  const { evaluations, isLoading: areEvaluationsLoading } = useEvaluations();
  const evaluationId = evaluations?.[evaluationIndex]?.["id"];
  const evaluationName = evaluations?.[evaluationIndex]?.["name"] ?? "results";

  const { data, isLoading, isError } = useQuery({
    queryKey: ["evaluationDashboard", evaluationId],
    queryFn: () => getEvaluationDashboard({ evaluationId }),
    enabled: !!evaluationId,
  });

  // Kept only to feed the "Télécharger TSV" button, so it matches /results exactly.
  const { data: tsvRows } = useQuery({
    queryKey: ["evaluationResults", evaluationId],
    queryFn: () => getEvaluationResults({ id: evaluationId }),
    enabled: !!evaluationId,
  });

  useEffect(() => {
    setPage(0);
    setExpanded(new Set());
  }, [evaluationId, filters]);

  useEffect(() => {
    setFilters(EMPTY_FILTERS);
    setSort({ key: "severity", dir: "desc" });
  }, [evaluationId]);

  const rows = useMemo(() => {
    if (!data) return [];
    const out = [];
    for (const seg of data.segments) {
      for (const ann of seg.annotations) {
        for (const sys of ann.systems) {
          for (const m of sys.markings) {
            out.push({
              key: `${seg.bitextId}-${ann.annotator}-${sys.systemId}-${m.id}`,
              bitextId: seg.bitextId,
              documentId: seg.documentId,
              documentName: seg.documentName,
              source: seg.source,
              translation: sys.translation,
              annotator: ann.annotator,
              systemId: sys.systemId,
              systemName: sys.systemName,
              ...m,
            });
          }
        }
      }
    }
    return out;
  }, [data]);

  const filtersActive =
    filters.document !== "all" ||
    filters.system !== "all" ||
    filters.annotator !== "all" ||
    filters.category !== "all" ||
    filters.severity !== "all" ||
    filters.search.trim() !== "";

  const filteredRows = useMemo(() => {
    const search = filters.search.trim().toLowerCase();
    return rows.filter((r) => {
      if (filters.document !== "all" && String(r.documentId) !== filters.document) return false;
      if (filters.system !== "all" && String(r.systemId) !== filters.system) return false;
      if (filters.annotator !== "all" && r.annotator !== filters.annotator) return false;
      if (filters.category !== "all" && r.categoryGroup !== filters.category) return false;
      if (filters.severity !== "all" && r.severity !== filters.severity) return false;
      if (search) {
        const haystack = `${r.source} ${r.translation} ${r.comment} ${r.text}`.toLowerCase();
        if (!haystack.includes(search)) return false;
      }
      return true;
    });
  }, [rows, filters]);

  const sortedRows = useMemo(() => {
    const copy = [...filteredRows];
    const dir = sort.dir === "asc" ? 1 : -1;
    copy.sort((a, b) => {
      let av;
      let bv;
      switch (sort.key) {
        case "severity":
          av = SEVERITY_WEIGHT[a.severity] ?? 0;
          bv = SEVERITY_WEIGHT[b.severity] ?? 0;
          break;
        case "category":
          av = a.categoryLabel;
          bv = b.categoryLabel;
          break;
        case "document":
          av = a.documentName;
          bv = b.documentName;
          break;
        case "system":
          av = a.systemName;
          bv = b.systemName;
          break;
        case "annotator":
          av = a.annotator;
          bv = b.annotator;
          break;
        default:
          av = a.bitextId;
          bv = b.bitextId;
      }
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return a.bitextId - b.bitextId;
    });
    return copy;
  }, [filteredRows, sort]);

  const pageCount = Math.max(1, Math.ceil(sortedRows.length / PAGE_SIZE));
  const pageRows = sortedRows.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  const categoryBarData = useMemo(() => {
    const counts = {};
    for (const r of filteredRows) counts[r.categoryGroup] = (counts[r.categoryGroup] || 0) + 1;
    return CATEGORY_GROUP_ORDER.filter((g) => counts[g])
      .map((g) => ({ key: g, label: CATEGORY_GROUP_LABEL_FR[g] || g, value: counts[g] }))
      .sort((a, b) => b.value - a.value);
  }, [filteredRows]);

  const severityBarData = useMemo(() => {
    const counts = { critical: 0, major: 0, minor: 0 };
    for (const r of filteredRows) {
      if (counts[r.severity] !== undefined) counts[r.severity] += 1;
    }
    return SEVERITY_ORDER.map((s) => ({ key: s, label: SEVERITY_LABEL_FR[s], value: counts[s] }));
  }, [filteredRows]);

  const overallAvgScore = useMemo(() => {
    if (!data) return null;
    const scores = [];
    for (const seg of data.segments) {
      for (const ann of seg.annotations) scores.push(ann.score);
    }
    if (!scores.length) return null;
    return scores.reduce((a, b) => a + b, 0) / scores.length;
  }, [data]);

  function toggleSort(key) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "desc" }));
  }

  function toggleExpanded(key) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  if (areEvaluationsLoading) return <Spinner />;

  return (
    <div className="rd-root tw-m-4">
      <div className="rd-header-row">
        <h1 className="tw-text-lg tw-font-bold">Résultats — Tableau de bord :</h1>
        <select
          value={evaluationIndex}
          onChange={(e) => setEvaluationIndex(Number(e.target.value))}
          className="form-control tw-w-auto"
        >
          {evaluations.map((evaluation, index) => (
            <option key={evaluation["id"]} value={index}>
              {evaluation["name"]}
            </option>
          ))}
        </select>
        <Link className="rd-alt-view-link" to="/results">
          Ancienne vue (visionneuse Marot) →
        </Link>
        <div className="tw-ml-auto tw-flex tw-gap-2">
          {tsvRows && tsvRows.length > 0 && (
            <button
              className="btn btn-secondary"
              onClick={() =>
                downloadTsv(tsvRows, `${evaluationName.replace(/\s+/g, "_")}_results.tsv`)
              }
            >
              Télécharger TSV
            </button>
          )}
          {evaluationId && (
            <button
              className="btn btn-secondary"
              disabled={isExportingXml}
              onClick={async () => {
                setIsExportingXml(true);
                try {
                  await exportEvaluationXml({
                    evaluationId,
                    filename: `${evaluationName.replace(/\s+/g, "_")}.xml`,
                  });
                } catch (err) {
                  toast.error(err.message);
                } finally {
                  setIsExportingXml(false);
                }
              }}
            >
              {isExportingXml ? "Export en cours…" : "Télécharger XML"}
            </button>
          )}
        </div>
      </div>

      {isLoading && <Spinner />}
      {isError && <p className="tw-text-red-600 tw-mt-4">Impossible de charger les résultats.</p>}

      {data && (
        <>
          <div className="rd-kpi-grid">
            <div className="rd-kpi-card">
              <div className="rd-kpi-label">Segments</div>
              <div className="rd-kpi-value">{data.segments.length}</div>
            </div>
            <div className="rd-kpi-card">
              <div className="rd-kpi-label">Erreurs relevées</div>
              <div className="rd-kpi-value">{rows.length}</div>
              <div className="rd-kpi-sub">
                {data.severityCounts.critical} critiques · {data.severityCounts.major} majeures ·{" "}
                {data.severityCounts.minor} mineures
              </div>
            </div>
            <div className="rd-kpi-card">
              <div className="rd-kpi-label">Score MQM moyen</div>
              <div className="rd-kpi-value">{fmt(overallAvgScore)}</div>
              <div className="rd-kpi-sub">par segment annoté (mineure=1, majeure=5, critique=25)</div>
            </div>
            <div className="rd-kpi-card">
              <div className="rd-kpi-label">Annotateur·ice·s</div>
              <div className="rd-kpi-value">{data.annotators.length}</div>
            </div>
          </div>

          <div className="rd-filters">
            <div className="rd-filter-field">
              <label>Document</label>
              <select
                className="form-control"
                value={filters.document}
                onChange={(e) => setFilters((f) => ({ ...f, document: e.target.value }))}
              >
                <option value="all">Tous</option>
                {data.documents.map((d) => (
                  <option key={d.id} value={String(d.id)}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="rd-filter-field">
              <label>Système</label>
              <select
                className="form-control"
                value={filters.system}
                onChange={(e) => setFilters((f) => ({ ...f, system: e.target.value }))}
              >
                <option value="all">Tous</option>
                {data.systems.map((s) => (
                  <option key={s.id} value={String(s.id)}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="rd-filter-field">
              <label>Annotateur·ice</label>
              <select
                className="form-control"
                value={filters.annotator}
                onChange={(e) => setFilters((f) => ({ ...f, annotator: e.target.value }))}
              >
                <option value="all">Tous</option>
                {data.annotators.map((a) => (
                  <option key={a.annotator} value={a.annotator}>
                    {a.annotator}
                  </option>
                ))}
              </select>
            </div>
            <div className="rd-filter-field">
              <label>Catégorie</label>
              <select
                className="form-control"
                value={filters.category}
                onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value }))}
              >
                <option value="all">Toutes</option>
                {CATEGORY_GROUP_ORDER.map((g) => (
                  <option key={g} value={g}>
                    {CATEGORY_GROUP_LABEL_FR[g] || g}
                  </option>
                ))}
              </select>
            </div>
            <div className="rd-filter-field">
              <label>Sévérité</label>
              <select
                className="form-control"
                value={filters.severity}
                onChange={(e) => setFilters((f) => ({ ...f, severity: e.target.value }))}
              >
                <option value="all">Toutes</option>
                {SEVERITY_ORDER.map((s) => (
                  <option key={s} value={s}>
                    {SEVERITY_LABEL_FR[s]}
                  </option>
                ))}
              </select>
            </div>
            <div className="rd-filter-field rd-filter-search">
              <label>Recherche</label>
              <input
                type="text"
                className="form-control"
                placeholder="Texte source, cible ou commentaire…"
                value={filters.search}
                onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
              />
            </div>
            <button
              type="button"
              className="btn btn-outline-secondary"
              disabled={!filtersActive}
              onClick={() => setFilters(EMPTY_FILTERS)}
            >
              Réinitialiser
            </button>
          </div>

          <div className="rd-panel-grid">
            <div className="rd-panel">
              <div className="rd-panel-title">
                Erreurs par catégorie{filtersActive ? " (filtré)" : ""}
              </div>
              <BarList
                data={categoryBarData}
                colorFor={(d) => CATEGORY_GROUP_COLORS[d.key] || "var(--rd-ink-muted)"}
                emptyLabel="Aucune erreur pour cette sélection."
              />
            </div>
            <div className="rd-panel">
              <div className="rd-panel-title">
                Erreurs par sévérité{filtersActive ? " (filtré)" : ""}
              </div>
              <BarList
                data={severityBarData}
                colorFor={(d) => `var(--rd-sev-${d.key})`}
                emptyLabel="Aucune erreur pour cette sélection."
              />
            </div>
          </div>

          <div className="rd-panel-grid">
            <div className="rd-panel">
              <div className="rd-panel-title">Score moyen par système</div>
              {data.systemScores.length === 0 ? (
                <p className="rd-panel-empty">Aucune donnée.</p>
              ) : (
                <table className="rd-stat-table">
                  <thead>
                    <tr>
                      <th>Système</th>
                      <th>Segments</th>
                      <th>Erreurs</th>
                      <th>Score moyen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.systemScores.map((s) => (
                      <tr key={s.system}>
                        <td>{s.system}</td>
                        <td>{s.annotationCount}</td>
                        <td>{s.markingCount}</td>
                        <td>{fmt(s.avgScore)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div className="rd-panel">
              <div className="rd-panel-title">Activité par annotateur·ice</div>
              {data.annotators.length === 0 ? (
                <p className="rd-panel-empty">Aucune donnée.</p>
              ) : (
                <table className="rd-stat-table">
                  <thead>
                    <tr>
                      <th>Annotateur·ice</th>
                      <th>Segments faits</th>
                      <th>Erreurs</th>
                      <th>Score moyen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.annotators.map((a) => (
                      <tr key={a.annotator}>
                        <td>{a.annotator}</td>
                        <td>
                          {a.segmentsAnnotated} / {a.segmentsSeen}
                        </td>
                        <td>{a.markingCount}</td>
                        <td>{fmt(a.avgScore)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <IaaPanel evaluationId={evaluationId} />

          <div className="rd-panel" style={{ marginBottom: "1.5rem" }}>
            <div className="rd-panel-title">
              Détail des erreurs ({sortedRows.length} sur {rows.length})
            </div>
            {sortedRows.length === 0 ? (
              <p className="rd-panel-empty">Aucune erreur ne correspond aux filtres actuels.</p>
            ) : (
              <>
                <div className="rd-table-wrap">
                  <table className="rd-table">
                    <thead>
                      <tr>
                        <th></th>
                        <SortableTh label="Document" sortKey="document" sort={sort} onSort={toggleSort} />
                        <SortableTh label="Segment" sortKey="segment" sort={sort} onSort={toggleSort} />
                        <SortableTh label="Système" sortKey="system" sort={sort} onSort={toggleSort} />
                        <SortableTh label="Annotateur·ice" sortKey="annotator" sort={sort} onSort={toggleSort} />
                        <SortableTh label="Sévérité" sortKey="severity" sort={sort} onSort={toggleSort} />
                        <SortableTh label="Catégorie" sortKey="category" sort={sort} onSort={toggleSort} />
                        <th>Extrait</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pageRows.map((r) => (
                        <Fragment key={r.key}>
                          <tr
                            className={`rd-row ${expanded.has(r.key) ? "rd-row-open" : ""}`}
                            onClick={() => toggleExpanded(r.key)}
                          >
                            <td>{expanded.has(r.key) ? "▾" : "▸"}</td>
                            <td>{r.documentName}</td>
                            <td>#{r.bitextId}</td>
                            <td>{r.systemName}</td>
                            <td>{r.annotator}</td>
                            <td>
                              <SeverityBadge severity={r.severity} />
                              {r.isSource && (
                                <span className="rd-badge rd-badge-source" style={{ marginLeft: 4 }}>
                                  source
                                </span>
                              )}
                            </td>
                            <td>{r.categoryLabel}</td>
                            <td className="rd-cell-source">{r.text || "—"}</td>
                          </tr>
                          {expanded.has(r.key) && (
                            <tr className="rd-detail-row">
                              <td colSpan={8}>
                                <div className="rd-detail-block">
                                  <div className="rd-detail-label">Source</div>
                                  <div className="rd-detail-text">
                                    {r.isSource ? highlightWords(r.source, r.start, r.end) : r.source}
                                  </div>
                                </div>
                                <div className="rd-detail-block">
                                  <div className="rd-detail-label">Traduction ({r.systemName})</div>
                                  <div className="rd-detail-text">
                                    {!r.isSource
                                      ? highlightWords(r.translation, r.start, r.end)
                                      : r.translation || "—"}
                                  </div>
                                </div>
                                {r.comment && (
                                  <div className="rd-detail-block">
                                    <div className="rd-detail-label">Commentaire</div>
                                    <div className="rd-comment">{r.comment}</div>
                                  </div>
                                )}
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="rd-pagination">
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary"
                    disabled={page === 0}
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                  >
                    ← Précédent
                  </button>
                  <span>
                    Page {page + 1} / {pageCount}
                  </span>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary"
                    disabled={page >= pageCount - 1}
                    onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                  >
                    Suivant →
                  </button>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
