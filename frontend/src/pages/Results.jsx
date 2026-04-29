/*
 * Copyright (C) 2023 Yaraku, Inc.
 *
 * This file is part of Human Evaluation Tool.
 *
 * Human Evaluation Tool is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by the
 * Free Software Foundation, either version 3 of the License,
 * or (at your option) any later version.
 *
 * Human Evaluation Tool is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY
 * or FITNESS FOR A PARTICULAR PURPOSE.
 * See the GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License along with
 * Human Evaluation Tool. If not, see <https://www.gnu.org/licenses/>.
 *
 * Written by Giovanni G. De Giacomo <giovanni@yaraku.com>, September 2023
 */

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";

import Spinner from "../components/Spinner";
import { useEvaluations } from "../features/evaluations/useEvaluations";
import { getEvaluationIaa, getEvaluationResults } from "../services/apiEvaluations";
import { exportEvaluationXml } from "../services/apiAdmin";

import "../assets/viewer.css";

function downloadTsv(rows, filename) {
  const blob = new Blob([rows.join("")], { type: "text/tab-separated-values" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function fmt(val) {
  if (val === null || val === undefined) return "—";
  return val.toFixed(3);
}

function IaaSection({ evaluationId }) {
  const { data: iaa, isLoading } = useQuery({
    queryKey: ["evaluationIaa", evaluationId],
    queryFn: () => getEvaluationIaa({ id: evaluationId }),
    enabled: !!evaluationId,
  });

  if (isLoading) return <Spinner />;
  if (!iaa) return null;

  const { annotators, segments, correlations } = iaa;

  if (annotators.length < 2) {
    return (
      <p className="tw-text-sm tw-text-gray-500 tw-mt-2">
        At least two annotators are needed to compute agreement.
      </p>
    );
  }

  return (
    <div className="tw-mt-6">
      <h2 className="tw-text-xl tw-font-bold tw-text-gray-800 tw-mb-3">
        Inter-Annotator Agreement
      </h2>
      <p className="tw-text-sm tw-text-gray-500 tw-mb-4">
        MQM scores per segment (minor&nbsp;=&nbsp;1, major&nbsp;=&nbsp;5, critical&nbsp;=&nbsp;25).
        Pearson&nbsp;<em>r</em> and Spearman&nbsp;<em>ρ</em> measure score-level correlation between annotator pairs.
      </p>

      {/* Correlation summary */}
      <table className="table tw-mb-6 tw-text-sm">
        <thead>
          <tr>
            <th>Annotator A</th>
            <th>Annotator B</th>
            <th>Segments</th>
            <th>Pearson <em>r</em></th>
            <th>Spearman <em>ρ</em></th>
          </tr>
        </thead>
        <tbody>
          {correlations.map((c, i) => (
            <tr key={i}>
              <td>{c.annotator_a}</td>
              <td>{c.annotator_b}</td>
              <td>{c.n_segments}</td>
              <td>{fmt(c.pearson)}</td>
              <td>{fmt(c.spearman)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Per-segment scores */}
      <details>
        <summary className="tw-cursor-pointer tw-font-semibold tw-text-gray-700 tw-mb-2">
          Per-segment scores
        </summary>
        <div className="tw-overflow-x-auto tw-mt-2">
          <table className="table tw-text-sm">
            <thead>
              <tr>
                <th>#</th>
                <th>Source</th>
                {annotators.map((a) => <th key={a}>{a}</th>)}
              </tr>
            </thead>
            <tbody>
              {segments.map((seg, i) => (
                <tr key={seg.bitext_id}>
                  <td>{i + 1}</td>
                  <td className="tw-max-w-xs tw-truncate tw-whitespace-nowrap">{seg.source}</td>
                  {annotators.map((a) => (
                    <td key={a}>{seg.scores[a] !== undefined ? seg.scores[a] : "—"}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

export default function ResultsPage() {
  const [evaluationIndex, setEvaluationIndex] = useState(0);
  const [isExportingXml, setIsExportingXml] = useState(false);

  const { evaluations, isLoading: areEvaluationsLoading } = useEvaluations();
  const evaluationId = evaluations?.[evaluationIndex]?.["id"];
  const evaluationName = evaluations?.[evaluationIndex]?.["name"] ?? "results";

  const { data: evaluationResults, isLoading: areResultsLoading } = useQuery({
    queryKey: ["evaluationResults", evaluationId],
    queryFn: () => getEvaluationResults({ id: evaluationId }),
    enabled: !!evaluationId,
  });

  useEffect(() => {
    if (!areEvaluationsLoading && !areResultsLoading) {
      mqmCreateViewer(document.getElementById("mqm"));
    }
  }, [areEvaluationsLoading, areResultsLoading]);

  useEffect(() => {
    if (!areEvaluationsLoading && !areResultsLoading) {
      mqmSetData(evaluationResults);
    }
  }, [evaluationResults]);

  if (areEvaluationsLoading || areResultsLoading) {
    return <Spinner />;
  }

  return (
    <div className="tw-m-4">
      <div className="tw-flex tw-flex-row tw-items-center tw-gap-4 tw-flex-wrap">
        <h1 className="tw-text-lg tw-font-bold">Evaluation:</h1>
        <select
          value={evaluationIndex}
          onChange={(e) => setEvaluationIndex(Number(e.target.value))}
          className="form-control tw-w-auto"
        >
          {evaluations.map((evaluation, index) => (
            <option key={evaluation["id"]} value={index}>{evaluation["name"]}</option>
          ))}
        </select>
        <div className="tw-ml-auto tw-flex tw-gap-2">
          {evaluationResults && evaluationResults.length > 0 && (
            <button
              className="btn btn-secondary"
              onClick={() =>
                downloadTsv(
                  evaluationResults,
                  `${evaluationName.replace(/\s+/g, "_")}_results.tsv`
                )
              }
            >
              Download TSV
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
              {isExportingXml ? "Exporting…" : "Download XML"}
            </button>
          )}
        </div>
      </div>

      <hr />

      <IaaSection evaluationId={evaluationId} />

      <hr className="tw-mt-6" />

      <h2 className="tw-text-xl tw-font-bold tw-text-gray-800 tw-my-3">Annotations</h2>
      <div id="mqm"></div>
    </div>
  );
}
